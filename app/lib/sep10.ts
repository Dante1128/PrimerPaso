// SEP-10: autenticación web de Stellar (challenge + verificación de firma).
//
// Flujo:
//  1. El cliente pide un "challenge": una transacción con secuencia 0 que el
//     servidor firma. (buildChallenge)
//  2. El cliente la firma con su wallet (Freighter) demostrando que controla
//     la cuenta, y la devuelve.
//  3. El servidor verifica que la cuenta firmó correctamente. (verifyChallenge)
import { WebAuth } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, sep10ServerKeypair } from "@/lib/stellar";

const HOME_DOMAIN =
  process.env.NEXT_PUBLIC_SEP10_HOME_DOMAIN ?? "localhost:3000";
const WEB_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_SEP10_WEB_AUTH_DOMAIN ?? HOME_DOMAIN;

/** Construye el challenge SEP-10 (XDR base64) para una cuenta cliente. */
export function buildChallenge(clientAccount: string): string {
  const server = sep10ServerKeypair();
  return WebAuth.buildChallengeTx(
    server,
    clientAccount,
    HOME_DOMAIN,
    300, // vigencia en segundos
    NETWORK_PASSPHRASE,
    WEB_AUTH_DOMAIN,
  );
}

/**
 * Verifica el challenge firmado por el cliente.
 * Devuelve la dirección verificada o lanza un error si la firma no es válida.
 */
export function verifyChallenge(signedXdr: string): string {
  const serverPub = sep10ServerKeypair().publicKey();

  // Lee el challenge y extrae la cuenta cliente.
  const { clientAccountID } = WebAuth.readChallengeTx(
    signedXdr,
    serverPub,
    NETWORK_PASSPHRASE,
    [HOME_DOMAIN],
    WEB_AUTH_DOMAIN,
  );

  // Verifica que la cuenta cliente haya firmado.
  WebAuth.verifyChallengeTxSigners(
    signedXdr,
    serverPub,
    NETWORK_PASSPHRASE,
    [clientAccountID],
    [HOME_DOMAIN],
    WEB_AUTH_DOMAIN,
  );

  return clientAccountID;
}
