import { createPublicKey, verify } from "node:crypto";
import bs58 from "bs58";
import proof from "../docs/RECIPIENT_ATTESTATION.json" with { type: "json" };

export function verifyRecipientControl(recipient: string): boolean {
  try {
    if (recipient !== proof.recipient || proof.network !== "devnet" || !proof.challenge.startsWith("Thanks2Go recipient-control proof|https://thanks2go.securedme.ca/p/securedme|")) return false;
    const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(bs58.decode(recipient)).toString("base64url") }, format: "jwk" });
    return verify(null, Buffer.from(proof.challenge), publicKey, Buffer.from(proof.signature, "base64url"));
  } catch { return false; }
}
