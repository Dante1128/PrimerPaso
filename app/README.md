# Aplicación PrimerPaso

Next.js, TypeScript, Supabase y Freighter. La configuración está en `.env.example`.
Copiarla a `.env.local` y completar las credenciales de un proyecto de pruebas.
El archivo `.env` antiguo con SQLite no configura esta aplicación.

```sh
npm ci
npm run dev
```

Comprobaciones: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Navegador: `npx playwright install chromium` y `npm run test:e2e`.

Las pruebas públicas de navegador usan respuestas simuladas y no firman operaciones.
Los tests de integración del indexador usan dobles de RPC y base de datos con fallos.

Migraciones, recuperación, cron y matriz funcional de testnet:
[Operación y pruebas](../docs/operacion-y-pruebas.md).
Contrato y despliegue: [README general](../README.md).