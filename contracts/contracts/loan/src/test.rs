//! Pruebas del contrato de préstamo, integradas con `history`.
#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{storage::Persistent as _, Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};
use std::vec::Vec;

const T0: u64 = 1_700_000_000;
/// Periodo mensual (30 días).
const MES: u64 = 2_592_000;

/// Unidad mínima de USDC (7 decimales).
fn usdc(n: i128) -> i128 {
    n * 10_000_000
}

/// Parámetros de producción del modelo de negocio.
fn params() -> LoanParams {
    LoanParams {
        max_ltv_bps: 8_000,
        rate_bps: 800,
        origination_fee_bps: 100,
        late_fee_bps: 200,
        yield_share_platform_bps: 2_500,
        grace_seconds: MES,
        min_principal: usdc(100),
        max_principal: usdc(3_000),
        max_installments: 12,
    }
}

struct Ctx<'a> {
    env: Env,
    loan: LoanContractClient<'a>,
    history: history::HistoryContractClient<'a>,
    token: TokenClient<'a>,
    token_admin: StellarAssetClient<'a>,
    loan_addr: Address,
    admin: Address,
    operator: Address,
    treasury: Address,
}

fn setup() -> Ctx<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(T0);

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let treasury = Address::generate(&env);

    let usdc_addr = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token = TokenClient::new(&env, &usdc_addr);
    let token_admin = StellarAssetClient::new(&env, &usdc_addr);

    let history_addr = env.register(history::HistoryContract, ());
    let loan_addr = env.register(LoanContract, ());
    let history = history::HistoryContractClient::new(&env, &history_addr);
    let loan = LoanContractClient::new(&env, &loan_addr);

    history.initialize(&admin, &loan_addr);
    loan.initialize(&admin, &treasury, &history_addr, &usdc_addr, &params());
    loan.set_operator(&operator, &true);

    // Pool: la treasury tiene 100.000 USDC y autoriza al contrato a desembolsar.
    token_admin.mint(&treasury, &usdc(100_000));
    token.approve(
        &treasury,
        &loan_addr,
        &usdc(100_000),
        &(env.ledger().sequence() + 100_000),
    );

    Ctx {
        env,
        loan,
        history,
        token,
        token_admin,
        loan_addr,
        admin,
        operator,
        treasury,
    }
}

impl Ctx<'_> {
    /// Cuenta nueva con saldo de USDC.
    fn cuenta(&self, saldo: i128) -> Address {
        let a = Address::generate(&self.env);
        if saldo > 0 {
            self.token_admin.mint(&a, &saldo);
        }
        a
    }

    /// Abre un préstamo mensual con la primera cuota en un mes.
    fn abrir(&self, posicion: u64, capital: i128, cuotas: u32) -> u64 {
        self.loan
            .open_loan(&self.operator, &posicion, &capital, &cuotas, &(T0 + MES), &MES)
    }

    /// Paga la próxima cuota completa (interés pendiente + capital de la cuota).
    fn pagar_cuota(&self, pagador: &Address, loan_id: u64) -> PaymentQuote {
        let q = self.loan.quote_next_payment(&loan_id);
        self.loan
            .repay(pagador, &loan_id, &q.next_installment_principal, &q.interest_due);
        q
    }

    fn ir_a(&self, ts: u64) {
        self.env.ledger().set_timestamp(ts);
    }
}

// ---------------------------------------------------------------------------
// Pruebas obligatorias
// ---------------------------------------------------------------------------

/// Garantía 1.250, préstamo 1.000, 10 cuotas de 100 de capital:
/// interés total 36,67; comisión 10; cada pago libera 125.
#[test]
fn ejemplo_de_referencia_exacto() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(1_250));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);

    // Pide 1.000 y recibe 990; la comisión de 10 se queda en la treasury.
    assert_eq!(ctx.token.balance(&estudiante), usdc(990));
    assert_eq!(ctx.token.balance(&ctx.treasury), usdc(100_000) - usdc(990));
    let l = ctx.loan.get_loan(&id).unwrap();
    assert_eq!((l.origination_fee, l.disbursed), (usdc(10), usdc(990)));

    // El estudiante necesita USDC para los intereses (36,67 en total).
    ctx.token_admin.mint(&estudiante, &usdc(100));
    let antes = ctx.token.balance(&estudiante);

    let mut interes_total = 0;
    for k in 0..10u64 {
        // Cada cuota se paga dentro de su periodo (a tiempo).
        ctx.ir_a(T0 + k * MES + 1);
        let q = ctx.pagar_cuota(&estudiante, id);
        assert_eq!(q.next_installment_principal, usdc(100));
        interes_total += q.interest_due;

        let l = ctx.loan.get_loan(&id).unwrap();
        // Cada pago de 100 de capital libera exactamente 125.
        assert_eq!(l.collateral_released, usdc(125) * (k as i128 + 1));
    }

    // Interés: 8% anual / 12 sobre saldos 1.000, 900, …, 100 = 36,6666663.
    assert_eq!(interes_total, 366_666_663);
    // Pagó 1.000 de capital + interés y recuperó los 1.250 de garantía.
    assert_eq!(
        ctx.token.balance(&estudiante),
        antes - usdc(1_000) - interes_total + usdc(1_250)
    );
    // La treasury recuperó lo desembolsado + comisión + interés.
    assert_eq!(
        ctx.token.balance(&ctx.treasury),
        usdc(100_000) + usdc(10) + interes_total
    );
    let l = ctx.loan.get_loan(&id).unwrap();
    assert_eq!(l.status, LoanStatus::Repaid);
    assert_eq!(ctx.token.balance(&ctx.loan_addr), 0);

    // Saldado con 10 cuotas a tiempo: credencial y puntaje 700.
    assert!(ctx.history.verify(&estudiante));
    assert_eq!(ctx.history.get_score(&estudiante), 700);
}

#[test]
fn el_ultimo_pago_libera_el_remanente() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(2_000));
    // Garantía "impar" para forzar redondeo.
    let garantia = usdc(1_000) + 7;
    let pos = ctx.loan.deposit_collateral(&estudiante, &estudiante, &garantia);
    let capital = usdc(800);
    let id = ctx.abrir(pos, capital, 3);
    let por_cuota = capital / 3;

    ctx.pagar_cuota(&estudiante, id);
    let l = ctx.loan.get_loan(&id).unwrap();
    assert_eq!(l.collateral_released, por_cuota * garantia / capital);

    ctx.ir_a(T0 + MES + 1);
    ctx.pagar_cuota(&estudiante, id);
    let l = ctx.loan.get_loan(&id).unwrap();
    // Acumulado, sin deriva por redondeos sucesivos.
    assert_eq!(l.collateral_released, 2 * por_cuota * garantia / capital);

    ctx.ir_a(T0 + 2 * MES + 1);
    let q = ctx.pagar_cuota(&estudiante, id);
    assert_eq!(q.next_installment_principal, capital - 2 * por_cuota);
    let l = ctx.loan.get_loan(&id).unwrap();
    assert_eq!(l.collateral_released, garantia);
    assert_eq!(ctx.token.balance(&ctx.loan_addr), 0);
    assert_eq!(ctx.loan.get_position(&pos).unwrap().status, PositionStatus::Closed);
}

#[test]
fn rechaza_ltv_mayor_al_80_por_ciento() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(1_250));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));

    let res = ctx
        .loan
        .try_open_loan(&ctx.operator, &pos, &(usdc(1_000) + 1), &10, &(T0 + MES), &MES);
    assert_eq!(res, Err(Ok(Error::ExcedeLtv.into())));
    // Exactamente el 80% sí se permite.
    ctx.abrir(pos, usdc(1_000), 10);
}

#[test]
fn rechaza_montos_y_cuotas_fuera_de_limites() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(5_000));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(5_000));
    let fuera = Some(Ok(Error::FueraDeLimites.into()));
    let abrir = |capital: i128, cuotas: u32| {
        ctx.loan
            .try_open_loan(&ctx.operator, &pos, &capital, &cuotas, &(T0 + MES), &MES)
            .err()
    };

    assert_eq!(abrir(usdc(100) - 1, 1), fuera); // menos de 100
    assert_eq!(abrir(usdc(3_000) + 1, 12), fuera); // más de 3.000
    assert_eq!(abrir(usdc(1_000), 13), fuera); // más de 12 cuotas
    assert_eq!(abrir(usdc(1_000), 0), fuera);
    // Los extremos son válidos.
    assert_eq!(abrir(usdc(3_000), 12), None);
}

#[test]
fn la_comision_se_descuenta_del_desembolso() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(500));
    let pos = ctx.loan.deposit_collateral(&estudiante, &estudiante, &usdc(500));
    let id = ctx.abrir(pos, usdc(400), 4);

    // 1% de 400 = 4: recibe 396 y la treasury solo entrega 396.
    assert_eq!(ctx.token.balance(&estudiante), usdc(396));
    assert_eq!(ctx.token.balance(&ctx.treasury), usdc(100_000) - usdc(396));
    // Pero adeuda los 400 completos.
    assert_eq!(
        ctx.loan.quote_next_payment(&id).principal_outstanding,
        usdc(400)
    );
}

#[test]
fn solo_acepta_usdc_como_garantia() {
    let ctx = setup();
    // Otro token cualquiera.
    let otro = ctx
        .env
        .register_stellar_asset_contract_v2(Address::generate(&ctx.env))
        .address();
    let depositante = Address::generate(&ctx.env);
    StellarAssetClient::new(&ctx.env, &otro).mint(&depositante, &usdc(1_000));

    // deposit_collateral no recibe activo: siempre mueve el USDC configurado.
    // Sin USDC, el depósito falla aunque tenga otro token.
    assert!(ctx
        .loan
        .try_deposit_collateral(&depositante, &depositante, &usdc(1_000))
        .is_err());

    // Enviar otro token directamente al contrato no crea garantía.
    TokenClient::new(&ctx.env, &otro).transfer(&depositante, &ctx.loan_addr, &usdc(1_000));
    assert_eq!(ctx.loan.get_position(&1), None);
    assert_eq!(ctx.loan.get_usdc(), ctx.token.address);
}

#[test]
fn liquidacion_falla_antes_de_la_gracia_y_funciona_despues() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(1_250));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);
    let tesoreria_antes = ctx.token.balance(&ctx.treasury);

    // Antes del vencimiento.
    let res = ctx.loan.try_liquidate(&ctx.operator, &id);
    assert_eq!(res, Err(Ok(Error::SinMora.into())));
    // Vencida pero en el último segundo de la gracia.
    ctx.ir_a(T0 + MES + MES);
    assert!(ctx.loan.is_overdue(&id));
    let res = ctx.loan.try_liquidate(&ctx.operator, &id);
    assert_eq!(res, Err(Ok(Error::SinMora.into())));
    // Pasada la gracia, un tercero igual no puede liquidar.
    ctx.ir_a(T0 + MES + MES + 1);
    let res = ctx.loan.try_liquidate(&estudiante, &id);
    assert_eq!(res, Err(Ok(Error::NoAutorizado.into())));

    let q = ctx.loan.quote_next_payment(&id);
    assert!(q.liquidatable);
    ctx.loan.liquidate(&ctx.admin, &id);

    // 3 periodos devengados sobre 1.000 (al abrir, al vencer la cuota 1 y la 2).
    let interes = 3 * (usdc(1_000) * 800 / 10_000 / 12);
    // Vencidas las cuotas 1 y 2: recargo del 2% sobre 200 de capital + interés.
    let recargo = (usdc(200) + interes) * 200 / 10_000;
    assert_eq!(q.late_fee, recargo);
    let adeudado = usdc(1_000) + interes + recargo;
    assert_eq!(ctx.token.balance(&ctx.treasury), tesoreria_antes + adeudado);
    assert_eq!(ctx.token.balance(&estudiante), usdc(990) + usdc(1_250) - adeudado);
    assert_eq!(ctx.token.balance(&ctx.loan_addr), 0);
    assert_eq!(ctx.loan.get_loan(&id).unwrap().status, LoanStatus::Liquidated);
    assert_eq!(ctx.history.get_record(&estudiante).defaults, 1);
}

#[test]
fn liquidacion_devuelve_el_remanente_al_garante() {
    let ctx = setup();
    // Demo de testnet: gracia de 120 s y periodos de 60 s.
    let mut p = params();
    p.grace_seconds = 120;
    ctx.loan.set_params(&p);

    let estudiante = ctx.cuenta(0);
    let garante = ctx.cuenta(usdc(1_250));
    let pos = ctx.loan.deposit_collateral(&garante, &estudiante, &usdc(1_250));
    let id = ctx
        .loan
        .open_loan(&ctx.operator, &pos, &usdc(1_000), &10, &(T0 + 60), &60);
    let tesoreria_antes = ctx.token.balance(&ctx.treasury);

    ctx.ir_a(T0 + 60 + 121);
    ctx.loan.liquidate(&ctx.operator, &id);

    let tomado = ctx.token.balance(&ctx.treasury) - tesoreria_antes;
    assert!(tomado > usdc(1_000));
    // El remanente vuelve a quien depositó (el garante), no al estudiante.
    assert_eq!(ctx.token.balance(&garante), usdc(1_250) - tomado);
    assert_eq!(ctx.token.balance(&estudiante), usdc(990));
}

#[test]
fn la_pausa_global_bloquea_las_operaciones() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(2_500));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);
    let q = ctx.loan.quote_next_payment(&id);

    ctx.loan.pause();
    let pausado = Some(Ok(Error::Pausado.into()));
    assert_eq!(
        ctx.loan
            .try_deposit_collateral(&estudiante, &estudiante, &usdc(10))
            .err(),
        pausado
    );
    assert_eq!(
        ctx.loan
            .try_repay(&estudiante, &id, &q.next_installment_principal, &q.interest_due)
            .err(),
        pausado
    );
    assert_eq!(ctx.loan.try_liquidate(&ctx.admin, &id).err(), pausado);

    ctx.loan.unpause();
    ctx.pagar_cuota(&estudiante, id);
}

// ---------------------------------------------------------------------------
// Pruebas adicionales
// ---------------------------------------------------------------------------

#[test]
fn abrir_exige_operator_y_firma_del_prestatario() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(1_250));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));

    let intruso = Address::generate(&ctx.env);
    let res = ctx
        .loan
        .try_open_loan(&intruso, &pos, &usdc(500), &5, &(T0 + MES), &MES);
    assert_eq!(res, Err(Ok(Error::NoAutorizado.into())));

    ctx.abrir(pos, usdc(500), 5);
    let firmantes: Vec<Address> = ctx.env.auths().iter().map(|(a, _)| a.clone()).collect();
    assert!(firmantes.contains(&ctx.operator));
    assert!(firmantes.contains(&estudiante));

    // Un operator deshabilitado ya no lo es.
    ctx.loan.set_operator(&ctx.operator, &false);
    assert!(!ctx.loan.is_operator(&ctx.operator));
}

#[test]
fn el_interes_se_paga_antes_que_el_capital() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(1_250));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);

    let res = ctx.loan.try_repay(&estudiante, &id, &usdc(100), &0);
    assert_eq!(res, Err(Ok(Error::InteresPendiente.into())));

    // Pagar solo interés es válido y no libera garantía.
    let q = ctx.loan.quote_next_payment(&id);
    ctx.loan.repay(&estudiante, &id, &0, &q.interest_due);
    assert_eq!(ctx.loan.get_loan(&id).unwrap().collateral_released, 0);
    assert_eq!(ctx.loan.quote_next_payment(&id).interest_due, 0);
}

#[test]
fn no_se_puede_pagar_de_mas() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(2_500));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);
    let q = ctx.loan.quote_next_payment(&id);

    let res = ctx
        .loan
        .try_repay(&estudiante, &id, &(usdc(1_000) + 1), &q.interest_due);
    assert_eq!(res, Err(Ok(Error::ExcedeDeuda.into())));
    let res = ctx.loan.try_repay(&estudiante, &id, &0, &(q.interest_due + 1));
    assert_eq!(res, Err(Ok(Error::ExcedeDeuda.into())));
}

#[test]
fn pago_atrasado_se_registra_en_el_historial() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(1_400));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);

    ctx.ir_a(T0 + MES + 10);
    ctx.pagar_cuota(&estudiante, id);
    let r = ctx.history.get_record(&estudiante);
    assert_eq!((r.on_time, r.late), (0, 1));
}

#[test]
fn retiro_de_garantia_sin_usar() {
    let ctx = setup();
    let garante = ctx.cuenta(usdc(1_250));
    let estudiante = ctx.cuenta(0);
    let pos = ctx.loan.deposit_collateral(&garante, &estudiante, &usdc(625));

    // Solo el depositante puede retirar.
    let res = ctx.loan.try_withdraw_unused(&estudiante, &pos);
    assert_eq!(res, Err(Ok(Error::NoAutorizado.into())));
    ctx.loan.withdraw_unused(&garante, &pos);
    assert_eq!(ctx.token.balance(&garante), usdc(1_250));

    // Con el préstamo abierto, ya no se puede retirar.
    let pos2 = ctx.loan.deposit_collateral(&garante, &estudiante, &usdc(625));
    ctx.abrir(pos2, usdc(500), 5);
    let res = ctx.loan.try_withdraw_unused(&garante, &pos2);
    assert_eq!(res, Err(Ok(Error::EstadoInvalido.into())));
}

#[test]
fn los_parametros_nuevos_no_cambian_prestamos_abiertos() {
    let ctx = setup();
    let estudiante = ctx.cuenta(usdc(1_250));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);

    let mut p = params();
    p.rate_bps = 2_000;
    ctx.loan.set_params(&p);
    assert_eq!(ctx.loan.get_params().rate_bps, 2_000);
    assert_eq!(ctx.loan.get_loan(&id).unwrap().terms.rate_bps, 800);

    // Parámetros inválidos se rechazan.
    p.min_principal = usdc(5_000);
    assert_eq!(
        ctx.loan.try_set_params(&p),
        Err(Ok(Error::ParametrosInvalidos.into()))
    );
}

#[test]
fn solo_el_admin_configura() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let loan_addr = env.register(LoanContract, ());
    let loan = LoanContractClient::new(&env, &loan_addr);
    loan.initialize(
        &admin,
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &params(),
    );
    // Sin firmas simuladas, ningún cambio de configuración pasa.
    assert!(loan.try_pause().is_err());
    assert!(loan.try_set_params(&params()).is_err());
    assert!(loan
        .try_set_operator(&Address::generate(&env), &true)
        .is_err());
}

#[test]
fn sin_liquidez_en_el_pool_no_se_abre() {
    let ctx = setup();
    // La treasury retira su allowance: el pool queda sin capacidad.
    ctx.token.approve(&ctx.treasury, &ctx.loan_addr, &0, &0);
    assert_eq!(ctx.loan.pool_available(), 0);

    let estudiante = ctx.cuenta(usdc(1_250));
    let pos = ctx
        .loan
        .deposit_collateral(&estudiante, &estudiante, &usdc(1_250));
    let res = ctx
        .loan
        .try_open_loan(&ctx.operator, &pos, &usdc(1_000), &10, &(T0 + MES), &MES);
    assert_eq!(res, Err(Ok(Error::PoolInsuficiente.into())));
}

// ---------------------------------------------------------------------------
// Vida (TTL) del almacenamiento
// ---------------------------------------------------------------------------

impl Ctx<'_> {
    /// Ledgers que le quedan de vida a una entrada del contrato de préstamo.
    fn ttl(&self, key: &DataKey) -> u32 {
        self.env
            .as_contract(&self.loan_addr, || self.env.storage().persistent().get_ttl(key))
    }

    fn avanzar_ledgers(&self, n: u32) {
        self.env.ledger().with_mut(|l| l.sequence_number += n);
    }
}

/// Un préstamo activo vive hasta su último vencimiento + gracia (con tope
/// en el máximo de la red), no solo 30 días.
#[test]
fn el_prestamo_activo_vive_hasta_su_ultimo_vencimiento() {
    let ctx = setup();
    let est = ctx.cuenta(usdc(1_250));
    let pos = ctx.loan.deposit_collateral(&est, &est, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);

    // Última cuota en T0 + 10 meses; gracia de 1 mes.
    let hasta_fin = ((10 * MES + MES) / SEGUNDOS_POR_LEDGER) as u32;
    let maximo = ctx.env.as_contract(&ctx.loan_addr, || ctx.env.storage().max_ttl());
    let esperado = (hasta_fin + TTL_EXTENDER_A).min(maximo);

    assert!(ctx.ttl(&DataKey::Loan(id)) >= esperado - 1);
    assert!(ctx.ttl(&DataKey::Position(pos)) >= esperado - 1);
    assert!(esperado > TTL_EXTENDER_A);
}

/// `bump` renueva la vida de un préstamo sin movimiento; cualquiera puede
/// llamarlo. A 12 cuotas la vida necesaria supera el máximo de la red, así
/// que queda topada y hay que renovarla con el tiempo.
#[test]
fn bump_renueva_la_vida_de_un_prestamo_sin_movimiento() {
    let ctx = setup();
    let est = ctx.cuenta(usdc(1_250));
    let pos = ctx.loan.deposit_collateral(&est, &est, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 12);
    let inicial = ctx.ttl(&DataKey::Loan(id));
    let maximo = ctx.env.as_contract(&ctx.loan_addr, || ctx.env.storage().max_ttl());
    assert_eq!(inicial, maximo);

    // Pasan 20 días sin pagos: la vida restante baja.
    ctx.avanzar_ledgers(20 * DIA_EN_LEDGERS);
    ctx.ir_a(T0 + 20 * 86_400);
    let antes = ctx.ttl(&DataKey::Loan(id));
    assert_eq!(antes, inicial - 20 * DIA_EN_LEDGERS);

    ctx.env.set_auths(&[]);
    ctx.loan.bump(&id);
    assert!(ctx.ttl(&DataKey::Loan(id)) > antes);
    assert!(ctx.ttl(&DataKey::Position(pos)) > antes);

    assert_eq!(ctx.loan.try_bump(&999), Err(Ok(Error::PrestamoNoExiste.into())));
}

/// Con la plataforma en pausa igual se puede renovar la vida.
#[test]
fn bump_funciona_en_pausa() {
    let ctx = setup();
    let est = ctx.cuenta(usdc(1_250));
    let pos = ctx.loan.deposit_collateral(&est, &est, &usdc(1_250));
    let id = ctx.abrir(pos, usdc(1_000), 10);
    ctx.loan.pause();
    ctx.loan.bump(&id);
}
