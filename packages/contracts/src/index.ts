import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const PUBLIC_ORIGIN = "https://thanks2go.securedme.ca";
export const PROFILE_PATH = /^\/p\/[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const gratitudeRailSchema = z.enum(["paypal", "solana-devnet"]);
export type GratitudeRail = z.infer<typeof gratitudeRailSchema>;

const paypalAmountSchema = z.object({ currency: z.literal("USD"), minorUnits: z.literal(100) });
const solanaAmountSchema = z.object({
  currency: z.literal("SOL"),
  atomicUnits: z.string().regex(/^\d+$/).refine((value) => {
    const units = BigInt(value);
    return units >= 1_000_000n && units <= 100_000_000n;
  }, "SOL amount must be between 0.001 and 0.1 SOL")
});

export const gratitudeMandateSchema = z.object({
  version: z.literal("1"),
  id: z.string().uuid(),
  profileUrl: z.string().url().refine((url) => isCanonicalProfileUrl(url), "Invalid canonical profile URL"),
  rail: gratitudeRailSchema,
  amount: z.union([paypalAmountSchema, solanaAmountSchema]),
  recipientAttestationHash: z.string().regex(/^[a-f0-9]{64}$/),
  audience: z.string().min(3).max(200),
  nonce: z.string().min(16).max(128),
  idempotencyKey: z.string().uuid(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime()
}).superRefine((value, context) => {
  if (value.rail === "paypal" && value.amount.currency !== "USD") {
    context.addIssue({ code: "custom", path: ["amount"], message: "PayPal requires fixed USD amount" });
  }
  if (value.rail === "solana-devnet" && value.amount.currency !== "SOL") {
    context.addIssue({ code: "custom", path: ["amount"], message: "Solana devnet requires SOL amount" });
  }
  const ttl = Date.parse(value.expiresAt) - Date.parse(value.issuedAt);
  if (ttl <= 0 || ttl > 600_000) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Mandate TTL must be at most ten minutes" });
  }
});

export type GratitudeMandate = z.infer<typeof gratitudeMandateSchema>;

export const gratitudeReceiptSchema = z.object({
  version: z.literal("1"),
  mandateHash: z.string().regex(/^[a-f0-9]{64}$/),
  rail: gratitudeRailSchema,
  status: z.enum(["confirmed", "failed", "cancelled"]),
  providerReference: z.string().min(1).max(200),
  payerReference: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  confirmedAt: z.string().datetime().optional(),
  credential: z.string().min(1)
});

export type GratitudeReceipt = z.infer<typeof gratitudeReceiptSchema>;

export const publicProfileSchema = z.object({
  version: z.literal("1"),
  slug: z.literal("securedme"),
  displayName: z.literal("Jean-Sébastien Beaulieu / SecuredMe"),
  profileUrl: z.literal(`${PUBLIC_ORIGIN}/p/securedme`),
  attestation: z.object({
    originControlled: z.literal(true),
    railDestinationControlled: z.boolean(),
    humanIdentityVerified: z.literal(false)
  }),
  paypal: z.object({ offerId: z.literal("gratitude-usd-1"), displayAmount: z.literal("$1.00 USD"), enabled: z.boolean() }),
  solana: z.object({ network: z.literal("devnet"), recipient: z.string(), presets: z.tuple([z.literal("0.001"), z.literal("0.005"), z.literal("0.01")]) })
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

export const stageIntentSchema = z.object({
  profileUrl: z.string(),
  rail: gratitudeRailSchema,
  solAmount: z.enum(["0.001", "0.005", "0.01"]).optional()
});

export const PUBLIC_ERROR_CODES = [
  "INVALID_PROFILE_URL", "DECLARATION_CONFLICT", "RECIPIENT_NOT_VERIFIED",
  "MANDATE_EXPIRED", "MANDATE_TAMPERED", "HUMAN_APPROVAL_REQUIRED",
  "RAIL_REJECTED", "PAYMENT_NOT_CONFIRMED", "REFERENCE_REUSED"
] as const;
export type PublicErrorCode = typeof PUBLIC_ERROR_CODES[number];

export class PublicError extends Error {
  constructor(public readonly code: PublicErrorCode, message: string, public readonly status = 400) {
    super(message);
  }
}

export function isCanonicalProfileUrl(input: string, origin = PUBLIC_ORIGIN): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && url.origin === origin && PROFILE_PATH.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");
}

export function newMandate(input: z.infer<typeof stageIntentSchema>, recipientAttestationHash: string, now = new Date()): GratitudeMandate {
  if (!isCanonicalProfileUrl(input.profileUrl)) throw new PublicError("INVALID_PROFILE_URL", "The profile URL is not canonical.");
  const amount = input.rail === "paypal"
    ? { currency: "USD" as const, minorUnits: 100 as const }
    : { currency: "SOL" as const, atomicUnits: String(Math.round(Number(input.solAmount ?? "0.001") * 1_000_000_000)) };
  return gratitudeMandateSchema.parse({
    version: "1",
    id: randomUUID(),
    profileUrl: input.profileUrl,
    rail: input.rail,
    amount,
    recipientAttestationHash,
    audience: PUBLIC_ORIGIN,
    nonce: randomUUID().replaceAll("-", ""),
    idempotencyKey: randomUUID(),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 600_000).toISOString()
  });
}

export function assertMandateActive(mandate: GratitudeMandate, now = new Date()): void {
  gratitudeMandateSchema.parse(mandate);
  if (Date.parse(mandate.expiresAt) <= now.getTime()) throw new PublicError("MANDATE_EXPIRED", "The gratitude mandate has expired.", 410);
}
