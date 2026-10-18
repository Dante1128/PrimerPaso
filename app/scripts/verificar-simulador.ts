// Verifica el simulador contra el ejemplo de referencia del contrato:
// garantía 1.250, préstamo 1.000, 10 cuotas → interés 36,67, comisión 10, 125 liberados por pago.
import { simular } from "../lib/calculos";

const s = simular(1000, 10);
const ok =
  s.garantia === 1250 &&
  s.comision === 10 &&
  s.recibes === 990 &&
  s.interesTotal === 36.6666663 &&
  s.calendario.every((c) => c.garantiaLiberada === 125);
console.log({ garantia: s.garantia, comision: s.comision, recibes: s.recibes, interesTotal: s.interesTotal, costoNeto: s.costoNeto });
console.log(ok ? "OK: coincide con el contrato" : "ERROR: no coincide");
process.exit(ok ? 0 : 1);
