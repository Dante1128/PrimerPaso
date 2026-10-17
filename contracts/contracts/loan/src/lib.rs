#![no_std]
//! Contrato de **Préstamo y Garantía** de PrimerPaso.
//!
//! Modelo económico (todo en la unidad mínima del token USDC, "stroops"):
//!
//! 1. El estudiante (o su garante) bloquea una garantía `C` en USDC con
//!    [`deposit_collateral`].
//! 2. La plataforma abre un préstamo con [`open_loan`] por un principal `P`
//!    que no puede superar el 80% de `C`. El contrato desembolsa `P` al
//!    estudiante desde su liquidez (ver [`fund_pool`]).
//! 3. La deuda total es `D = P + P * tasa / 10000` (tasa en puntos básicos,
//!    plana para todo el plazo). Se divide en `n` cuotas mensuales.
//! 4. Cada pago con [`repay`] libera garantía de forma proporcional:
//!    garantía liberada objetivo = `C * total_pagado / D`. Al terminar de
//!    pagar, el estudiante recupera toda su garantía.
//! 5. Si cae en mora, el admin puede [`liquidate`]: el contrato toma de la
//!    garantía **solo lo adeudado** y devuelve el resto al estudiante.
//!
//! Cada cuota pagada (a tiempo o con atraso) se registra en el contrato de
//! historial, y al completar el préstamo se emite una credencial de buen
//! pagador. Ningún dato personal se guarda en la cadena: solo direcciones y
//! montos.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, token, Address, Env,
};

/// Segundos por cuota (un mes de 30 días). Las cuotas son mensuales.
const SECONDS_PER_MONTH: u64 = 30 * 24 * 60 * 60;

/// Porcentaje máximo del principal respecto de la garantía (80%).
const MAX_LTV_PERCENT: i128 = 80;

/// Interfaz mínima del contrato de historial, para invocarlo de forma
/// tipada sin depender del crate completo.
#[contractclient(name = "HistoryClient")]
pub trait HistoryInterface {
    fn record_payment(env: Env, borrower: Address, on_time: bool);
    fn issue_credential(env: Env, borrower: Address, total_installments: u32);
}

/// Estado de un préstamo.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LoanStatus {
    /// Garantía depositada, préstamo todavía no abierto.
    Pending,
    /// Préstamo activo, con cuotas por pagar.
    Active,
    /// Préstamo pagado por completo.
    Completed,
    /// Préstamo liquidado por mora.
    Liquidated,
}

/// Datos de un préstamo, indexados por la dirección del estudiante.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Loan {
    /// Dirección (wallet) del estudiante prestatario.
    pub borrower: Address,
    /// Garantía total bloqueada en USDC.
    pub collateral: i128,
    /// Principal desembolsado.
    pub principal: i128,
    /// Deuda total a pagar (principal + interés).
    pub total_due: i128,
    /// Acumulado efectivamente pagado.
    pub total_repaid: i128,
    /// Garantía ya devuelta al estudiante.
    pub collateral_released: i128,
    /// Número de cuotas pactadas.
    pub installments: u32,
    /// Monto de cada cuota (deuda total / número de cuotas).
    pub installment_amount: i128,
    /// Cuotas completadas hasta ahora.
    pub paid_installments: u32,
    /// Tasa de interés en puntos básicos (ej. 1000 = 10%).
    pub interest_rate: u32,
    /// Marca de tiempo de apertura del préstamo.
    pub opened_at: u64,
    /// Segundos por cuota.
    pub period: u64,
    /// Estado actual.
    pub status: LoanStatus,
}

/// Claves de almacenamiento.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Administrador (la plataforma): abre préstamos y liquida.
    Admin,
    /// Dirección del token USDC usado como garantía y desembolso.
    Token,
    /// Dirección del contrato de historial (opcional).
    History,
    /// Préstamo de una dirección.
    Loan(Address),
}

/// Errores del contrato de préstamo.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// El contrato ya fue inicializado.
    YaInicializado = 1,
    /// El contrato aún no fue inicializado.
    NoInicializado = 2,
    /// No hay garantía depositada para esa dirección.
    SinGarantia = 3,
    /// La operación no es válida para el estado actual del préstamo.
    EstadoInvalido = 4,
    /// El principal supera el 80% de la garantía.
    PrincipalExcedeLimite = 5,
    /// Parámetros inválidos (cuotas en cero, tasa fuera de rango, etc.).
    ParametrosInvalidos = 6,
    /// Monto inválido (cero o negativo).
    MontoInvalido = 7,
    /// El pago supera lo que aún se adeuda.
    ExcedeDeuda = 8,
    /// No hay cuotas vencidas: no se puede liquidar todavía.
    SinMora = 9,
}

#[contract]
pub struct LoanContract;

#[contractimpl]
impl LoanContract {
    /// Inicializa el contrato con el admin y el token USDC.
    pub fn init(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::YaInicializado);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Define o actualiza el contrato de historial. Solo el admin.
    pub fn set_history(env: Env, history: Address) {
        Self::read_admin(&env).require_auth();
        env.storage().instance().set(&DataKey::History, &history);
    }

    /// Fondea la liquidez del contrato (de donde salen los desembolsos).
    /// Cualquiera puede aportar; en la práctica lo hace la plataforma.
    pub fn fund_pool(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::MontoInvalido);
        }
        Self::token_client(&env).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
    }

    /// Deposita garantía en USDC. La firma el propio estudiante o su garante.
    ///
    /// Si no existe préstamo, crea uno en estado `Pending`. Si ya existe uno
    /// `Pending`, suma a la garantía. No se permite depositar sobre un
    /// préstamo ya activo, completado o liquidado.
    pub fn deposit_collateral(env: Env, borrower: Address, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::MontoInvalido);
        }

        // El dinero entra al contrato.
        Self::token_client(&env).transfer(&from, &env.current_contract_address(), &amount);

        let mut loan = match Self::load(&env, &borrower) {
            Some(l) => {
                if l.status != LoanStatus::Pending {
                    panic_with_error!(&env, Error::EstadoInvalido);
                }
                l
            }
            None => Loan {
                borrower: borrower.clone(),
                collateral: 0,
                principal: 0,
                total_due: 0,
                total_repaid: 0,
                collateral_released: 0,
                installments: 0,
                installment_amount: 0,
                paid_installments: 0,
                interest_rate: 0,
                opened_at: 0,
                period: 0,
                status: LoanStatus::Pending,
            },
        };

        loan.collateral += amount;
        Self::save(&env, &loan);
        env.events()
            .publish((symbol_short!("deposito"), borrower), amount);
    }

    /// Abre el préstamo. Solo el admin (la plataforma aprueba y desembolsa).
    ///
    /// - `principal` no puede superar el 80% de la garantía.
    /// - `installments` debe ser mayor a cero.
    /// - `interest_rate` en puntos básicos (ej. 1000 = 10%).
    pub fn open_loan(
        env: Env,
        borrower: Address,
        principal: i128,
        installments: u32,
        interest_rate: u32,
    ) {
        Self::read_admin(&env).require_auth();

        let mut loan = Self::load(&env, &borrower)
            .unwrap_or_else(|| panic_with_error!(&env, Error::SinGarantia));

        if loan.status != LoanStatus::Pending {
            panic_with_error!(&env, Error::EstadoInvalido);
        }
        if loan.collateral <= 0 {
            panic_with_error!(&env, Error::SinGarantia);
        }
        if principal <= 0 || installments == 0 {
            panic_with_error!(&env, Error::ParametrosInvalidos);
        }
        // Límite 80%: principal <= garantía * 80 / 100.
        if principal > loan.collateral * MAX_LTV_PERCENT / 100 {
            panic_with_error!(&env, Error::PrincipalExcedeLimite);
        }

        let total_due = principal + principal * (interest_rate as i128) / 10_000;
        let installment_amount = total_due / (installments as i128);
        if installment_amount <= 0 {
            panic_with_error!(&env, Error::ParametrosInvalidos);
        }

        loan.principal = principal;
        loan.total_due = total_due;
        loan.installments = installments;
        loan.installment_amount = installment_amount;
        loan.interest_rate = interest_rate;
        loan.opened_at = env.ledger().timestamp();
        loan.period = SECONDS_PER_MONTH;
        loan.status = LoanStatus::Active;

        // Desembolso del principal al estudiante desde la liquidez.
        Self::token_client(&env).transfer(
            &env.current_contract_address(),
            &borrower,
            &principal,
        );

        Self::save(&env, &loan);
        env.events()
            .publish((symbol_short!("prestamo"), borrower), principal);
    }

    /// Paga una cuota (o un monto parcial/total). La firma el estudiante.
    ///
    /// Registra el pago, libera garantía proporcional y, si corresponde,
    /// marca el préstamo como completado y emite la credencial.
    pub fn repay(env: Env, borrower: Address, amount: i128) {
        borrower.require_auth();

        let mut loan = Self::load(&env, &borrower)
            .unwrap_or_else(|| panic_with_error!(&env, Error::SinGarantia));
        if loan.status != LoanStatus::Active {
            panic_with_error!(&env, Error::EstadoInvalido);
        }
        if amount <= 0 {
            panic_with_error!(&env, Error::MontoInvalido);
        }
        let outstanding = loan.total_due - loan.total_repaid;
        if amount > outstanding {
            panic_with_error!(&env, Error::ExcedeDeuda);
        }

        // El pago entra al contrato (vuelve a la liquidez/prestamista).
        Self::token_client(&env).transfer(&borrower, &env.current_contract_address(), &amount);

        let prev_completed = loan.paid_installments;
        loan.total_repaid += amount;

        // Cuotas completadas tras este pago.
        let completed = if loan.total_repaid >= loan.total_due {
            loan.installments
        } else {
            let c = (loan.total_repaid / loan.installment_amount) as u32;
            if c > loan.installments {
                loan.installments
            } else {
                c
            }
        };
        loan.paid_installments = completed;

        // Registrar en el historial cada cuota recién completada.
        if let Some(history) = Self::history_client(&env) {
            let now = env.ledger().timestamp();
            let mut k = prev_completed + 1;
            while k <= completed {
                let vencimiento = loan.opened_at + (k as u64) * loan.period;
                let a_tiempo = now <= vencimiento;
                history.record_payment(&borrower, &a_tiempo);
                k += 1;
            }
        }

        // Liberar garantía de forma proporcional a lo pagado.
        let objetivo = loan.collateral * loan.total_repaid / loan.total_due;
        let delta = objetivo - loan.collateral_released;
        if delta > 0 {
            Self::token_client(&env).transfer(
                &env.current_contract_address(),
                &borrower,
                &delta,
            );
            loan.collateral_released += delta;
            env.events()
                .publish((symbol_short!("liberado"), borrower.clone()), delta);
        }

        env.events()
            .publish((symbol_short!("pago"), borrower.clone()), amount);

        // ¿Préstamo completado?
        if loan.total_repaid >= loan.total_due {
            loan.status = LoanStatus::Completed;
            if let Some(history) = Self::history_client(&env) {
                history.issue_credential(&borrower, &loan.installments);
            }
            env.events()
                .publish((symbol_short!("completo"), borrower), loan.installments);
        }

        Self::save(&env, &loan);
    }

    /// Liquida un préstamo en mora. Solo el admin.
    ///
    /// Requiere que la próxima cuota impaga esté vencida. Toma de la garantía
    /// restante **solo lo adeudado** (lo envía al admin/prestamista) y
    /// devuelve el resto de la garantía al estudiante.
    pub fn liquidate(env: Env, borrower: Address) {
        let admin = Self::read_admin(&env);
        admin.require_auth();

        let mut loan = Self::load(&env, &borrower)
            .unwrap_or_else(|| panic_with_error!(&env, Error::SinGarantia));
        if loan.status != LoanStatus::Active {
            panic_with_error!(&env, Error::EstadoInvalido);
        }

        // La próxima cuota impaga vence en opened_at + (paid+1) * period.
        let siguiente = (loan.paid_installments + 1) as u64;
        let vencimiento = loan.opened_at + siguiente * loan.period;
        if env.ledger().timestamp() <= vencimiento {
            panic_with_error!(&env, Error::SinMora);
        }

        let outstanding = loan.total_due - loan.total_repaid;
        let garantia_restante = loan.collateral - loan.collateral_released;
        // Tomar solo lo adeudado (acotado por la garantía disponible).
        let tomar = if outstanding < garantia_restante {
            outstanding
        } else {
            garantia_restante
        };

        let token = Self::token_client(&env);
        if tomar > 0 {
            token.transfer(&env.current_contract_address(), &admin, &tomar);
        }
        let devolver = garantia_restante - tomar;
        if devolver > 0 {
            token.transfer(&env.current_contract_address(), &borrower, &devolver);
        }

        loan.collateral_released = loan.collateral;
        loan.status = LoanStatus::Liquidated;

        // Registrar las cuotas impagas como atrasadas en el historial.
        if let Some(history) = Self::history_client(&env) {
            let mut k = loan.paid_installments + 1;
            while k <= loan.installments {
                history.record_payment(&borrower, &false);
                k += 1;
            }
        }

        Self::save(&env, &loan);
        env.events()
            .publish((symbol_short!("liquida"), borrower), tomar);
    }

    /// Consulta el estado del préstamo de una dirección.
    pub fn get_loan(env: Env, borrower: Address) -> Option<Loan> {
        Self::load(&env, &borrower)
    }

    /// Devuelve el admin.
    pub fn admin(env: Env) -> Address {
        Self::read_admin(&env)
    }

    /// Devuelve la dirección del token USDC.
    pub fn token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NoInicializado))
    }

    // --- helpers internos ---

    fn read_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado))
    }

    fn token_client(env: &Env) -> token::TokenClient {
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado));
        token::TokenClient::new(env, &token)
    }

    /// Cliente del historial, si está configurado.
    fn history_client(env: &Env) -> Option<HistoryClient> {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::History)
            .map(|addr| HistoryClient::new(env, &addr))
    }

    fn load(env: &Env, borrower: &Address) -> Option<Loan> {
        env.storage()
            .persistent()
            .get(&DataKey::Loan(borrower.clone()))
    }

    fn save(env: &Env, loan: &Loan) {
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan.borrower.clone()), loan);
    }
}

#[cfg(test)]
mod test;
