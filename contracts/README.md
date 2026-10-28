# Contratos PrimerPaso

Workspace Soroban con dos contratos:

- `contracts/loan`: garantía, desembolso, pagos y liquidaciones en USDC.
- `contracts/history`: historial, puntaje, credencial y mantenimiento con `bump`.

```sh
cargo test
cargo fmt --all -- --check
stellar contract build
```

Requiere Rust, rustfmt, target `wasm32v1-none` y Stellar CLI 28.
Los artefactos se generan en `target/wasm32v1-none/release/`.

Consultar [despliegue de testnet](../docs/despliegue-testnet.md) y
[operación y recuperación](../docs/operacion-y-pruebas.md). Compilar un WASM
no actualiza por sí mismo el contrato que ya esté desplegado.