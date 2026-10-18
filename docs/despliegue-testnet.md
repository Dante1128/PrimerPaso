# Despliegue en Stellar Testnet

Red: **Testnet** (`Test SDF Network ; September 2015`). Todo es dinero de
prueba, sin valor real. Desplegado el 2026-10-17.

## Contratos y token

| Qué | Dirección |
|---|---|
| Contrato **loan** (garantía y préstamo) | `CCTKZYY5P5BGBMEMARWD6C6GUUVHOXQDSFW55MV7SRZVLLDVHHIOSO65` |
| Contrato **history** (historial y credencial) | `CCZVHPN2ODQURHPNDFLDN5O5DHQTFGD4YMWQTPJWJ5FMSQ5JKPIFSQCM` |
| Token **USDC** de prueba (SAC) | `CAPMNKFCRHNSIVOSQU3M65NEOYTYWT5VZJXQT5YAG3LYKKKMMZGKDX7J` |

## Cuentas de la plataforma

| Rol | Identidad CLI | Dirección |
|---|---|---|
| Admin | `primerpaso-admin` | `GBT2EGZBCFPLTQ5DOPVUOJLIQU43IP374X6KSFFEVSPEJLK67D3PSKOS` |
| Operator | `primerpaso-operator` | `GBDGP72R4LW44CRJCOTY5HEFACWIQMWF2BE4TEAQPWR3EYQPTB7FMHFL` |
| Treasury (pool) | `primerpaso-treasury` | `GBZAS6OTJJ37L32HWX464CB6AAOPT2GYPLWIBAN3CJHTRQ5K3A2WNEI6` |
| Emisor del USDC de prueba | `primerpaso-issuer` | `GBY2LYPXOWSGFUAXHZSWPQTM2QSW5Z4V6YJFJ6FCBXKMFQGASPXXDH35` |
| Servidor SEP-10 | `primerpaso-sep10` | `GB5TOIEOEO4JWJ6WZJBNHWIVTU5J2CHR2JLXSTZRQJRPC67OTRZEF7N4` |
| Estudiante de demo | `primerpaso-demo-estudiante` | `GBSAUPHFJT526CUAYIF3ZQ6JDP3OKPFJF3UU5QOHAPADYYVTUFK3L5O5` |

Las llaves privadas viven solo en el Stellar CLI de esta máquina
(`stellar keys show <identidad>`) y en `app/.env.local`. **Nunca se suben al
repositorio.**

## Parámetros iniciales (`get_params`)

| Parámetro | Valor |
|---|---|
| `max_ltv_bps` | 8000 (80%) |
| `rate_bps` | 800 (8% anual) |
| `origination_fee_bps` | 100 (1%) |
| `late_fee_bps` | 200 (2% sobre lo vencido) |
| `yield_share_platform_bps` | 2500 (fase 2) |
| `grace_seconds` | **120** (demo de liquidación; en producción 2592000) |
| `min_principal` / `max_principal` | 100 / 3.000 USDC |
| `max_installments` | 12 |

## Pool

- La treasury tiene **100.000 USDC** de prueba.
- La treasury otorgó al contrato `loan` una *allowance* de 100.000 USDC
  (`approve`), válida hasta el ledger **8253746** (~170 días). El contrato
  desembolsa con `transfer_from`, así que el servidor no necesita la llave de
  la treasury. `loan.pool_available()` muestra cuánto se puede prestar.
- Para renovar o ampliar la allowance:
  ```bash
  stellar contract invoke --id <USDC> --source primerpaso-treasury --network testnet -- \
    approve --from <TREASURY> --spender <LOAN> --amount <monto> --live_until_ledger <ledger>
  ```

## Prueba de humo (on-chain)

Con el estudiante de demo: garantía 1.250 → préstamo 1.000 en 10 cuotas
(periodos de 300 s) → recibió **990** (comisión 10) → pagó la cuota 1
(100 + 6,67 de interés) → se liberaron **125** de garantía; puntaje 520.

- Apertura del préstamo: https://stellar.expert/explorer/testnet/tx/8cf1d68a5b727c08cc3de5e14c8727d1e385df44ca1db74433d3f85ae78a6981
- Pago de la cuota 1: https://stellar.expert/explorer/testnet/tx/120c53deb2262cf8c49a72d62c5c3725b17f50f4a652b5efc27ca894a4475ee7

## Enlaces en stellar.expert

- Contrato loan: https://stellar.expert/explorer/testnet/contract/CCTKZYY5P5BGBMEMARWD6C6GUUVHOXQDSFW55MV7SRZVLLDVHHIOSO65
- Contrato history: https://stellar.expert/explorer/testnet/contract/CCZVHPN2ODQURHPNDFLDN5O5DHQTFGD4YMWQTPJWJ5FMSQ5JKPIFSQCM
- Token USDC: https://stellar.expert/explorer/testnet/contract/CAPMNKFCRHNSIVOSQU3M65NEOYTYWT5VZJXQT5YAG3LYKKKMMZGKDX7J
- Treasury: https://stellar.expert/explorer/testnet/account/GBZAS6OTJJ37L32HWX464CB6AAOPT2GYPLWIBAN3CJHTRQ5K3A2WNEI6

## Cómo volver a desplegar

1. Compilar: en `/contracts`, `stellar contract build`.
2. Identidades: `stellar keys generate primerpaso-<rol> --network testnet --fund`
   (admin, operator, treasury, issuer, sep10).
3. USDC de prueba: `stellar contract asset deploy --asset USDC:<issuer> --source primerpaso-issuer --network testnet`,
   trustline de la treasury (`stellar tx new change-trust --line USDC:<issuer> --source primerpaso-treasury`)
   y `mint` de 100.000 a la treasury.
4. Desplegar `history` y luego `loan` con `stellar contract deploy --wasm <ruta> --source primerpaso-admin`.
5. Inicializar:
   - `history.initialize(admin, loan)`
   - `loan.initialize(admin, treasury, history, usdc, params)`
   - `loan.set_operator(operator, true)`
6. Allowance del pool: `usdc.approve(treasury, loan, monto, live_until_ledger)`.
7. Copiar las direcciones a `app/.env.local`.

> Las cuentas clásicas (G...) necesitan **trustline** al USDC de prueba antes
> de recibirlo. Los contratos (C...) no la necesitan.
>
> `open_loan` requiere dos firmas (operator y estudiante): la CLI solo firma
> con la cuenta fuente, así que la app firma la autorización del estudiante
> con su wallet y el servidor firma como operator.
