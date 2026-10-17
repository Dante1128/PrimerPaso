//! Pruebas unitarias del contrato de préstamo y garantía.
#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

/// Marca de tiempo inicial (un instante realista cualquiera).
const T0: u64 = 1_700_000_000;

/// Convierte una cantidad de USDC a su unidad mínima (7 decimales).
fn usdc(n: i128) -> i128 {
    n * 10_000_000
}

/// Contexto de prueba con el contrato de préstamo listo y liquidez cargada.
struct Ctx<'a> {
    env: Env,
    loan: LoanContractClient<'a>,
    token: TokenClient<'a>,
    token_admin: StellarAssetClient<'a>,
    loan_id: Address,
    admin: Address,
}

fn setup() -> Ctx<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(T0);

    let admin = Address::generate(&env);

    // Token USDC de prueba (Stellar Asset Contract).
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_id = sac.address();
    let token = TokenClient::new(&env, &token_id);
    let token_admin = StellarAssetClient::new(&env, &token_id);

    // Contrato de préstamo.
    let loan_id = env.register(LoanContract, ());
    let loan = LoanContractClient::new(&env, &loan_id);
    loan.init(&admin, &token_id);

    // Liquidez para desembolsos.
    token_admin.mint(&loan_id, &usdc(5_000));

    Ctx {
        env,
        loan,
        token,
        token_admin,
        loan_id,
        admin,
    }
}

/// Registra y conecta un contrato de historial al contrato de préstamo.
fn with_history(ctx: &Ctx) -> history::HistoryContractClient<'static> {
    let history_id = ctx.env.register(history::HistoryContract, ());
    let history = history::HistoryContractClient::new(&ctx.env, &history_id);
    history.init(&ctx.admin, &ctx.loan_id);
    ctx.loan.set_history(&history_id);
    history
}

#[test]
fn flujo_pago_normal_recupera_toda_la_garantia() {
    let ctx = setup();
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(1_100)); // 1000 garantía + 80 interés

    // Deposita 1000 de garantía (lo firma el propio estudiante).
    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    assert!(ctx
        .env
        .auths()
        .iter()
        .any(|(addr, _)| addr == &estudiante));

    // La plataforma abre el préstamo: 800 (80%), 10% de interés, 4 cuotas.
    ctx.loan.open_loan(&estudiante, &usdc(800), &4, &1_000);
    // Control de acceso: abrir el préstamo exige la firma del admin.
    assert!(ctx.env.auths().iter().any(|(addr, _)| addr == &ctx.admin));

    let prestamo = ctx.loan.get_loan(&estudiante).unwrap();
    assert_eq!(prestamo.principal, usdc(800));
    assert_eq!(prestamo.total_due, usdc(880)); // 800 + 10%
    assert_eq!(prestamo.installment_amount, usdc(220));
    assert_eq!(prestamo.status, LoanStatus::Active);
    // El estudiante recibió el principal.
    assert_eq!(ctx.token.balance(&estudiante), usdc(900)); // 100 + 800

    // Paga las 4 cuotas de 220.
    for _ in 0..4 {
        ctx.loan.repay(&estudiante, &usdc(220));
    }

    let prestamo = ctx.loan.get_loan(&estudiante).unwrap();
    assert_eq!(prestamo.status, LoanStatus::Completed);
    assert_eq!(prestamo.total_repaid, usdc(880));
    assert_eq!(prestamo.collateral_released, usdc(1_000));
    // Recuperó toda la garantía; solo perdió los 80 de interés.
    assert_eq!(ctx.token.balance(&estudiante), usdc(1_020));
}

#[test]
fn pago_parcial_libera_garantia_proporcional() {
    let ctx = setup();
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(1_100));

    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    ctx.loan.open_loan(&estudiante, &usdc(800), &4, &1_000);

    // Paga la mitad de la deuda (440 de 880).
    ctx.loan.repay(&estudiante, &usdc(440));

    let prestamo = ctx.loan.get_loan(&estudiante).unwrap();
    assert_eq!(prestamo.status, LoanStatus::Active);
    assert_eq!(prestamo.total_repaid, usdc(440));
    assert_eq!(prestamo.paid_installments, 2);
    // Garantía liberada = 1000 * 440/880 = 500.
    assert_eq!(prestamo.collateral_released, usdc(500));
}

#[test]
fn pago_atrasado_se_registra_en_el_historial() {
    let ctx = setup();
    let history = with_history(&ctx);
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(1_100));

    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    ctx.loan.open_loan(&estudiante, &usdc(800), &4, &1_000);

    // Avanzamos el tiempo más allá del vencimiento de la primera cuota.
    ctx.env
        .ledger()
        .set_timestamp(T0 + SECONDS_PER_MONTH + 1);

    // Paga la primera cuota, pero tarde.
    ctx.loan.repay(&estudiante, &usdc(220));

    let record = history.get_record(&estudiante);
    assert_eq!(record.on_time, 0);
    assert_eq!(record.late, 1);
    // Puntaje: 500 - 40 = 460.
    assert_eq!(history.score(&estudiante), 460);
}

#[test]
fn pago_a_tiempo_emite_credencial() {
    let ctx = setup();
    let history = with_history(&ctx);
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(1_100));

    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    ctx.loan.open_loan(&estudiante, &usdc(800), &4, &1_000);

    // Paga todo de una, dentro de plazo (no avanzamos el tiempo).
    ctx.loan.repay(&estudiante, &usdc(880));

    let record = history.get_record(&estudiante);
    assert_eq!(record.on_time, 4);
    assert_eq!(record.late, 0);

    assert!(history.has_credential(&estudiante));
    let credencial = history.get_credential(&estudiante).unwrap();
    assert_eq!(credencial.borrower, estudiante);
    assert_eq!(credencial.total_installments, 4);
    assert_eq!(credencial.on_time, 4);
}

#[test]
fn liquidacion_toma_solo_lo_adeudado_y_devuelve_el_resto() {
    let ctx = setup();
    let history = with_history(&ctx);
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(1_000)); // solo para la garantía

    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    ctx.loan.open_loan(&estudiante, &usdc(800), &4, &1_000);
    // El estudiante tiene 800 (el principal) y nunca paga.
    assert_eq!(ctx.token.balance(&estudiante), usdc(800));

    // Pasa el vencimiento de la primera cuota sin pagar: cae en mora.
    ctx.env
        .ledger()
        .set_timestamp(T0 + SECONDS_PER_MONTH + 1);

    ctx.loan.liquidate(&estudiante);
    // Control de acceso: liquidar exige la firma del admin.
    assert!(ctx.env.auths().iter().any(|(addr, _)| addr == &ctx.admin));

    let prestamo = ctx.loan.get_loan(&estudiante).unwrap();
    assert_eq!(prestamo.status, LoanStatus::Liquidated);

    // El admin recupera lo adeudado (880) de la garantía.
    assert_eq!(ctx.token.balance(&ctx.admin), usdc(880));
    // El estudiante conserva el principal (800) + el resto de la garantía
    // (1000 - 880 = 120) = 920.
    assert_eq!(ctx.token.balance(&estudiante), usdc(920));

    // Las 4 cuotas impagas quedan como atrasadas en el historial.
    let record = history.get_record(&estudiante);
    assert_eq!(record.late, 4);
}

#[test]
#[should_panic]
fn no_se_puede_liquidar_sin_mora() {
    let ctx = setup();
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(1_000));

    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    ctx.loan.open_loan(&estudiante, &usdc(800), &4, &1_000);

    // Sin avanzar el tiempo: la primera cuota aún no vence. Debe fallar.
    ctx.loan.liquidate(&estudiante);
}

#[test]
#[should_panic]
fn principal_no_puede_superar_el_80_por_ciento() {
    let ctx = setup();
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(1_000));

    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    // 900 > 80% de 1000: debe fallar (PrincipalExcedeLimite).
    ctx.loan.open_loan(&estudiante, &usdc(900), &4, &1_000);
}

#[test]
#[should_panic]
fn no_se_puede_pagar_de_mas() {
    let ctx = setup();
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(2_000));

    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    ctx.loan.open_loan(&estudiante, &usdc(800), &4, &1_000);
    // La deuda es 880; pagar 900 debe fallar (ExcedeDeuda).
    ctx.loan.repay(&estudiante, &usdc(900));
}

#[test]
fn el_pago_exige_la_firma_del_estudiante() {
    let ctx = setup();
    let estudiante = Address::generate(&ctx.env);
    ctx.token_admin.mint(&estudiante, &usdc(1_100));

    ctx.loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_000));
    ctx.loan.open_loan(&estudiante, &usdc(800), &4, &1_000);

    ctx.loan.repay(&estudiante, &usdc(220));
    // Control de acceso: el pago lo firma el estudiante, no el admin.
    assert!(ctx
        .env
        .auths()
        .iter()
        .any(|(addr, _)| addr == &estudiante));
}
