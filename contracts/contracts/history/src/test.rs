//! Pruebas unitarias del contrato de historial.
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

/// Prepara un entorno con el contrato de historial ya inicializado.
/// Devuelve (env, cliente, dirección_autorizada).
fn setup() -> (Env, HistoryContractClient<'static>, Address) {
    let env = Env::default();
    // Autorizamos todas las firmas para simplificar las pruebas.
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let authorized = Address::generate(&env);

    let contract_id = env.register(HistoryContract, ());
    let client = HistoryContractClient::new(&env, &contract_id);
    client.init(&admin, &authorized);

    (env, client, authorized)
}

#[test]
fn registra_pagos_y_calcula_puntaje() {
    let (env, client, _authorized) = setup();
    let estudiante = Address::generate(&env);

    // Sin historial, el puntaje es la base 500.
    assert_eq!(client.score(&estudiante), 500);

    // Tres cuotas a tiempo y una atrasada.
    client.record_payment(&estudiante, &true);
    client.record_payment(&estudiante, &true);
    client.record_payment(&estudiante, &true);
    client.record_payment(&estudiante, &false);

    let record = client.get_record(&estudiante);
    assert_eq!(record.on_time, 3);
    assert_eq!(record.late, 1);

    // 500 + 3*20 - 1*40 = 520
    assert_eq!(client.score(&estudiante), 520);
}

#[test]
fn puntaje_respeta_los_limites() {
    let (env, client, _authorized) = setup();
    let estudiante = Address::generate(&env);

    // Muchos atrasos: el puntaje no baja de 300.
    for _ in 0..20 {
        client.record_payment(&estudiante, &false);
    }
    assert_eq!(client.score(&estudiante), 300);

    let otro = Address::generate(&env);
    // Muchos pagos a tiempo: el puntaje no sube de 850.
    for _ in 0..50 {
        client.record_payment(&otro, &true);
    }
    assert_eq!(client.score(&otro), 850);
}

#[test]
fn emite_credencial_no_transferible() {
    let (env, client, _authorized) = setup();
    let estudiante = Address::generate(&env);

    client.record_payment(&estudiante, &true);
    client.record_payment(&estudiante, &true);

    assert!(!client.has_credential(&estudiante));

    client.issue_credential(&estudiante, &6);

    assert!(client.has_credential(&estudiante));
    let credencial = client.get_credential(&estudiante).unwrap();
    // La credencial queda ligada a la dirección del estudiante: no existe
    // ninguna función para transferirla a otra cuenta.
    assert_eq!(credencial.borrower, estudiante);
    assert_eq!(credencial.total_installments, 6);
    assert_eq!(credencial.on_time, 2);
    assert_eq!(credencial.late, 0);
}

#[test]
#[should_panic]
fn no_permite_emitir_dos_veces() {
    let (env, client, _authorized) = setup();
    let estudiante = Address::generate(&env);

    client.issue_credential(&estudiante, &3);
    // Emitir de nuevo debe fallar (CredencialYaEmitida).
    client.issue_credential(&estudiante, &3);
}

#[test]
fn admin_puede_cambiar_autorizado() {
    let (env, client, _authorized) = setup();
    let nuevo = Address::generate(&env);

    client.set_authorized(&nuevo);
    assert_eq!(client.authorized(), nuevo);
}
