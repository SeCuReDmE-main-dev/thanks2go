import compression from "compression";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import bs58 from "bs58";
import { AgentCard, verifyAgentCardSignature } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { ImmediateAgentExecutor, signedAgentCard, unsignedAgentCard, sendAgentMessage, type AgentKind } from "../packages/a2a/src/index.js";
import { PublicError, assertMandateActive, gratitudeReceiptSchema, newMandate, publicProfileSchema, sha256, stageIntentSchema } from "../packages/contracts/src/index.js";
import { hashPayerReference, issueReceiptCredential, issueRecipientControlCredential, keyMaterial, signMandate, verifyMandate, verifyReceiptCredential, verifyRecipientControlCredential, type RecipientControlClaims } from "./crypto.js";
import { captureOrder, createOrder } from "./paypal.js";
import { verifySolanaTransaction } from "./solana.js";
import { verifyRecipientControl } from "./recipient.js";

const origin = process.env.PUBLIC_ORIGIN ?? "https://thanks2go.securedme.ca";
const allowedOrigins = new Set([origin, ...(process.env.VERCEL_ENV === "production" ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"])]);

function profile() {
  const recipient = process.env.SOLANA_DEVNET_RECIPIENT ?? "";
  const solanaControlled = verifyRecipientControl(recipient);
  return publicProfileSchema.parse({
    version: "1", slug: "securedme", displayName: "Jean-Sébastien Beaulieu / SecuredMe", profileUrl: `${origin}/p/securedme`,
    attestation: { originControlled: true, railDestinationControlled: false, humanIdentityVerified: false },
    paypal: { offerId: "gratitude-usd-1", displayAmount: "$1.00 USD", enabled: Boolean(process.env.PAYPAL_T2G_CLIENT_ID && process.env.PAYPAL_T2G_CLIENT_SECRET), environment: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox" },
    solana: { network: "devnet", recipient: solanaControlled ? recipient : "", presets: ["0.001", "0.005", "0.01"] }
  });
}

async function card(kind: AgentKind): Promise<AgentCard> {
  const keys = await keyMaterial();
  const privateText = process.env.ES256_PRIVATE_JWK;
  if (!privateText) {
    const unsigned = unsignedAgentCard(kind, origin);
    return { ...unsigned, description: `${unsigned.description} Local ephemeral-key mode; unsigned card.` };
  }
  return signedAgentCard(kind, origin, JSON.parse(privateText), keys.kid);
}

export async function createApp(options: { agentOrigin?: () => string } = {}) {
  const transportOrigin = () => process.env.VERCEL_ENV === "production" ? origin : options.agentOrigin?.() ?? process.env.A2A_LOCAL_ORIGIN ?? "http://127.0.0.1:3001";
  async function askAgent(kind: AgentKind, input: unknown) {
    // Endpoint comes only from server configuration, never from the caller.
    const response = await fetch(`${transportOrigin()}/agents/${kind}/.well-known/agent-card.json`, {signal:AbortSignal.timeout(8_000)});
    if (!response.ok) throw new PublicError("RECIPIENT_NOT_VERIFIED", "Agent card is unavailable.", 503);
    const agentCard = AgentCard.fromJSON(await response.json());
    if (process.env.ES256_PRIVATE_JWK) {
      const keys = await keyMaterial();
      await verifyAgentCardSignature(async (kid, jku) => {
        if (kid !== keys.kid || jku !== `${origin}/.well-known/jwks.json`) throw new Error("Unknown agent signer");
        return keys.publicJwk;
      })(agentCard);
    }
    // Local tests use a loopback transport after verifying the canonical signed card.
    const transportCard = process.env.VERCEL_ENV === "production" ? agentCard : {...agentCard, supportedInterfaces: unsignedAgentCard(kind, transportOrigin()).supportedInterfaces};
    const result = await sendAgentMessage(transportCard, input);
    if (result.error) throw new PublicError("RECIPIENT_NOT_VERIFIED", "The agent could not verify this request.", 409);
    return result;
  }
  function recipientClaims(input: unknown): RecipientControlClaims {
    const request = stageIntentSchema.parse(input);
    const current = profile();
    if (request.profileUrl !== current.profileUrl) throw new PublicError("INVALID_PROFILE_URL", "Unknown gratitude profile.", 404);
    const controlled = request.rail === "solana-devnet" ? Boolean(current.solana.recipient) : current.paypal.enabled;
    if (!controlled) throw new PublicError("RECIPIENT_NOT_VERIFIED", "This rail is not configured or verified.", 409);
    const recipient = request.rail === "solana-devnet" ? current.solana.recipient : "configured-paypal-merchant";
    return { agent: "recipient", profileUrl: current.profileUrl, rail: request.rail, recipient,
      originControlled: true, solanaControlProofVerified: request.rail === "solana-devnet", humanIdentityVerified: false,
      recipientAttestationHash: sha256({ profile: current.profileUrl, recipient }) };
  }
  async function inspectRecipient(input: unknown): Promise<Record<string, unknown>> {
    const claims = recipientClaims(input);
    return { ...claims, credential: await issueRecipientControlCredential(claims) };
  }
  async function stageWithRecipient(input: unknown): Promise<Record<string, unknown>> {
    const request = stageIntentSchema.parse(input);
    const trust = await askAgent("recipient", request);
    const credential = String(trust.credential ?? "");
    const { credential: _credential, ...receivedClaims } = trust;
    const expected = recipientClaims(request);
    if (sha256(receivedClaims) !== sha256(expected)) throw new PublicError("RECIPIENT_NOT_VERIFIED", "Recipient response does not match current configuration.", 409);
    await verifyRecipientControlCredential(credential, expected);
    const mandate = newMandate(request, expected.recipientAttestationHash);
    const mandateHash = sha256(mandate);
    return { mandate, mandateHash, reference: bs58.encode(Buffer.from(mandateHash, "hex")), mandateToken: await signMandate(mandate), state: "STAGED", humanApprovalRequired: true,
      agentExchange: { payer: "stage-only", recipient: trust } };
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(express.json({ limit: "32kb", type: ["application/json", "application/*+json"] }));
  app.use((request, _response, next) => {
    const requestOrigin = request.get("origin");
    if (requestOrigin && !allowedOrigins.has(requestOrigin)) return next(new PublicError("RAIL_REJECTED", "Cross-origin request rejected.", 403));
    next();
  });

  app.get("/api/health", (_request, response) => response.json({ ok: true, service: "thanks2go", persistence: "none" }));
  app.get("/api/profiles/:slug", (request, response, next) => {
    try { if (request.params.slug !== "securedme") throw new PublicError("INVALID_PROFILE_URL", "Unknown profile.", 404); response.json(profile()); } catch (error) { next(error); }
  });
  app.post("/api/intents/stage", async (request, response, next) => {
    try {
      const input = stageIntentSchema.parse(request.body);
      const currentProfile = profile();
      if (input.profileUrl !== currentProfile.profileUrl) throw new PublicError("INVALID_PROFILE_URL", "Unknown gratitude profile.", 404);
      if (!currentProfile.attestation.originControlled) throw new PublicError("RECIPIENT_NOT_VERIFIED", "The declared origin is not controlled.", 409);
      if (input.rail === "solana-devnet" && !currentProfile.solana.recipient) throw new PublicError("RECIPIENT_NOT_VERIFIED", "The devnet destination is not configured.", 409);
      if (input.rail === "paypal" && !currentProfile.paypal.enabled) throw new PublicError("RAIL_REJECTED", "PayPal is not configured.", 503);
      response.status(201).json(await askAgent("payer", input));
    } catch (error) { next(error); }
  });
  app.post("/api/paypal/orders", async (request, response, next) => {
    try {
      if (request.body?.humanApproved !== true) throw new PublicError("HUMAN_APPROVAL_REQUIRED", "Visible human approval is required.", 409);
      const mandate = await verifyMandate(String(request.body?.mandateToken ?? ""));
      assertMandateActive(mandate);
      const order = await createOrder(mandate);
      response.status(201).json({ orderId: order.id, status: order.status, approveUrl: order.approveUrl, state: "PROVIDER_PENDING" });
    } catch (error) { next(error); }
  });
  app.post("/api/paypal/orders/:id/capture", async (request, response, next) => {
    try {
      if (request.body?.humanApproved !== true) throw new PublicError("HUMAN_APPROVAL_REQUIRED", "Visible human approval is required.", 409);
      const mandate = await verifyMandate(String(request.body?.mandateToken ?? ""));
      const result = await captureOrder(request.params.id!, mandate);
      const providerReference = result.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? result.id;
      const payerReference = hashPayerReference(result.payer?.payer_id);
      const confirmedAt = new Date().toISOString();
      const credential = await issueReceiptCredential(mandate, providerReference, "confirmed", payerReference, confirmedAt);
      response.json({ version: "1", mandateHash: sha256(mandate), rail: "paypal", status: "confirmed", providerReference, ...(payerReference ? { payerReference } : {}), confirmedAt, credential });
    } catch (error) { next(error); }
  });
  app.post("/api/solana/verify", async (request, response, next) => {
    try {
      const mandate = await verifyMandate(String(request.body?.mandateToken ?? ""));
      await verifySolanaTransaction(String(request.body?.signature ?? ""), mandate, profile().solana.recipient);
      const providerReference = String(request.body.signature);
      const confirmedAt = new Date().toISOString();
      const credential = await issueReceiptCredential(mandate, providerReference, "confirmed", undefined, confirmedAt);
      response.json({ version: "1", mandateHash: sha256(mandate), rail: "solana-devnet", status: "confirmed", providerReference, confirmedAt, credential });
    } catch (error) { next(error); }
  });
  app.post("/api/receipts/verify", async (request, response, next) => {
    try {
      const receipt = await verifyReceiptCredential(request.body);
      response.json({ valid: true, receipt });
    } catch (error) { next(error); }
  });
  app.get("/.well-known/jwks.json", async (_request, response, next) => { try { const { publicJwk } = await keyMaterial(); response.json({ keys: [publicJwk] }); } catch (error) { next(error); } });

  for (const kind of ["payer", "recipient"] as const) {
    const agentCard = await card(kind);
    const handler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), new ImmediateAgentExecutor(kind === "payer" ? stageWithRecipient : inspectRecipient));
    app.use(`/agents/${kind}/.well-known/agent-card.json`, agentCardHandler({ agentCardProvider: handler }));
    app.use(`/api/a2a/${kind}`, (request, response, next) => {
      if (request.get("A2A-Version") === "1.0") return next();
      response.status(400).json({ jsonrpc: "2.0", id: request.body?.id ?? null, error: {
        code: -32009, message: "Only A2A protocol version 1.0 is supported.",
        data: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "VERSION_NOT_SUPPORTED", domain: "a2a-protocol.org" }]
      } });
    });
    app.use(`/api/a2a/${kind}`, jsonRpcHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication, legacyCompat: { enabled: false } }));
  }

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const publicError = error instanceof PublicError ? error : undefined;
    const code = publicError?.code ?? (error instanceof Error && error.message === "MANDATE_TAMPERED" ? "MANDATE_TAMPERED" : "RAIL_REJECTED");
    response.status(publicError?.status ?? 400).json({ code, requestId: request.get("x-request-id") ?? crypto.randomUUID(), message: publicError?.message ?? "The request could not be completed." });
  });
  return app;
}
