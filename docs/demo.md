# Guion de la demo de PrimerPaso

**Duración:** 10–12 minutos · **Red:** Stellar Testnet (USDC de prueba)

**Idea a transmitir:** un universitario sin historial consigue su primer
préstamo respaldado por un ahorro en USDC (suyo o de un familiar). Todo el
dinero se mueve en la blockchain: la garantía vuelve con cada pago, y al
terminar queda una credencial de buen pagador que cualquiera puede verificar.

---

## 1. Preparación (15 minutos antes)

1. Levanta la app:
   ```bash
   cd app
   npm run dev          # http://localhost:3000
   npm run indexar      # deja la caché al día con la cadena
   ```
2. En **Freighter** (red **Testnet**), importa las cuentas que vas a usar.
   Obtén cada llave en la terminal con `stellar keys show <identidad>`; nunca la
   pegues en un chat ni en el repositorio.

   | Persona | Email (contraseña `PrimerPaso2026!`) | Identidad CLI de su wallet |
   |---|---|---|
   | Ana — estudiante (protagonista en vivo) | `ana@primerpaso.test` | `primerpaso-demo-ana` |
   | Rosa — garante | `rosa@primerpaso.test` | `primerpaso-demo-rosa` |
   | Operador | `operador@primerpaso.test` | (no firma: el servidor co-firma) |
   | Admin | `admin@primerpaso.test` | (no firma: el servidor firma como admin) |

3. Abre **ventanas separadas** del navegador (o perfiles) para no mezclar
   sesiones: una para Ana, una para el operador y una para el admin.
4. Comprueba en el panel del admin → **Pool e ingresos** que el pool tenga
   liquidez y que **Parámetros** diga "Base = contrato".
5. Ten a mano [`ensayo-demo.md`](ensayo-demo.md) como respaldo: ahí está el
   flujo completo ya ejecutado, con todas las transacciones.

> **Tiempos de la demo:** las cuotas duran **5 minutos**
> (`LOAN_PERIOD_SECONDS=300`) y la gracia es de **2 minutos**. Un préstamo
> abierto al inicio de la demo queda en mora a los 5 minutos y se puede
> liquidar a los 7.

---

## 2. Guion

### Escena 1 — El problema y el simulador (1 min) · *landing*
- Abre `http://localhost:3000` y baja al **Simulador**.
- Muestra el ejemplo de referencia: **1.000 USDC en 10 cuotas**.
  - Garantía: **1.250** (préstamo hasta el 80%).
  - Recibe **990** (comisión de apertura del 1%).
  - Interés total **36,67** (8% anual sobre saldo).
  - Costo neto **46,67** (4,67%).
  - Cada cuota devuelve **125** de garantía; al final se recupera todo.
- Mensaje: "Son los mismos números que calcula el contrato, al centavo."

### Escena 2 — Ana pide su préstamo (1,5 min) · *ventana de Ana*
- Entra como **Ana**. Muestra su panel: universidad, puntaje inicial 500 y saldo.
- En **Simula y solicita** elige el monto (ej. 1.000 en 10 cuotas) →
  **Quiero este préstamo** → propósito "Matrícula" → **Enviar solicitud**.
- Queda "En revisión".

### Escena 3 — El operador revisa (1 min) · *ventana del operador*
- Entra como **operador**. En **Solicitudes por revisar** aparece Ana con el
  monto, las cuotas y la garantía. Pulsa **Aprobar**.
- Cuenta que el KYC se revisa en la misma pantalla, con los documentos en un
  almacenamiento privado.

### Escena 4 — Garantía y desembolso on-chain (2 min) · *ventana de Ana*
- Recarga el panel de Ana: la solicitud está "Aprobada" con 2 pasos.
- **Paso 1: Bloquear con Freighter.** Freighter muestra la transacción;
  firma. Abre el enlace a **stellar.expert**: 1.250 USDC entran al contrato.
- **Paso 2: Firmar y recibir.** Ana firma y PrimerPaso co-firma como
  operator. Abre stellar.expert: la treasury envía **990 USDC** a Ana.
- El panel muestra el préstamo: saldo, garantía bloqueada y calendario.

### Escena 5 — Pagar y recuperar garantía (1,5 min) · *ventana de Ana*
- En **Próxima cuota** pulsa **Pagar con Freighter** (106,67 = 100 + 6,67).
- Muestra la barra **Garantía liberada**: 125 USDC volvieron a la wallet de
  Ana en la misma transacción. Abre el pago en stellar.expert.
- El puntaje sube (500 → 520).

### Escena 6 — Mora y liquidación en vivo (2 min) · *ventana del admin*
- Entra como **admin** → **Mora y liquidación**.
- Usa un préstamo que ya esté **liquidable**: el de Ana si pasaron 7 minutos
  sin pagar la cuota 2, o uno preparado antes de la demo (ver "Plan B").
- Pulsa **Liquidar** → confirma. Abre stellar.expert: la treasury cobra
  capital + interés + recargo del 2% sobre lo vencido, y **el resto vuelve
  a quien depositó la garantía**, nunca más de lo adeudado.

### Escena 7 — Pool, ingresos y credencial (1,5 min)
- **Admin → Pool e ingresos:** liquidez disponible (on-chain), ingresos por
  interés, comisiones y recargos, y movimientos con enlace a cada transacción.
- **Verificador público:** abre
  `/verificar/GBETZYBM5FJNOMCQ5K5MMKDGTG333LP66B4H74E2ZAOAJVSHJARXSAGY`
  (Lucía, que pagó todo en el ensayo). Se ve "Buen pagador ✓", su puntaje y
  su historial, leídos en vivo del contrato y **sin datos personales**.
- Cierre: "Su primer préstamo ahora es su primer historial, y nadie tiene que
  creerle a PrimerPaso: está en la blockchain."

---

## 3. Plan B

| Si pasa esto | Haz esto |
|---|---|
| Freighter no abre o no firma | Revisa que esté en **Testnet** y en la cuenta correcta (la app avisa si la cuenta no coincide). |
| "Saldo de USDC insuficiente" | Pasa por el **faucet** en el registro, o acuña desde la CLI: `stellar contract invoke --id <USDC> --source primerpaso-issuer --network testnet -- mint --to <G…> --amount 15000000000` |
| No hay ningún préstamo liquidable | Abre uno 10 minutos antes de la demo con otra cuenta (ej. Carlos o una nueva) y no lo pagues. |
| Error 502 o "red no confirmó" | El RPC público de testnet a veces falla. Espera unos segundos y revisa el enlace antes de reintentar: la transacción pudo haber entrado. |
| La caché se ve desactualizada | Admin → **Pool e ingresos** → **Sincronizar**, o `npm run indexar`. |
| Todo falla | Muestra [`ensayo-demo.md`](ensayo-demo.md): el flujo completo ya ejecutado, con cada transacción en stellar.expert. |

## 4. Repetir el ensayo automático

Con la app corriendo (desde `app/`):

```bash
LUCIA_SECRET=$(stellar keys show primerpaso-demo-lucia) \
ROSA_SECRET=$(stellar keys show primerpaso-demo-rosa) \
npm run demo:ensayo
```

Lucía ya tiene un préstamo saldado: para repetir el flujo desde cero, usa una
cuenta y una wallet nuevas en el script, o vuelve a correrlo (si encuentra un
préstamo activo, lo reanuda desde los pagos).

## 5. Después de la demo (producción)

- Quitar `LOAN_PERIOD_SECONDS` (vuelve a cuotas de 30 días).
- Desde Admin → Parámetros, subir `grace_seconds` a 2592000 (30 días).
- Programar el cron del indexador (`/api/cron/indexer` con
  `Authorization: Bearer $CRON_SECRET`) cada pocos minutos.
