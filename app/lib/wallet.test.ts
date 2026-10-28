import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getNetwork: vi.fn(), requestAccess: vi.fn(), signTransaction: vi.fn() }));
vi.mock("@stellar/freighter-api", () => api);
import { conectarFreighter, firmarXdr } from "./wallet";
beforeEach(() => {
  api.getNetwork.mockResolvedValue({ networkPassphrase: "Test SDF Network ; September 2015" });
  api.requestAccess.mockResolvedValue({ address: "wallet" });
  api.signTransaction.mockResolvedValue({ signedTxXdr: "firmado", signerAddress: "wallet" });
});
it("conecta y firma con la cuenta y red solicitadas", async () => {
  expect(await conectarFreighter()).toBe("wallet");
  expect(await firmarXdr("xdr", "wallet")).toBe("firmado");
  expect(api.signTransaction).toHaveBeenCalledWith("xdr", { address: "wallet", networkPassphrase: "Test SDF Network ; September 2015" });
});
it("bloquea la firma en otra red", async () => {
  api.getNetwork.mockResolvedValue({ networkPassphrase: "Public Global Stellar Network ; September 2015" });
  await expect(firmarXdr("xdr", "wallet")).rejects.toThrow("Testnet");
});
it("rechaza firmas de otra cuenta y cancelaciones", async () => {
  api.signTransaction.mockResolvedValue({ signedTxXdr: "firmado", signerAddress: "otra" });
  await expect(firmarXdr("xdr", "wallet")).rejects.toThrow("otra cuenta");
  api.requestAccess.mockResolvedValue({ error: { message: "cancelado" } });
  await expect(conectarFreighter()).rejects.toThrow("No se pudo conectar");
});
