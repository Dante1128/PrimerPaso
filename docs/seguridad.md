# Seguridad de PrimerPaso en producción

PrimerPaso corre hoy en **Stellar Testnet** con cuentas de prueba. Este documento
dice qué cambia al salir a producción (mainnet). Las medidas que podrían bloquear
la demo se controlan con variables de entorno: **apagadas en testnet y encendidas
en producción**.

## Variables de entorno

| Variable | Testnet | Producción | Qué hace |
| --- | --- | --- | --- |
| `REQUIRE_STAFF_MFA` | `false` | `true` | Operadores y admins deben verificar un código TOTP (aal2) para usar su panel y la API. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | vacías | claves del sitio | CAPTCHA de Cloudflare Turnstile en registro, ingreso y pedido de código. Vacías = sin CAPTCHA. |
| `AUTH_RATE_LIMIT` / `AUTH_RATE_LIMIT_MAX` | `true` / `10` | `true` / `10` | Máximo de intentos por minuto en `/api/auth/*`, por IP y por correo. |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `false` | opcional | Botón de Google (solo estudiantes y garantes). |
| `ADMIN_SECRET_KEY` | llave de prueba | **vacía** | La llave admin del contrato no vive en el servidor (ver abajo). |
| `USDC_ISSUER_SECRET` | llave de prueba | **vacía** | Faucet de USDC de prueba: solo existe en testnet. |
| `LOAN_PERIOD_SECONDS` | `300` | vacía (30 días) | Duración de cada cuota. |

Claves de prueba oficiales de Turnstile para probar en local (siempre aprueban):
`NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` y
`TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`.

## Cuentas y roles

- **El rol se elige una sola vez** en el registro (estudiante o garante) y no se
  cambia después: `/api/auth/role` responde 409. El rol queda en `app_metadata`,
  que el usuario no puede editar.
- **El staff (operator y admin) nunca entra con Google**: se le cierra la sesión.
  Entra con contraseña o con código por correo.
- **Sesión de staff de máximo 12 horas** desde el ingreso. Verificar el TOTP más
  tarde no reinicia el reloj.
- **Cada ingreso del staff queda en `audit_logs`**, igual que las revisiones de
  KYC y solicitudes, las liquidaciones, los cambios de parámetros y los cambios
  del equipo. El admin ve las últimas 50 acciones en la pestaña "Auditoría".
- **Operadores**: los invita el admin desde la pestaña "Equipo" (correo de
  Supabase) y ahí mismo se desactivan. Un admin no puede desactivarse ni quitarse
  su rol.

### Crear el admin de producción

El admin de producción **nunca** se crea con el seed (`npm run db:seed` se niega
a correr con `NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC`).

1. Supabase → **Authentication → Users → Add user**: correo real del
   responsable, contraseña larga y única, marcar **Auto Confirm User**.
2. Supabase → **SQL Editor**, cambiando el correo:
   ```sql
   update public.profiles
      set role = 'admin'
    where id = (select id from auth.users where email = 'admin@tu-dominio.com');

   update auth.users
      set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
    where email = 'admin@tu-dominio.com';
   ```
3. Ingresa en `/ingresar` con contraseña. Como `REQUIRE_STAFF_MFA=true`, el
   panel muestra el QR: escanéalo con una app de autenticación y verifica el código.
4. Desde la pestaña "Equipo", invita a los operadores.

## Llaves de Stellar

| Cuenta | Dónde vive | Qué puede hacer |
| --- | --- | --- |
| **Admin del contrato** | Fuera del servidor: cuenta **multifirma** (varios firmantes, umbral > 1, llave maestra con peso 0). | `set_params`, `set_operator`, `set_treasury`, `pause`, `upgrade`. |
| **Operator** | `OPERATOR_SECRET_KEY` en el servidor. | Solo co-firma la apertura de préstamos, liquida préstamos en mora y renueva su vida (`bump`). No mueve fondos del pool por su cuenta. |
| **Treasury (pool)** | Cuenta aparte, fuera del servidor. Solo se configura `TREASURY_ADDRESS` (pública). | Recibe pagos y liquidaciones. Su dueño otorga al contrato la *allowance* para desembolsar (`approve`) y la renueva antes de que venza. |

- Como el admin es multifirma, en producción `ADMIN_SECRET_KEY` queda vacía. Los
  cambios de parámetros se firman aparte con la multifirma y el indexador los
  copia a la base (evento `params_updated`). La pestaña "Parámetros" lo explica si
  alguien intenta guardar.
- Si se filtra la llave del operator: el admin la revoca con
  `set_operator(<operator>, false)` y registra una nueva. Los fondos del pool no
  dependen de esa llave.
- La llave SEP-10 (`SEP10_SERVER_SECRET`) solo firma desafíos de autenticación
  de wallets; no tiene fondos.

## Supabase

- **Authentication → Providers → Email**: confirmación de email activada.
- **Authentication → Multi-Factor**: TOTP habilitado (viene activo por defecto).
- **Authentication → URL Configuration**: Site URL de producción y, en Redirect
  URLs, `https://tu-dominio.com/auth/callback`.
- **Google** (opcional): activar el proveedor con el Client ID y el Secret de
  Google Cloud y poner `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
- **SMTP propio** (Authentication → Emails): el SMTP de prueba de Supabase solo
  manda unos pocos correos por hora y a direcciones limitadas. Sin SMTP propio no
  llegan las invitaciones de operadores ni los códigos.
- `SUPABASE_SECRET_KEY` y `DATABASE_URL` solo en el servidor; nunca en variables
  `NEXT_PUBLIC_*`.
- El límite de intentos usa la IP de `x-forwarded-for`. Detrás de Vercel ese
  encabezado lo pone la plataforma; con otro proxy, verifica que no lo pueda
  falsificar el cliente.

## Cuentas de prueba

Ninguna cuenta `@primerpaso.test` debe existir en la base de producción. Esta
consulta debe devolver **0**:

```sql
select count(*) from auth.users where email like '%@primerpaso.test';
```

## Lista de verificación antes de salir al mercado

- [ ] Base de producción nueva, creada con las migraciones `supabase/migrations/0001` a `0005`, **sin** correr el seed.
- [ ] `select count(*) from auth.users where email like '%@primerpaso.test'` devuelve 0.
- [ ] Admin creado a mano con correo real y TOTP verificado.
- [ ] `REQUIRE_STAFF_MFA=true` y el panel del staff pide el código.
- [ ] Turnstile configurado: el registro y el ingreso muestran el CAPTCHA.
- [ ] `AUTH_RATE_LIMIT=true`.
- [ ] `NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC`, RPC de mainnet y contratos desplegados en mainnet.
- [ ] Admin del contrato en multifirma; `ADMIN_SECRET_KEY` vacía en el servidor.
- [ ] Treasury en una cuenta aparte, con la allowance al contrato vigente.
- [ ] `USDC_ISSUER_SECRET` vacía (sin faucet) y `NEXT_PUBLIC_USDC_CONTRACT_ID` apuntando al USDC real de Circle.
- [ ] `LOAN_PERIOD_SECONDS` vacía (cuotas de 30 días) y `grace_seconds` del contrato en días, no en segundos de demo.
- [ ] SMTP propio configurado y correos de prueba recibidos (código e invitación).
- [ ] Redirect URLs de Supabase solo con el dominio de producción.
- [ ] Cron del indexador (`/api/cron/indexer`) con `CRON_SECRET` largo y aleatorio.
