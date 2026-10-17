#![no_std]
//! Contrato de **Historial Crediticio** de PrimerPaso.
//!
//! Guarda, por cada dirección (wallet) de estudiante, cuántas cuotas pagó
//! a tiempo y cuántas con atraso. Al completar un préstamo, el contrato de
//! préstamo le pide a este contrato que emita una **credencial de buen
//! pagador** que es *no transferible*: queda ligada a la dirección y no
//! existe ninguna función para moverla a otra cuenta.
//!
//! IMPORTANTE: aquí NO se guardan datos personales (nombre, carnet, etc.).
//! Solo direcciones Stellar y contadores. Los datos personales viven en la
//! base de datos fuera de la cadena.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env,
};

/// Claves de almacenamiento del contrato.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Administrador del contrato (la plataforma).
    Admin,
    /// Dirección autorizada a registrar pagos y emitir credenciales.
    /// Normalmente es el contrato de préstamo.
    Authorized,
    /// Registro de pagos de una dirección.
    Record(Address),
    /// Credencial emitida a una dirección (si existe).
    Credential(Address),
}

/// Contador de pagos a tiempo y atrasados de un estudiante.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Record {
    /// Cuotas pagadas a tiempo.
    pub on_time: u32,
    /// Cuotas pagadas con atraso (o impagas tras una liquidación).
    pub late: u32,
}

/// Credencial de buen pagador. No transferible: no hay función para moverla.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Credential {
    /// Dueño de la credencial (estudiante).
    pub borrower: Address,
    /// Total de cuotas del préstamo completado.
    pub total_installments: u32,
    /// Cuotas pagadas a tiempo al momento de emitir.
    pub on_time: u32,
    /// Cuotas pagadas con atraso al momento de emitir.
    pub late: u32,
    /// Marca de tiempo (ledger) en que se emitió.
    pub issued_at: u64,
}

/// Errores del contrato de historial.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// El contrato ya fue inicializado.
    YaInicializado = 1,
    /// El contrato aún no fue inicializado.
    NoInicializado = 2,
    /// La credencial ya fue emitida para esa dirección.
    CredencialYaEmitida = 3,
}

#[contract]
pub struct HistoryContract;

#[contractimpl]
impl HistoryContract {
    /// Inicializa el contrato.
    ///
    /// - `admin`: la plataforma, puede cambiar la dirección autorizada.
    /// - `authorized`: dirección (normalmente el contrato de préstamo) con
    ///   permiso para registrar pagos y emitir credenciales.
    pub fn init(env: Env, admin: Address, authorized: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::YaInicializado);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Authorized, &authorized);
    }

    /// Cambia la dirección autorizada. Solo el admin.
    pub fn set_authorized(env: Env, new_authorized: Address) {
        let admin = Self::read_admin(&env);
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::Authorized, &new_authorized);
    }

    /// Registra el pago de una cuota para `borrower`.
    ///
    /// `on_time = true` suma a las cuotas a tiempo; `false` a las atrasadas.
    /// Solo la dirección autorizada (el contrato de préstamo) puede llamar.
    pub fn record_payment(env: Env, borrower: Address, on_time: bool) {
        Self::require_authorized(&env);
        let mut record = Self::get_record(env.clone(), borrower.clone());
        if on_time {
            record.on_time += 1;
        } else {
            record.late += 1;
        }
        env.storage()
            .persistent()
            .set(&DataKey::Record(borrower.clone()), &record);
        env.events()
            .publish((symbol_short!("pago"), borrower), on_time);
    }

    /// Emite la credencial de buen pagador (no transferible) al completar
    /// un préstamo. Solo la dirección autorizada puede llamar.
    pub fn issue_credential(env: Env, borrower: Address, total_installments: u32) {
        Self::require_authorized(&env);
        if env
            .storage()
            .persistent()
            .has(&DataKey::Credential(borrower.clone()))
        {
            panic_with_error!(&env, Error::CredencialYaEmitida);
        }
        let record = Self::get_record(env.clone(), borrower.clone());
        let credential = Credential {
            borrower: borrower.clone(),
            total_installments,
            on_time: record.on_time,
            late: record.late,
            issued_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Credential(borrower.clone()), &credential);
        env.events()
            .publish((symbol_short!("cred"), borrower), total_installments);
    }

    /// Devuelve el registro de pagos de una dirección (ceros si no existe).
    pub fn get_record(env: Env, borrower: Address) -> Record {
        env.storage()
            .persistent()
            .get(&DataKey::Record(borrower))
            .unwrap_or(Record { on_time: 0, late: 0 })
    }

    /// Devuelve la credencial de una dirección, si existe.
    pub fn get_credential(env: Env, borrower: Address) -> Option<Credential> {
        env.storage()
            .persistent()
            .get(&DataKey::Credential(borrower))
    }

    /// Indica si una dirección ya tiene credencial.
    pub fn has_credential(env: Env, borrower: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Credential(borrower))
    }

    /// Puntaje crediticio simple en el rango [300, 850].
    ///
    /// Base 500, +20 por cada cuota a tiempo, -40 por cada cuota atrasada.
    pub fn score(env: Env, borrower: Address) -> u32 {
        let record = Self::get_record(env, borrower);
        let base: i64 = 500;
        let puntaje = base + (record.on_time as i64) * 20 - (record.late as i64) * 40;
        if puntaje < 300 {
            300
        } else if puntaje > 850 {
            850
        } else {
            puntaje as u32
        }
    }

    /// Devuelve el administrador.
    pub fn admin(env: Env) -> Address {
        Self::read_admin(&env)
    }

    /// Devuelve la dirección autorizada.
    pub fn authorized(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Authorized)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NoInicializado))
    }

    // --- helpers internos ---

    fn read_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado))
    }

    /// Exige que quien invoca sea la dirección autorizada.
    ///
    /// Cuando el contrato de préstamo invoca este contrato, autoriza
    /// automáticamente su propia dirección para la sub-invocación, por lo
    /// que `require_auth` tiene éxito. Una cuenta externa no podría firmar
    /// como el contrato de préstamo y la llamada fallaría.
    fn require_authorized(env: &Env) {
        let authorized: Address = env
            .storage()
            .instance()
            .get(&DataKey::Authorized)
            .unwrap_or_else(|| panic_with_error!(env, Error::NoInicializado));
        authorized.require_auth();
    }
}

#[cfg(test)]
mod test;
