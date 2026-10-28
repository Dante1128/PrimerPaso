# Operación y pruebas

## Comprobaciones

Desde `app`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` y
`npm run build`. Para navegador: `npx playwright install chromium` y
`npm run test:e2e`. Desde `contracts`: `cargo test`, `cargo fmt --all -- --check`
y `stellar contract build`. Instalar rustfmt con `rustup component add rustfmt`.

`.github/workflows/checks.yml` ejecuta las comprobaciones en push y pull request.
Las pruebas del navegador usan configuración ficticia y respuestas controladas
para el simulador y errores de ingreso. Revisan pantallas públicas en móvil y
escritorio, desbordamientos y denegación de acceso sin sesión; no sustituyen las
pruebas con Supabase ni una firma real de Freighter.

`migracion.test.ts` ejecuta `0005` sobre PostgreSQL embebido (PGlite): comprueba
la sintaxis, límites de cuotas, rechazo de solicitudes simultáneas y permisos
de transacciones preparadas. No valida la configuración de una cuenta Supabase real.

## Aplicar esta actualización

1. Respaldar la base y aplicar las migraciones `0001` a `0005` en orden, solo las
   pendientes. `0005` se detiene si encuentra solicitudes simultáneas: resolver
   cada caso con el operador, sin borrar solicitudes automáticamente.
2. Compilar contratos y actualizar **history** para habilitar `bump(borrower)`;
   conservar dirección y datos. Revisar red, administrador y hash. No es necesario
   actualizar el código desplegado de loan para estos cambios.
3. Completar `app/.env.local` desde `.env.example`. `DATABASE_URL` debe ser
   PostgreSQL de Supabase, no un archivo SQLite antiguo.
4. Desplegar la app y verificar el cron. Reabrir los paneles antes de firmar:
   los XDR preparados por versiones anteriores no están registrados y se rechazan.
5. Ejecutar la matriz funcional y guardar los resultados y hashes.

Actualizar history en testnet desde `contracts`:

```sh
stellar contract upload --wasm target/wasm32v1-none/release/history.wasm --source primerpaso-admin --network testnet
stellar contract invoke --id <HISTORY> --source primerpaso-admin --network testnet -- upgrade --wasm_hash <HASH_DEVUELTO>
```

## Matriz funcional en testnet

Usar cuentas y documentos ficticios en una base de pruebas. Guardar cuenta,
solicitud, préstamo, hash y resultado esperado/observado para cada caso.

| Caso | Comprobar |
| --- | --- |
| Registro y código | Rechaza un código inválido, confirma uno válido y retoma pasos pendientes. |
| KYC | Rechazo con motivo, reenvío y aprobación; documentos privados inaccesibles a otro usuario. |
| Wallet | SEP-10 correcto; bloquea otra cuenta o red al firmar. |
| Garantía propia | 1.250 USDC respaldan 1.000; recibe 990 con comisión del 1%. |
| Garante | Desembolso al estudiante; liberación de garantía al garante. |
| Pago parcial | Completa la cuota al cubrir su capital; primero paga interés pendiente. |
| Pago anticipado | Libera garantía proporcional; último pago devuelve el remanente. |
| Pago atrasado | Fecha y puntualidad por cuota, incluso si un pago completa varias. |
| Liquidación | Falla antes de la gracia; después recupera deuda y devuelve remanente. |
| Credencial | Puntaje y credencial coinciden con history y el verificador público. |
| Recuperación | Interrumpir creación de cuotas; reintentar sin duplicar préstamo ni ingresos. |
| Concurrencia | Dos POST simultáneos: uno crea, otro devuelve 409; solo una solicitud en curso. |
| Seguridad | XDR de otra solicitud rechazado; documentos y préstamos ajenos protegidos. |
| Móvil y red | Sin desbordamiento; errores visibles y posibilidad de reintentar. |

## Recuperar el indexador

`indexer_state.last_cursor` conserva la posición exacta al cortar páginas. El
checkpoint avanza después de guardar los eventos de la página. Un evento se
marca `processed=true` solo tras completar su proyección. Las escrituras de
cuotas y asociaciones se repiten aunque el préstamo ya exista. Las aperturas se
asocian por `prepared_transactions.tx_hash`, nunca por la última solicitud aprobada.

Consultar eventos pendientes y progreso:

```sql
select contract_id, event_type, ledger, tx_hash
from public.onchain_events where not processed order by ledger, event_index;
select contract_id, last_ledger, last_cursor, updated_at from public.indexer_state;
```

Corregir la causa y ejecutar `npm run indexar` o el cron. Para reconstruir una
proyección ya procesada, marcar **solo los eventos identificados** como
`processed=false`. No borrar préstamos ni movimientos. El calendario se
reconstruye desde todos los pagos crudos del préstamo conservados en la base.
Comprobar que no falten eventos históricos. En datos anteriores sin orden de
transacción, contrastar pagos del mismo ledger con un RPC/archivo histórico.

Si un checkpoint está fuera de la retención del RPC, el proceso falla sin saltar
el intervalo. Recuperar eventos de un proveedor histórico, verificar continuidad
y ajustar el checkpoint. Un proyecto sin checkpoint solo importa la ventana
conservada por su RPC; eso no implica recuperar toda la historia del contrato.

## Mantener y restaurar almacenamiento

El cron renueva préstamos activos e historiales/credenciales de `credit_profiles`
con menos de siete días de TTL. `history.bump(borrower)` no cambia datos y puede
invocarlo cualquiera. Direcciones fuera de esa tabla necesitan mantenimiento
separado. `npm run renovar` informa errores y termina con código distinto de cero
si encuentra entradas archivadas o errores.

`bump` mantiene datos vivos, pero no restaura entradas archivadas. Identificar
préstamo, posición o dirección; usar la restauración de Stellar CLI/RPC de la red
correspondiente (`stellar contract restore --help` en la versión instalada),
pagar con la cuenta de mantenimiento y volver a ejecutar `bump` e indexador.
Comprobar que `get_loan`, `get_record` y `get_credential` conservan los valores.
No reemplazar un historial archivado por un registro vacío.

## Cron y alertas

Programar al menos una ejecución diaria de `/api/cron/indexer` con
`Authorization: Bearer <CRON_SECRET>`. No poner el secreto en URLs ni logs.
`app/vercel.json` deja una ejecución diaria a las 08:00 UTC (04:00 en Bolivia)
para despliegues cuyo directorio raíz sea `app`. Configurar `CRON_SECRET` en
el hosting y verificar la primera ejecución tras desplegar. En otro hosting,
crear la tarea equivalente. La configuración local no activa un cron remoto.
Configurar el monitor del hosting para avisar al responsable ante:

- Respuestas 5xx, ausencia de ejecuciones o duración excesiva.
- Eventos pendientes, entradas archivadas o errores de renovación.
- Checkpoint sin avanzar pese a existir actividad en la cadena.

El cron devuelve 503 y registra `[cron/indexer] Requiere atención` cuando detecta
esos problemas. `ocupado` informa que ya existe otro indexador; no representa una
sincronización nueva. El monitor y su destino se configuran en la cuenta del
hosting; no se crean automáticamente por agregar el workflow de CI.

## Antes de mainnet

Completar `seguridad.md`, validar backups y restauración, definir responsables de
llaves y alertas, y obtener una revisión independiente de contratos. Las pruebas
automáticas no sustituyen esa revisión.
