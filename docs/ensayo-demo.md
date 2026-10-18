# Ensayo de la demo (automático)

Ejecutado el 18/10/2026 contra Stellar **Testnet** con `npm run demo:ensayo`
(`app/scripts/ensayo-demo.ts`). El script recorre el flujo por la API, firmando
con las wallets de demo como lo haría Freighter. Cada transacción se puede
abrir en stellar.expert.

> La primera corrida se cortó en la cuota 2 por un error 502 pasajero del RPC
> público de testnet: el pago **sí** entró a la cadena, pero la app reportó
> error. Se corrigió (reintentos y espera por hash, ver `lib/stellar.ts`) y el
> ensayo se reanudó desde los pagos. La tabla junta ambas corridas.

## Préstamo #3 — Lucía (estudiante) con Rosa como garante

| # | Paso | Resultado | Transacción |
|---|---|---|---|
| 1 | Lucía vincula su wallet con SEP-10 | wallet verificada | — (firma de un challenge, no va a la red) |
| 2 | Lucía invita a Rosa; Rosa acepta con el código | garante vinculada | — |
| 3 | El operador aprueba el KYC de Lucía | KYC aprobado | — |
| 4 | Lucía solicita 300 USDC en 3 cuotas (curso) | garantía calculada: 375 USDC | — |
| 5 | El operador aprueba la solicitud | aprobada | — |
| 6 | **Rosa bloquea la garantía** | 375 USDC al contrato | [a47437b3…](https://stellar.expert/explorer/testnet/tx/a47437b398d72bbf73a005a8624936a4bb540ee1904334575410e9a08d4d9311) |
| 7 | **Lucía firma; PrimerPaso co-firma como operator** | recibe 297 USDC (comisión 3) | [db9e6322…](https://stellar.expert/explorer/testnet/tx/db9e632244e59c3869bbcfc0e3f117d7aff24f13083dd3557eb9cc21365c469e) |
| 8 | Cuota 1: 100 + 2 de interés | Rosa recupera 125 | [84300844…](https://stellar.expert/explorer/testnet/tx/84300844e28863cd8dbcd657e01509023021ce0235bdb545f09a40a2e5f917e1) |
| 9 | Cuota 2: 100 (interés del periodo ya pagado) | Rosa recupera 125 | [b6d0b9dc…](https://stellar.expert/explorer/testnet/tx/b6d0b9dc58b047fa944dc5495fec62d3b5c86a63277f55a45d38f72390dea103) |
| 10 | Cuota 3 (última) | préstamo **saldado**; Rosa recupera los últimos 125 (375 en total) y Lucía recibe la **credencial** | [5060ff7c…](https://stellar.expert/explorer/testnet/tx/5060ff7c363accb1b3b2ee1b1c8555a5479ab82cd8d804b8560ec96cf1bcf7f2) |
| 11 | Verificador público | muestra "Buen pagador ✓" | [/verificar/GBETZYBM…](http://localhost:3000/verificar/GBETZYBM5FJNOMCQ5K5MMKDGTG333LP66B4H74E2ZAOAJVSHJARXSAGY) |

## Liquidación en vivo — préstamo #2 (María, en mora)

| Paso | Resultado | Transacción |
|---|---|---|
| El admin liquida el préstamo #2 tras vencimiento + gracia | la treasury cobra 938,60 (capital + interés + recargo); vuelven 186,40 a María (depositante) | [77b70010…](https://stellar.expert/explorer/testnet/tx/77b7001083ceb3567ae00758d14124f27a669c1ef25d58b08f7ce7d0151beb48) |

## Resultado en el panel del admin

Pool disponible: **97.723 USDC** · Ingresos de la plataforma: **139,89 USDC**
(interés 93,33 · comisiones 23 · recargos 23,56).

## Ensayos anteriores (Fase 5)

| Paso | Transacción |
|---|---|
| María deposita 1.250 de garantía | [87367976…](https://stellar.expert/explorer/testnet/tx/8736797617ddd3a117f11f1bf6c97016d4d9af448fa988dd7942298a6cfa6dbc) |
| Préstamo #2 abierto (recibe 990) | [44ad2aa1…](https://stellar.expert/explorer/testnet/tx/44ad2aa1b2764841dbb266a8cac37f2db292274ca0d8c1e9c21c8c3df71c1f4d) |
| María paga la cuota 1 (libera 125) | [dcbebe9d…](https://stellar.expert/explorer/testnet/tx/dcbebe9d4799c28601da4fd62775955197a2b4965b1ee3a6075cdbc497829adc) |
| Liquidación del préstamo #1 (Carlos) | [2094150a…](https://stellar.expert/explorer/testnet/tx/2094150a02dce46a5ddffb803b7aae5de7744869e8d52680f6594ae83e43ed69) |
