//! Pruebas unitarias del contrato de historial.
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

/// Prepara un entorno con el historial inicializado.
fn setup() -> (Env, HistoryContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let loan = Address::generate(&env);
    let id = env.register(HistoryContract, ());
    let client = HistoryContractClient::new(&env, &id);
    client.initialize(&admin, &loan);
    (env, client)
}

#[test]
fn registra_pagos_y_calcula_puntaje() {
    let (env, client) = setup();
    let estudiante = Address::generate(&env);
    assert_eq!(client.get_score(&estudiante), 500);

    client.record_payment(&estudiante, &1, &true, &false);
    client.record_payment(&estudiante, &1, &true, &false);
    client.record_payment(&estudiante, &1, &true, &false);
    client.record_payment(&estudiante, &1, &false, &false);

    let r = client.get_record(&estudiante);
    assert_eq!((r.on_time, r.late, r.defaults), (3, 1, 0));
    // 500 + 3*20 - 1*40 = 520
    assert_eq!(client.get_score(&estudiante), 520);

    client.record_default(&estudiante, &1);
    // 520 - 150 = 370
    assert_eq!(client.get_score(&estudiante), 370);
}

#[test]
fn puntaje_respeta_los_limites() {
    let (env, client) = setup();
    let malo = Address::generate(&env);
    for _ in 0..20 {
        client.record_payment(&malo, &1, &false, &false);
    }
    assert_eq!(client.get_score(&malo), 300);

    let bueno = Address::generate(&env);
    for _ in 0..50 {
        client.record_payment(&bueno, &2, &true, &false);
    }
    assert_eq!(client.get_score(&bueno), 850);
}

#[test]
fn credencial_se_emite_al_saldar_y_no_es_transferible() {
    let (env, client) = setup();
    let estudiante = Address::generate(&env);

    client.record_payment(&estudiante, &7, &true, &false);
    assert!(!client.verify(&estudiante));

    client.record_payment(&estudiante, &7, &true, &true);
    assert!(client.verify(&estudiante));
    let c = client.get_credential(&estudiante).unwrap();
    // Queda ligada a la dirección: no existe función para transferirla.
    assert_eq!(c.borrower, estudiante);
    assert_eq!((c.loans_repaid, c.on_time, c.late, c.last_loan_id), (1, 2, 0, 7));

    // Un segundo préstamo saldado actualiza la misma credencial.
    client.record_payment(&estudiante, &9, &false, &true);
    let c = client.get_credential(&estudiante).unwrap();
    assert_eq!((c.loans_repaid, c.late, c.last_loan_id), (2, 1, 9));
}

#[test]
fn solo_el_contrato_de_prestamo_escribe() {
    let env = Env::default();
    let id = env.register(HistoryContract, ());
    let client = HistoryContractClient::new(&env, &id);
    client.initialize(&Address::generate(&env), &Address::generate(&env));
    let estudiante = Address::generate(&env);
    // Sin la firma del contrato `loan`, no se puede escribir.
    assert!(client
        .try_record_payment(&estudiante, &1, &true, &true)
        .is_err());
    assert!(client.try_record_default(&estudiante, &1).is_err());
}

#[test]
fn admin_puede_cambiar_contrato_de_prestamo() {
    let (env, client) = setup();
    let nuevo = Address::generate(&env);
    client.set_loan_contract(&nuevo);
    assert_eq!(client.get_loan_contract(), nuevo);
}
