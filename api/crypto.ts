import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT, type JWK } from "jose";
import { assertMandateActive, gratitudeMandateSchema, sha256, type GratitudeMandate } from "../packages/contracts/src/index.js";

type SigningKey = Awaited<ReturnType<typeof importJWK>>;
type KeyMaterial = { privateKey: SigningKey; publicJwk: JWK; kid: string };
let cachedKeys: Promise<KeyMaterial> | undefined;

async function loadKeys(): Promise<KeyMaterial> {
  const kid = process.env.ES256_KEY_ID ?? "thanks2go-local-ephemeral";
  const configured = process.env.ES256_PRIVATE_JWK;
  if (configured) {
    const privateJwk = JSON.parse(configured) as JWK;
    const privateKey = await importJWK(privateJwk, "ES256");
    const publicJwk = { ...privateJwk };
    delete publicJwk.d;
    return { privateKey, publicJwk: { ...publicJwk, use: "sig", alg: "ES256", kid }, kid };
  }
  if (process.env.VERCEL_ENV === "production") throw new Error("ES256_PRIVATE_JWK is required in production");
  const pair = await generateKeyPair("ES256", { extractable: true });
  const publicJwk = await exportJWK(pair.publicKey);
  return { privateKey: pair.privateKey, publicJwk: { ...publicJwk, use: "sig", alg: "ES256", kid }, kid };
}

export function keyMaterial(): Promise<KeyMaterial> {
  cachedKeys ??= loadKeys();
  return cachedKeys;
}

export async function signMandate(mandate: GratitudeMandate): Promise<string> {
  const { privateKey, kid } = await keyMaterial();
  return new SignJWT({ mandate, mandateHash: sha256(mandate) })
    .setProtectedHeader({ alg: "ES256", kid, typ: "mandate+jwt" })
    .setIssuer("https://thanks2go.securedme.ca")
    .setAudience(mandate.audience)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.parse(mandate.expiresAt) / 1000))
    .setJti(mandate.id)
    .sign(privateKey);
}

export async function verifyMandate(token: string): Promise<GratitudeMandate> {
  const { publicJwk } = await keyMaterial();
  const key = await importJWK(publicJwk, "ES256");
  const { payload, protectedHeader } = await jwtVerify(token, key, { issuer: "https://thanks2go.securedme.ca", audience: "https://thanks2go.securedme.ca" });
  if (protectedHeader.typ !== "mandate+jwt") throw new Error("MANDATE_TAMPERED");
  const mandate = gratitudeMandateSchema.parse(payload.mandate);
  if (payload.mandateHash !== sha256(mandate)) throw new Error("MANDATE_TAMPERED");
  assertMandateActive(mandate);
  return mandate;
}

export async function issueReceiptCredential(mandate: GratitudeMandate, providerReference: string, status: "confirmed" | "failed" | "cancelled", payerReference?: string): Promise<string> {
  const { privateKey, kid } = await keyMaterial();
  const now = new Date().toISOString();
  const vc = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "GratitudeReceiptCredential"],
    issuer: "https://thanks2go.securedme.ca",
    validFrom: now,
    credentialSubject: {
      id: `urn:uuid:${mandate.id}`,
      mandateHash: sha256(mandate), rail: mandate.rail, status,
      providerReference, ...(payerReference ? { payerReference } : {})
    }
  };
  return new SignJWT(vc)
    .setProtectedHeader({ alg: "ES256", kid, typ: "vc+jwt" })
    .setIssuer("https://thanks2go.securedme.ca")
    .setSubject(`urn:uuid:${mandate.id}`)
    .setIssuedAt()
    .sign(privateKey);
}

export function hashPayerReference(providerPayerId?: string): string | undefined {
  if (!providerPayerId) return undefined;
  return createHash("sha256").update(providerPayerId).digest("hex");
}
