# Despliegue en Stellar Testnet

Red: **Testnet** (`Test SDF Network ; September 2015`). Todo es dinero de
prueba, sin valor real.

## Direcciones desplegadas

| Qué | Dirección |
|---|---|
| Admin (plataforma) | `GC42PHGGXJCKV2ZRCHXYRI44QPPG4G5SFYHYNUM2CANGMFCHBO2OAEOK` |
| Emisor del USDC de prueba | `GD5LQILPNXNF7G3OZIPRUAW5I4GTCWV3W4MT6AWNDOTZEPFX6RDGW55E` |
| Token USDC (SAC) | `CCRZZB6FIACFQP73DIKFE72YC6LSCGJ74MIQ5JX2U32CRVO5ZTYU6IBZ` |
| Contrato **loan** (préstamo y garantía) | `CA4LTSK3ELS7Y2HA2H2ZDRBIZU36EJBY7MNHYRXBKMLYOSPRAVX4XE4S` |
| Contrato **history** (historial) | `CA2MQB3O2FFCS5IRNSA2SM56SBELVMLC553KUWD2LZWTYWLDWR4RNGXC` |

### Cuentas de prueba (seed)

| Rol | Dirección | USDC |
|---|---|---|
| Estudiante 1 | `GBWCSVDN7HAVJN2DDXDWMUKPYUZAXN2WSRZ6Y4SJY3D4OFVSEGPTJHLS` | 2.000 |
| Estudiante 2 | `GBHB3ISZVVPC4W2DXRMFO5V45CYCNYVYQZAVC652HWXL2KVAF3ZOMTHG` | 2.000 |
| Garante | `GAS6JEQPY225KG4U2FJVP3D6BNLPAU6E2DFP226PEMZ37ZKSB3BYQ6Q6` | 2.000 |

Liquidez del pool (en el contrato `loan`): **100.000 USDC**.

Las llaves privadas de estas identidades están en
`~/.config/stellar/identity/primerpaso-*.toml` (solo en esta máquina, nunca
subir al repositorio).

## Enlaces en stellar.expert (Testnet)

- Contrato loan: https://stellar.expert/explorer/testnet/contract/CA4LTSK3ELS7Y2HA2H2ZDRBIZU36EJBY7MNHYRXBKMLYOSPRAVX4XE4S
- Contrato history: https://stellar.expert/explorer/testnet/contract/CA2MQB3O2FFCS5IRNSA2SM56SBELVMLC553KUWD2LZWTYWLDWR4RNGXC
- Token USDC: https://stellar.expert/explorer/testnet/contract/CCRZZB6FIACFQP73DIKFE72YC6LSCGJ74MIQ5JX2U32CRVO5ZTYU6IBZ

## Cómo volver a desplegar

1. Compilar: en `/contracts`, `stellar contract build`.
2. Generar/fondear identidad admin e issuer con `stellar keys generate <alias> --network testnet --fund`.
3. Desplegar el token: `stellar contract asset deploy --asset USDC:<issuer> --source <issuer> --network testnet`.
4. Desplegar cada WASM con `stellar contract deploy --wasm <ruta> --source admin --network testnet`.
5. Inicializar: `loan.init(admin, usdc)`, `history.init(admin, loan)`, `loan.set_history(history)`.
6. Fondear el pool: `mint` del USDC al contrato `loan`.

> Las cuentas clásicas (G...) necesitan una **trustline** al asset USDC
> antes de poder recibirlo (`stellar tx new change-trust --line USDC:<issuer>`).
> Los contratos (C...) no la necesitan.
