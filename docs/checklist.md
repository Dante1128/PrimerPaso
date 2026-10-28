# Checklist de cierre — 28 de octubre de 2026

## Implementado y verificado localmente

- [x] Recuperación de escrituras parciales del indexador sin duplicar préstamos ni ingresos.
- [x] Cursor persistido para retomar páginas sin saltar eventos.
- [x] Rechazo del XDR si cambia su contenido, usuario, solicitud o método respecto al preparado.
- [x] Comprobación estructural de contrato, método y fuente de la invocación.
- [x] Asociación exacta de nuevas aperturas por hash; recuperación de confirmaciones desde eventos.
- [x] Reconstrucción de fechas y puntualidad de cuotas desde pagos históricos.
- [x] Renovación de historial y credenciales: código del contrato y mantenimiento del cron.
- [x] Restricción PostgreSQL de una solicitud en curso por estudiante.
- [x] Pruebas de migración, concurrencia y permisos en PostgreSQL embebido.
- [x] Integración directa con Freighter y validación de red/cuenta al firmar.
- [x] Correcciones de desbordamientos en simulador y registro.
- [x] CI de aplicación, navegador y contratos preparada.
- [x] Configuración de cron diario para Vercel preparada.
- [x] Documentación de despliegue, recuperación, almacenamiento y alertas actualizada.
- [x] ESLint, TypeScript y compilación Next.js correctos.
- [x] 72 pruebas de la aplicación aprobadas.
- [x] 26 pruebas de contratos aprobadas; WASM compilados con Stellar CLI.
- [x] 9 pruebas de navegador aprobadas: 320 px, 390 px y escritorio.
- [x] Auditoría npm sin vulnerabilidades reportadas tras retirar conectores no utilizados.

## Pendiente de servicios y credenciales

- [ ] Completar `.env.local` con Supabase y las cuentas Stellar correctas.
- [ ] Respaldar la base real y aplicar `0005_consistencia.sql`.
- [ ] Actualizar history desplegado para incorporar `bump`.
- [ ] Activar el cron en el hosting y configurar `CRON_SECRET` y destino de alertas.
- [ ] Ejecutar la matriz funcional completa con Supabase, email y Freighter reales.
- [ ] Verificar RLS y Storage contra el proyecto Supabase de destino.
- [ ] Validar renovación/restauración sobre la red con las cuentas de mantenimiento.
- [ ] Completar las medidas de producción y revisión independiente antes de mainnet.

El entorno revisado tiene una conexión SQLite antigua en `app/.env`, sin las
variables de Supabase necesarias. La identidad CLI `primerpaso-admin` disponible
no coincide con el administrador que devuelve el contrato history documentado;
se comprobó mediante una lectura simulada. No se actualizaron contratos remotos
ni se aplicaron migraciones a una base externa.

Las pruebas de navegador público usan servicios simulados. Las pruebas de
migración usan PostgreSQL embebido; no certifican la configuración remota.
Procedimiento y matriz de aceptación: [operación y pruebas](operacion-y-pruebas.md).
