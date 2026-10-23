#![no_std]
//! Contrato de **Préstamo y Garantía** de PrimerPaso.
//!
//! PrimerPaso es el único prestamista. Todo se maneja en **USDC** y on-chain.
//!
//! Flujo (montos en la unidad mínima de USDC, 7 decimales):
//!
//! 1. Un **depositante** (el estudiante o su garante) bloquea garantía en
//!    USDC con [`LoanContract::deposit_collateral`] y obtiene una *posición*.
//! 2. Un **operator** y el **prestatario** firman [`LoanContract::open_loan`].
//!    El capital respeta el LTV y los límites de [`LoanParams`]. La
//!    **treasury** (pool) desembolsa `capital - comisión`; la comisión de
//!    originación se queda en la treasury. El desembolso usa una
//!    *allowance* que la treasury otorga a este contrato (`approve`).
//! 3. Interés simple sobre saldo, cobrado al inicio de cada periodo:
//!    `interés del periodo = saldo * rate_bps / 10000 / 12`.
//!    El interés pendiente se paga antes que el capital.
//! 4. Cada [`LoanContract::repay`] envía el USDC a la treasury y libera
//!    garantía al depositante en proporción al **capital** pagado:
//!    `liberada = capital_pagado * garantía_inicial / capital_inicial`; el
//!    último pago libera todo el remanente.
//! 5. Vencida una cuota y pasada la gracia, el admin o un operator puede
//!    [`LoanContract::liquidate`]: la treasury recibe capital pendiente +
//!    interés devengado + recargo, y el remanente vuelve al depositante.
//!
//! Invariante: `garantía bloqueada >= deuda / LTV`.
//! Sin datos personales en la cadena: solo direcciones y montos.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, Address, BytesN, ContractExecutable, Env,
};

const BPS: i128 = 10_000;
const MESES_POR_ANIO: i128 = 12;

const DIA_EN_LEDGERS: u32 = 17_280;
const TTL_EXTENDER_A: u32 = 30 * DIA_EN_LEDGERS;
const TTL_UMBRAL: u32 = TTL_EXTENDER_A - DIA_EN_LEDGERS;
/// Tiempo aproximado de cierre de un ledger.
const SEGUNDOS_POR_LEDGER: u64 = 5;

#[contractclient(name = "HistoryClient")]
pub trait HistoryInterface {
    fn record_payment(env: Env, borrower: Address, loan_id: u64, on_time: bool, settled: bool);
    fn record_default(env: Env, borrower: Address, loan_id: u64);
}

/// Parámetros globales de la plataforma (porcentajes en bps). Editables por
/// el admin; cada préstamo congela los suyos al abrirse.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanParams {
    /// Préstamo máximo respecto de la garantía (8000 = 80%).
    pub max_ltv_bps: u32,
    /// Tasa anual de interés simple sobre saldo (800 = 8%).
    pub rate_bps: u32,
    /// Comisión de originación, descontada del desembolso (100 = 1%).
    pub origination_fee_bps: u32,
    /// Recargo sobre lo vencido, cobrado en la liquidación (200 = 2%).
    pub late_fee_bps: u32,
    /// Fase 2: parte del rendimiento de la garantía para la plataforma.
    pub yield_share_platform_bps: u32,
    /// Gracia tras el vencimiento antes de poder liquidar, en segundos.
    pub grace_seconds: u64,
    /// Capital mínimo y máximo, en unidades mínimas de USDC.
    pub min_principal: i128,
    pub max_principal: i128,
    pub max_installments: u32,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PositionStatus {
    /// Garantía depositada, sin préstamo.
    Open,
    /// Garantía respaldando un préstamo.
    InUse,
    /// Garantía devuelta o tomada por completo.
    Closed,
}

/// Garantía bloqueada por un depositante a favor de un prestatario.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub id: u64,
    pub depositor: Address,
    pub borrower: Address,
    /// Monto depositado originalmente.
    pub amount: i128,
    /// Monto que sigue bloqueado en el contrato.
    pub locked: i128,
    pub loan_id: Option<u64>,
    pub status: PositionStatus,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LoanStatus {
    Active,
    Repaid,
    Liquidated,
}

/// Parámetros congelados al abrir el préstamo.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanTerms {
    pub max_ltv_bps: u32,
    pub rate_bps: u32,
    pub origination_fee_bps: u32,
    pub late_fee_bps: u32,
    pub grace_seconds: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Loan {
    pub id: u64,
    pub position_id: u64,
    pub borrower: Address,
    pub depositor: Address,
    /// Capital inicial (lo que se adeuda).
    pub principal: i128,
    /// Comisión de originación retenida en la treasury.
    pub origination_fee: i128,
    /// Lo que efectivamente recibió el prestatario.
    pub disbursed: i128,
    pub principal_paid: i128,
    /// Interés devengado acumulado (incluye el ya pagado).
    pub interest_accrued: i128,
    pub interest_paid: i128,
    pub collateral_initial: i128,
    pub collateral_released: i128,
    pub installments: u32,
    pub installments_paid: u32,
    /// Vencimiento de la primera cuota; la cuota k vence en
    /// `first_due_ts + (k - 1) * period_seconds`.
    pub first_due_ts: u64,
    pub period_seconds: u64,
    /// Periodos cuyo interés ya se devengó.
    pub periods_accrued: u32,
    pub opened_at: u64,
    pub terms: LoanTerms,
    pub status: LoanStatus,
}

/// Lo que se debe hoy, para mostrar en la UI.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentQuote {
    /// Interés devengado aún impago.
    pub interest_due: i128,
    pub principal_outstanding: i128,
    /// Capital que falta para completar la próxima cuota.
    pub next_installment_principal: i128,
    pub next_due_ts: u64,
    /// Capital de cuotas ya vencidas e impagas + interés pendiente.
    pub overdue_amount: i128,
    pub overdue: bool,
    /// Vencida y pasada la gracia: se puede liquidar.
    pub liquidatable: bool,
    /// Recargo que se cobraría en una liquidación hoy.
    pub late_fee: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Treasury,
    History,
    Usdc,
    Params,
    Paused,
    NextPositionId,
    NextLoanId,
    Operator(Address),
    Position(u64),
    Loan(u64),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    YaInicializado = 1,
    NoInicializado = 2,
    /// El contrato está en pausa.
    Pausado = 3,
    /// Quien firma no tiene permiso para esta operación.
    NoAutorizado = 4,
    PosicionNoExiste = 5,
    PrestamoNoExiste = 6,
    EstadoInvalido = 7,
    /// El capital supera el LTV máximo.
    ExcedeLtv = 8,
    /// Capital o número de cuotas fuera de los límites.
    FueraDeLimites = 9,
    ParametrosInvalidos = 10,
    MontoInvalido = 11,
    /// El pago supera lo adeudado.
    ExcedeDeuda = 12,
    /// Hay interés pendiente: debe pagarse antes que el capital.
    InteresPendiente = 13,
    /// La cuota no está vencida o la gracia no terminó.
    SinMora = 14,
    /// La treasury no tiene saldo o allowance suficiente.
    PoolInsuficiente = 15,
    InvarianteViolado = 16,
}

// --- Eventos ---

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollateralDeposited {
    #[topic]
    pub position_id: u64,
    #[topic]
    pub borrower: Address,
    pub depositor: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanOpened {
    #[topic]
    pub loan_id: u64,
    #[topic]
    pub borrower: Address,
    pub position_id: u64,
    pub depositor: Address,
    pub principal: i128,
    pub origination_fee: i128,
    pub disbursed: i128,
    pub collateral: i128,
    pub installments: u32,
    pub first_due_ts: u64,
    pub period_seconds: u64,
    pub rate_bps: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecorded {
    #[topic]
    pub loan_id: u64,
    #[topic]
    pub borrower: Address,
    pub payer: Address,
    pub principal: i128,
    pub interest: i128,
    pub on_time: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollateralReleased {
    #[topic]
    pub loan_id: u64,
    #[topic]
    pub depositor: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanRepaid {
    #[topic]
    pub loan_id: u64,
    #[topic]
    pub borrower: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanLiquidated {
    #[topic]
    pub loan_id: u64,
    #[topic]
    pub borrower: Address,
    pub principal_due: i128,
    pub interest_due: i128,
    pub late_fee: i128,
    /// Lo que efectivamente se tomó de la garantía para la treasury.
    pub taken: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollateralReturned {
    #[topic]
    pub position_id: u64,
    #[topic]
    pub depositor: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParamsUpdated {
    pub params: LoanParams,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OperatorChanged {
    #[topic]
    pub operator: Address,
    pub enabled: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PausedChanged {
    pub paused: bool,
}

#[contract]
pub struct LoanContract;

#[contractimpl]
impl LoanContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        treasury: Address,
        history: Address,
        usdc: Address,
        params: LoanParams,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::YaInicializado);
        }
        Self::validar_params(&env, &params);
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Treasury, &treasury);
        s.set(&DataKey::History, &history);
        s.set(&DataKey::Usdc, &usdc);
        s.set(&DataKey::Params, &params);
        s.set(&DataKey::Paused, &false);
        s.set(&DataKey::NextPositionId, &1u64);
        s.set(&DataKey::NextLoanId, &1u64);
        Self::extender_instancia(&env);
        ParamsUpdated { params }.publish(&env);
    }

    // --- Administración (solo admin) ---

    /// Cambia los parámetros globales. Los préstamos abiertos conservan los suyos.
    pub fn set_params(env: Env, params: LoanParams) {
        Self::require_admin(&env);
        Self::validar_params(&env, &params);
        env.storage().instance().set(&DataKey::Params, &params);
        ParamsUpdated { params }.publish(&env);
    }

    pub fn set_operator(env: Env, operator: Address, enabled: bool) {
        Self::require_admin(&env);
        let key = DataKey::Operator(operator.clone());
        if enabled {
            env.storage().persistent().set(&key, &true);
            Self::extender(&env, &key);
        } else {
            env.storage().persistent().remove(&key);
        }
        OperatorChanged { operator, enabled }.publish(&env);
    }

    pub fn set_treasury(env: Env, treasury: Address) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    pub fn pause(env: Env) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &true);
        PausedChanged { paused: true }.publish(&env);
    }

    pub fn unpause(env: Env) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &false);
        PausedChanged { paused: false }.publish(&env);
    }

    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        Self::require_admin(&env);
        env.deployer()
            .update_current_contract(ContractExecutable::Wasm(wasm_hash));
    }

    // --- Operación ---

    /// Bloquea garantía en USDC a favor de `borrower`. Firma el depositante
    /// (estudiante o garante). El único activo aceptado es el USDC
    /// configurado al inicializar.
    pub fn deposit_collateral(env: Env, depositor: Address, borrower: Address, amount: i128) -> u64 {
        depositor.require_auth();
        Self::require_not_paused(&env);
        if amount <= 0 {
            panic_with_error!(&env, Error::MontoInvalido);
        }
        Self::usdc(&env).transfer(&depositor, &env.current_contract_address(), &amount);

        let id = Self::siguiente_id(&env, DataKey::NextPositionId);
        let position = Position {
            id,
            depositor: depositor.clone(),
            borrower: borrower.clone(),
            amount,
            locked: amount,
            loan_id: None,
            status: PositionStatus::Open,
        };
        Self::guardar_posicion(&env, &position);
        CollateralDeposited {
            position_id: id,
            borrower,
            depositor,
            amount,
        }
        .publish(&env);
        id
    }

    /// Devuelve al depositante una garantía cuyo préstamo nunca se abrió.
    pub fn withdraw_unused(env: Env, depositor: Address, position_id: u64) {
        depositor.require_auth();
        Self::require_not_paused(&env);
        let mut position = Self::cargar_posicion(&env, position_id);
        if position.depositor != depositor {
            panic_with_error!(&env, Error::NoAutorizado);
        }
        if position.status != PositionStatus::Open {
            panic_with_error!(&env, Error::EstadoInvalido);
        }
        let monto = position.locked;
        Self::usdc(&env).transfer(&env.current_contract_address(), &depositor, &monto);
        position.locked = 0;
        position.status = PositionStatus::Closed;
        Self::guardar_posicion(&env, &position);
        CollateralReturned {
            position_id,
            depositor,
            amount: monto,
        }
        .publish(&env);
    }

    /// Abre un préstamo contra una posición. Firman un operator y el
    /// prestatario. La treasury desembolsa `capital - comisión`.
    pub fn open_loan(
        env: Env,
        operator: Address,
        position_id: u64,
        principal: i128,
        installments: u32,
        first_due_ts: u64,
        period_seconds: u64,
    ) -> u64 {
        operator.require_auth();
        Self::require_not_paused(&env);
        if !Self::is_operator(env.clone(), operator) {
            panic_with_error!(&env, Error::NoAutorizado);
        }
        let mut position = Self::cargar_posicion(&env, position_id);
        if position.status != PositionStatus::Open {
            panic_with_error!(&env, Error::EstadoInvalido);
        }
        position.borrower.require_auth();

        let p = Self::get_params(env.clone());
        let now = env.ledger().timestamp();
        if principal < p.min_principal
            || principal > p.max_principal
            || installments == 0
            || installments > p.max_installments
        {
            panic_with_error!(&env, Error::FueraDeLimites);
        }
        if period_seconds == 0 || first_due_ts <= now || principal < installments as i128 {
            panic_with_error!(&env, Error::ParametrosInvalidos);
        }
        // LTV: capital <= garantía * max_ltv_bps / 10000
        if principal * BPS > position.locked * p.max_ltv_bps as i128 {
            panic_with_error!(&env, Error::ExcedeLtv);
        }

        // Desembolso desde el pool: la comisión se queda en la treasury.
        let fee = principal * p.origination_fee_bps as i128 / BPS;
        let neto = principal - fee;
        let treasury = Self::read_treasury(&env);
        if Self::pool_available(env.clone()) < neto {
            panic_with_error!(&env, Error::PoolInsuficiente);
        }
        Self::usdc(&env).transfer_from(
            &env.current_contract_address(),
            &treasury,
            &position.borrower,
            &neto,
        );

        let id = Self::siguiente_id(&env, DataKey::NextLoanId);
        let mut loan = Loan {
            id,
            position_id,
            borrower: position.borrower.clone(),
            depositor: position.depositor.clone(),
            principal,
            origination_fee: fee,
            disbursed: neto,
            principal_paid: 0,
            interest_accrued: 0,
            interest_paid: 0,
            collateral_initial: position.locked,
            collateral_released: 0,
            installments,
            installments_paid: 0,
            first_due_ts,
            period_seconds,
            periods_accrued: 0,
            opened_at: now,
            terms: LoanTerms {
                max_ltv_bps: p.max_ltv_bps,
                rate_bps: p.rate_bps,
                origination_fee_bps: p.origination_fee_bps,
                late_fee_bps: p.late_fee_bps,
                grace_seconds: p.grace_seconds,
            },
            status: LoanStatus::Active,
        };
        // Devenga el interés del primer periodo.
        Self::devengar(&mut loan, now);
        Self::guardar_prestamo(&env, &loan);

        position.loan_id = Some(id);
        position.status = PositionStatus::InUse;
        Self::guardar_posicion(&env, &position);

        LoanOpened {
            loan_id: id,
            borrower: loan.borrower.clone(),
            position_id,
            depositor: loan.depositor.clone(),
            principal,
            origination_fee: fee,
            disbursed: neto,
            collateral: loan.collateral_initial,
            installments,
            first_due_ts,
            period_seconds,
            rate_bps: p.rate_bps,
        }
        .publish(&env);
        id
    }

    /// Paga interés y/o capital en USDC. Puede pagar el estudiante o su
    /// garante (firma quien paga). Todo va a la treasury; el capital libera
    /// garantía proporcional al depositante.
    pub fn repay(env: Env, payer: Address, loan_id: u64, principal: i128, interest: i128) {
        payer.require_auth();
        Self::require_not_paused(&env);
        let mut loan = Self::cargar_prestamo_activo(&env, loan_id);
        let now = env.ledger().timestamp();
        Self::devengar(&mut loan, now);

        if principal < 0 || interest < 0 || principal + interest == 0 {
            panic_with_error!(&env, Error::MontoInvalido);
        }
        let interes_pendiente = loan.interest_accrued - loan.interest_paid;
        if interest > interes_pendiente || principal > loan.principal - loan.principal_paid {
            panic_with_error!(&env, Error::ExcedeDeuda);
        }
        if principal > 0 && interest != interes_pendiente {
            panic_with_error!(&env, Error::InteresPendiente);
        }

        Self::usdc(&env).transfer(&payer, &Self::read_treasury(&env), &(principal + interest));

        let on_time = now <= Self::vencimiento_siguiente(&loan);
        loan.interest_paid += interest;
        loan.principal_paid += principal;
        let saldado = loan.principal_paid == loan.principal;

        // Cuotas completadas por el capital pagado; cada una va al historial.
        let previas = loan.installments_paid;
        let completas = if saldado {
            loan.installments
        } else {
            let por_cuota = loan.principal / loan.installments as i128;
            ((loan.principal_paid / por_cuota) as u32).min(loan.installments - 1)
        };
        loan.installments_paid = completas;
        let history = Self::history(&env);
        let mut k = previas + 1;
        while k <= completas {
            history.record_payment(
                &loan.borrower,
                &loan_id,
                &(now <= Self::vencimiento_cuota(&loan, k)),
                &(saldado && k == completas),
            );
            k += 1;
        }

        PaymentRecorded {
            loan_id,
            borrower: loan.borrower.clone(),
            payer,
            principal,
            interest,
            on_time,
        }
        .publish(&env);

        // Solo el capital libera garantía.
        let mut position = Self::cargar_posicion(&env, loan.position_id);
        let liberar = Self::garantia_objetivo(&loan, loan.principal_paid) - loan.collateral_released;
        if liberar > 0 {
            Self::usdc(&env).transfer(&env.current_contract_address(), &loan.depositor, &liberar);
            loan.collateral_released += liberar;
            position.locked -= liberar;
            CollateralReleased {
                loan_id,
                depositor: loan.depositor.clone(),
                amount: liberar,
            }
            .publish(&env);
        }

        // Invariante: bloqueado * LTV >= deuda * 10000.
        let deuda = loan.principal - loan.principal_paid;
        if position.locked * (loan.terms.max_ltv_bps as i128) < deuda * BPS {
            panic_with_error!(&env, Error::InvarianteViolado);
        }

        if saldado {
            loan.status = LoanStatus::Repaid;
            position.status = PositionStatus::Closed;
            LoanRepaid {
                loan_id,
                borrower: loan.borrower.clone(),
            }
            .publish(&env);
        }
        Self::guardar_posicion(&env, &position);
        Self::guardar_prestamo(&env, &loan);
    }

    /// Ejecuta la garantía de un préstamo vencido y fuera de gracia.
    /// Puede llamarlo el admin o un operator.
    pub fn liquidate(env: Env, caller: Address, loan_id: u64) {
        caller.require_auth();
        Self::require_not_paused(&env);
        if caller != Self::read_admin(&env) && !Self::is_operator(env.clone(), caller) {
            panic_with_error!(&env, Error::NoAutorizado);
        }
        let mut loan = Self::cargar_prestamo_activo(&env, loan_id);
        let now = env.ledger().timestamp();
        if now <= Self::vencimiento_siguiente(&loan) + loan.terms.grace_seconds {
            panic_with_error!(&env, Error::SinMora);
        }
        Self::devengar(&mut loan, now);

        let principal_due = loan.principal - loan.principal_paid;
        let interest_due = loan.interest_accrued - loan.interest_paid;
        let late_fee = Self::recargo(&loan, now);
        let adeudado = principal_due + interest_due + late_fee;

        let mut position = Self::cargar_posicion(&env, loan.position_id);
        let bloqueado = position.locked;
        let tomar = adeudado.min(bloqueado);
        let devolver = bloqueado - tomar;

        let usdc = Self::usdc(&env);
        if tomar > 0 {
            usdc.transfer(&env.current_contract_address(), &Self::read_treasury(&env), &tomar);
        }
        if devolver > 0 {
            usdc.transfer(&env.current_contract_address(), &position.depositor, &devolver);
        }

        position.locked = 0;
        position.status = PositionStatus::Closed;
        Self::guardar_posicion(&env, &position);

        loan.collateral_released = loan.collateral_initial;
        loan.status = LoanStatus::Liquidated;
        Self::guardar_prestamo(&env, &loan);

        Self::history(&env).record_default(&loan.borrower, &loan_id);

        LoanLiquidated {
            loan_id,
            borrower: loan.borrower.clone(),
            principal_due,
            interest_due,
            late_fee,
            taken: tomar,
        }
        .publish(&env);
        if devolver > 0 {
            CollateralReturned {
                position_id: position.id,
                depositor: position.depositor,
                amount: devolver,
            }
            .publish(&env);
        }
    }

    /// Renueva la vida (TTL) de un préstamo y su garantía para que no se
    /// archiven mientras siga activo. Cualquiera puede llamarlo; no cambia
    /// ningún dato. Funciona también con la plataforma en pausa.
    pub fn bump(env: Env, loan_id: u64) {
        let loan: Loan = env
            .storage()
            .persistent()
            .get(&DataKey::Loan(loan_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::PrestamoNoExiste));
        Self::extender_prestamo(&env, &loan);
        Self::extender_instancia(&env);
    }

    // --- Lecturas ---

    pub fn get_loan(env: Env, loan_id: u64) -> Option<Loan> {
        env.storage().persistent().get(&DataKey::Loan(loan_id))
    }

    pub fn get_position(env: Env, position_id: u64) -> Option<Position> {
        env.storage()
            .persistent()
            .get(&DataKey::Position(position_id))
    }

    pub fn get_params(env: Env) -> LoanParams {
        env.storage()
            .instance()
            .get(&DataKey::Params)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NoInicializado))
    }

    /// Garantía que se liberaría si hoy se pagara `principal` de capital.
    pub fn quote_release(env: Env, loan_id: u64, principal: i128) -> i128 {
        let loan = Self::cargar_prestamo_activo(&env, loan_id);
        let pagado = (loan.principal_paid + principal).min(loan.principal);
        Self::garantia_objetivo(&loan, pagado) - loan.collateral_released
    }

    /// Lo que se adeuda hoy: interés devengado, capital de la próxima cuota,
    /// lo vencido y si ya se puede liquidar.
    pub fn quote_next_payment(env: Env, loan_id: u64) -> PaymentQuote {
        let mut loan = Self::cargar_prestamo_activo(&env, loan_id);
        let now = env.ledger().timestamp();
        Self::devengar(&mut loan, now);
        let vence = Self::vencimiento_siguiente(&loan);
        let objetivo_cuota = Self::capital_acumulado_cuota(&loan, loan.installments_paid + 1);
        PaymentQuote {
            interest_due: loan.interest_accrued - loan.interest_paid,
            principal_outstanding: loan.principal - loan.principal_paid,
            next_installment_principal: objetivo_cuota - loan.principal_paid,
            next_due_ts: vence,
            overdue_amount: Self::vencido(&loan, now),
            overdue: now > vence,
            liquidatable: now > vence + loan.terms.grace_seconds,
            late_fee: Self::recargo(&loan, now),
        }
    }

    /// ¿La próxima cuota impaga ya venció? (sin contar la gracia)
    pub fn is_overdue(env: Env, loan_id: u64) -> bool {
        match Self::get_loan(env.clone(), loan_id) {
            Some(loan) if loan.status == LoanStatus::Active => {
                env.ledger().timestamp() > Self::vencimiento_siguiente(&loan)
            }
            _ => false,
        }
    }

    /// USDC que el pool puede desembolsar hoy: el menor entre el saldo de
    /// la treasury y la allowance que otorgó a este contrato.
    pub fn pool_available(env: Env) -> i128 {
        let usdc = Self::usdc(&env);
        let treasury = Self::read_treasury(&env);
        let saldo = usdc.balance(&treasury);
        let allowance = usdc.allowance(&treasury, &env.current_contract_address());
        saldo.min(allowance)
    }

    pub fn is_operator(env: Env, operator: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Operator(operator))
            .unwrap_or(false)
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn get_admin(env: Env) -> Address {
        Self::read_admin(&env)
    }

    pub fn get_treasury(env: Env) -> Address {
        Self::read_treasury(&env)
    }

    pub fn get_usdc(env: Env) -> Address {
        Self::usdc_address(&env)
    }

    // --- Lógica interna ---

    fn validar_params(env: &Env, p: &LoanParams) {
        let bps = BPS as u32;
        let ok = p.max_ltv_bps > 0
            && p.max_ltv_bps <= bps
            && p.rate_bps <= bps
            && p.origination_fee_bps < bps
            && p.late_fee_bps <= bps
            && p.yield_share_platform_bps <= bps
            && p.min_principal > 0
            && p.min_principal <= p.max_principal
            && p.max_installments > 0;
        if !ok {
            panic_with_error!(env, Error::ParametrosInvalidos);
        }
    }

    /// Periodos iniciados a la fecha `now`. El primero empieza al abrir; el
    /// periodo k+1 empieza apenas vence la cuota k.
    fn periodos_iniciados(loan: &Loan, now: u64) -> u64 {
        if now <= loan.first_due_ts {
            1
        } else {
            2 + (now - loan.first_due_ts - 1) / loan.period_seconds
        }
    }

    /// Cuotas cuyo vencimiento ya pasó a la fecha `now`.
    fn cuotas_vencidas(loan: &Loan, now: u64) -> u32 {
        let n = Self::periodos_iniciados(loan, now) - 1;
        n.min(loan.installments as u64) as u32
    }

    /// Devenga el interés de los periodos iniciados desde la última vez,
    /// sobre el saldo de capital vigente (que no cambió entre tanto).
    fn devengar(loan: &mut Loan, now: u64) {
        let saldo = loan.principal - loan.principal_paid;
        let iniciados = Self::periodos_iniciados(loan, now).min(u32::MAX as u64) as u32;
        if saldo <= 0 || iniciados <= loan.periods_accrued {
            return;
        }
        let nuevos = (iniciados - loan.periods_accrued) as i128;
        let por_periodo = saldo * loan.terms.rate_bps as i128 / BPS / MESES_POR_ANIO;
        loan.interest_accrued += por_periodo * nuevos;
        loan.periods_accrued = iniciados;
    }

    /// Lo vencido: capital de cuotas vencidas e impagas + interés pendiente.
    fn vencido(loan: &Loan, now: u64) -> i128 {
        let capital_exigible = Self::capital_acumulado_cuota(loan, Self::cuotas_vencidas(loan, now));
        let capital_vencido = (capital_exigible - loan.principal_paid).max(0);
        let interes = loan.interest_accrued - loan.interest_paid;
        if capital_vencido == 0 {
            0
        } else {
            capital_vencido + interes
        }
    }

    /// Recargo por mora: `late_fee_bps` sobre lo vencido.
    fn recargo(loan: &Loan, now: u64) -> i128 {
        Self::vencido(loan, now) * loan.terms.late_fee_bps as i128 / BPS
    }

    /// Garantía liberada acumulada que corresponde a `capital_pagado`.
    /// Entera (redondeo hacia abajo); al saldar se libera todo.
    fn garantia_objetivo(loan: &Loan, capital_pagado: i128) -> i128 {
        if capital_pagado >= loan.principal {
            loan.collateral_initial
        } else {
            capital_pagado * loan.collateral_initial / loan.principal
        }
    }

    /// Capital acumulado que debe estar pagado al completar la cuota `k`.
    fn capital_acumulado_cuota(loan: &Loan, k: u32) -> i128 {
        if k >= loan.installments {
            loan.principal
        } else {
            loan.principal / loan.installments as i128 * k as i128
        }
    }

    fn vencimiento_cuota(loan: &Loan, k: u32) -> u64 {
        loan.first_due_ts + (k.saturating_sub(1) as u64) * loan.period_seconds
    }

    fn vencimiento_siguiente(loan: &Loan) -> u64 {
        Self::vencimiento_cuota(loan, (loan.installments_paid + 1).min(loan.installments))
    }

    // --- Acceso a otros contratos y roles ---

    fn usdc_address(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Usdc)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado))
    }

    fn usdc(env: &Env) -> token::TokenClient<'_> {
        token::TokenClient::new(env, &Self::usdc_address(env))
    }

    fn history(env: &Env) -> HistoryClient<'_> {
        let addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::History)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado));
        HistoryClient::new(env, &addr)
    }

    fn read_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado))
    }

    fn read_treasury(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado))
    }

    fn require_admin(env: &Env) {
        Self::read_admin(env).require_auth();
        Self::extender_instancia(env);
    }

    fn require_not_paused(env: &Env) {
        if Self::is_paused(env.clone()) {
            panic_with_error!(env, Error::Pausado);
        }
        Self::extender_instancia(env);
    }

    // --- Almacenamiento ---

    fn siguiente_id(env: &Env, key: DataKey) -> u64 {
        let id: u64 = env.storage().instance().get(&key).unwrap_or(1);
        env.storage().instance().set(&key, &(id + 1));
        id
    }

    fn cargar_posicion(env: &Env, id: u64) -> Position {
        env.storage()
            .persistent()
            .get(&DataKey::Position(id))
            .unwrap_or_else(|| panic_with_error!(env, Error::PosicionNoExiste))
    }

    fn cargar_prestamo_activo(env: &Env, id: u64) -> Loan {
        let loan: Loan = env
            .storage()
            .persistent()
            .get(&DataKey::Loan(id))
            .unwrap_or_else(|| panic_with_error!(env, Error::PrestamoNoExiste));
        if loan.status != LoanStatus::Active {
            panic_with_error!(env, Error::EstadoInvalido);
        }
        loan
    }

    fn guardar_posicion(env: &Env, p: &Position) {
        let key = DataKey::Position(p.id);
        env.storage().persistent().set(&key, p);
        Self::extender(env, &key);
    }

    fn guardar_prestamo(env: &Env, l: &Loan) {
        env.storage().persistent().set(&DataKey::Loan(l.id), l);
        Self::extender_prestamo(env, l);
    }

    fn extender(env: &Env, key: &DataKey) {
        Self::extender_hasta(env, key, TTL_EXTENDER_A);
    }

    fn extender_hasta(env: &Env, key: &DataKey, ledgers: u32) {
        env.storage()
            .persistent()
            .extend_ttl(key, ledgers.saturating_sub(DIA_EN_LEDGERS), ledgers);
    }

    /// Préstamo y posición viven al menos hasta el último vencimiento más la
    /// gracia (+30 días), con tope en el máximo de la red. Así un préstamo en
    /// mora sin movimiento sigue legible y liquidable.
    fn extender_prestamo(env: &Env, l: &Loan) {
        let ledgers = Self::ttl_prestamo(env, l);
        Self::extender_hasta(env, &DataKey::Loan(l.id), ledgers);
        Self::extender_hasta(env, &DataKey::Position(l.position_id), ledgers);
    }

    fn ttl_prestamo(env: &Env, l: &Loan) -> u32 {
        if l.status != LoanStatus::Active {
            return TTL_EXTENDER_A;
        }
        let fin = Self::vencimiento_cuota(l, l.installments).saturating_add(l.terms.grace_seconds);
        let restante = fin.saturating_sub(env.ledger().timestamp()) / SEGUNDOS_POR_LEDGER;
        let ledgers = (restante.min(u32::MAX as u64) as u32).saturating_add(TTL_EXTENDER_A);
        ledgers.min(env.storage().max_ttl())
    }

    fn extender_instancia(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_UMBRAL, TTL_EXTENDER_A);
    }
}

#[cfg(test)]
mod test;
