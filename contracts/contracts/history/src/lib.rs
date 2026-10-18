#![no_std]
//! Contrato de **Historial Crediticio** de PrimerPaso.
//!
//! Guarda, por cada dirección (wallet) de estudiante, cuántas cuotas pagó a
//! tiempo, cuántas con atraso y cuántos préstamos terminaron en liquidación
//! (default). Solo el contrato de préstamo puede escribir aquí.
//!
//! Al saldar un préstamo se emite automáticamente una **credencial de buen
//! pagador** *no transferible*: queda ligada a la dirección y no existe
//! ninguna función para moverla a otra cuenta. Si el estudiante salda más
//! préstamos, la misma credencial se actualiza.
//!
//! IMPORTANTE: aquí NO se guardan datos personales (nombre, carnet, etc.).
//! Solo direcciones Stellar y contadores.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, ContractExecutable, Env,
};

const DIA_EN_LEDGERS: u32 = 17_280;
const TTL_EXTENDER_A: u32 = 30 * DIA_EN_LEDGERS;
const TTL_UMBRAL: u32 = TTL_EXTENDER_A - DIA_EN_LEDGERS;

/// Puntaje: base y ajustes por evento.
const PUNTAJE_BASE: i64 = 500;
const PUNTOS_A_TIEMPO: i64 = 20;
const PUNTOS_ATRASO: i64 = -40;
const PUNTOS_DEFAULT: i64 = -150;
const PUNTAJE_MIN: i64 = 300;
const PUNTAJE_MAX: i64 = 850;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Contrato de préstamo: único autorizado a escribir.
    LoanContract,
    Record(Address),
    Credential(Address),
}

/// Contadores de comportamiento de pago de una dirección.
#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Record {
    /// Cuotas pagadas a tiempo.
    pub on_time: u32,
    /// Cuotas pagadas con atraso.
    pub late: u32,
    /// Préstamos liquidados por mora.
    pub defaults: u32,
    /// Préstamos saldados por completo.
    pub loans_repaid: u32,
}

/// Credencial de buen pagador. No transferible: no hay función para moverla.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Credential {
    pub borrower: Address,
    /// Préstamos saldados al momento de la última actualización.
    pub loans_repaid: u32,
    pub on_time: u32,
    pub late: u32,
    /// Último préstamo que la emitió o actualizó.
    pub last_loan_id: u64,
    pub issued_at: u64,
    pub updated_at: u64,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    YaInicializado = 1,
    NoInicializado = 2,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecorded {
    #[topic]
    pub borrower: Address,
    #[topic]
    pub loan_id: u64,
    pub on_time: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DefaultRecorded {
    #[topic]
    pub borrower: Address,
    #[topic]
    pub loan_id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CredentialIssued {
    #[topic]
    pub borrower: Address,
    pub loan_id: u64,
    pub loans_repaid: u32,
}

#[contract]
pub struct HistoryContract;

#[contractimpl]
impl HistoryContract {
    /// Inicializa con el admin y el contrato de préstamo autorizado.
    pub fn initialize(env: Env, admin: Address, loan_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::YaInicializado);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::LoanContract, &loan_contract);
        Self::extender_instancia(&env);
    }

    /// Cambia el contrato de préstamo autorizado. Solo el admin.
    pub fn set_loan_contract(env: Env, loan_contract: Address) {
        Self::read_admin(&env).require_auth();
        env.storage()
            .instance()
            .set(&DataKey::LoanContract, &loan_contract);
    }

    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        Self::read_admin(&env).require_auth();
        env.deployer()
            .update_current_contract(ContractExecutable::Wasm(wasm_hash));
    }

    /// Registra una cuota pagada. Si `settled` es verdadero, el préstamo
    /// quedó saldado y se emite (o actualiza) la credencial. Solo `loan`.
    pub fn record_payment(env: Env, borrower: Address, loan_id: u64, on_time: bool, settled: bool) {
        Self::require_loan_contract(&env);
        let mut record = Self::get_record(env.clone(), borrower.clone());
        if on_time {
            record.on_time += 1;
        } else {
            record.late += 1;
        }
        if settled {
            record.loans_repaid += 1;
        }
        Self::guardar(&env, &DataKey::Record(borrower.clone()), &record);
        PaymentRecorded {
            borrower: borrower.clone(),
            loan_id,
            on_time,
        }
        .publish(&env);

        if settled {
            Self::emitir_credencial(&env, &borrower, loan_id, &record);
        }
    }

    /// Registra que un préstamo terminó en liquidación. Solo `loan`.
    pub fn record_default(env: Env, borrower: Address, loan_id: u64) {
        Self::require_loan_contract(&env);
        let mut record = Self::get_record(env.clone(), borrower.clone());
        record.defaults += 1;
        Self::guardar(&env, &DataKey::Record(borrower.clone()), &record);
        DefaultRecorded { borrower, loan_id }.publish(&env);
    }

    // --- Lecturas ---

    pub fn get_record(env: Env, borrower: Address) -> Record {
        env.storage()
            .persistent()
            .get(&DataKey::Record(borrower))
            .unwrap_or_default()
    }

    /// Puntaje en [300, 850]: base 500, +20 por cuota a tiempo, -40 por
    /// cuota atrasada y -150 por préstamo liquidado.
    pub fn get_score(env: Env, borrower: Address) -> u32 {
        let r = Self::get_record(env, borrower);
        let puntaje = PUNTAJE_BASE
            + (r.on_time as i64) * PUNTOS_A_TIEMPO
            + (r.late as i64) * PUNTOS_ATRASO
            + (r.defaults as i64) * PUNTOS_DEFAULT;
        puntaje.clamp(PUNTAJE_MIN, PUNTAJE_MAX) as u32
    }

    pub fn get_credential(env: Env, borrower: Address) -> Option<Credential> {
        env.storage()
            .persistent()
            .get(&DataKey::Credential(borrower))
    }

    /// Verificación pública: ¿esta dirección tiene credencial de buen pagador?
    pub fn verify(env: Env, borrower: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Credential(borrower))
    }

    pub fn get_admin(env: Env) -> Address {
        Self::read_admin(&env)
    }

    pub fn get_loan_contract(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::LoanContract)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NoInicializado))
    }

    // --- helpers internos ---

    fn emitir_credencial(env: &Env, borrower: &Address, loan_id: u64, record: &Record) {
        let key = DataKey::Credential(borrower.clone());
        let ahora = env.ledger().timestamp();
        let issued_at = env
            .storage()
            .persistent()
            .get::<DataKey, Credential>(&key)
            .map(|c| c.issued_at)
            .unwrap_or(ahora);
        let credencial = Credential {
            borrower: borrower.clone(),
            loans_repaid: record.loans_repaid,
            on_time: record.on_time,
            late: record.late,
            last_loan_id: loan_id,
            issued_at,
            updated_at: ahora,
        };
        Self::guardar(env, &key, &credencial);
        CredentialIssued {
            borrower: borrower.clone(),
            loan_id,
            loans_repaid: record.loans_repaid,
        }
        .publish(env);
    }

    fn read_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado))
    }

    /// Exige que quien invoca sea el contrato de préstamo. Cuando `loan`
    /// invoca este contrato, su propia dirección queda autorizada en la
    /// sub-invocación; una cuenta externa no puede firmar por él.
    fn require_loan_contract(env: &Env) {
        let loan: Address = env
            .storage()
            .instance()
            .get(&DataKey::LoanContract)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado));
        loan.require_auth();
        Self::extender_instancia(env);
    }

    fn guardar<V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(env: &Env, key: &DataKey, value: &V) {
        env.storage().persistent().set(key, value);
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_UMBRAL, TTL_EXTENDER_A);
    }

    fn extender_instancia(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_UMBRAL, TTL_EXTENDER_A);
    }
}

#[cfg(test)]
mod test;
