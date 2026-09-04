import compression from "compression";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import type { AgentCard } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { ImmediateAgentExecutor, signedAgentCard, unsignedAgentCard, type AgentKind } from "../packages/a2a/src/index.js";
import { PublicError, assertMandateActive, gratitudeReceiptSchema, newMandate, publicProfileSchema, sha256, stageIntentSchema } from "../packages/contracts/src/index.js";
import { hashPayerReference, issueReceiptCredential, keyMaterial, signMandate, verifyMandate, verifyReceiptCredential } from "./crypto.js";
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
    paypal: { offerId: "gratitude-usd-1", displayAmount: "$1.00 USD", enabled: Boolean(process.env.PAYPAL_T2G_CLIENT_ID && process.env.PAYPAL_T2G_CLIENT_SECRET) },
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

export async function createApp() {
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
      if (!currentProfile.attestation.originControlled) throw new PublicError("RECIPIENT_NOT_VERIFIED", "The declared origin is not controlled.", 409);
      if (input.rail === "solana-devnet" && !currentProfile.solana.recipient) throw new PublicError("RECIPIENT_NOT_VERIFIED", "The devnet destination is not configured.", 409);
      if (input.rail === "paypal" && !currentProfile.paypal.enabled) throw new PublicError("RAIL_REJECTED", "PayPal is not configured.", 503);
      const mandate = newMandate(input, sha256({ profile: currentProfile.profileUrl, recipient: input.rail === "paypal" ? "configured-paypal-merchant" : currentProfile.solana.recipient }));
      response.status(201).json({ mandate, mandateToken: await signMandate(mandate), state: "STAGED", humanApprovalRequired: true });
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
    const handler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), new ImmediateAgentExecutor(kind, () => {
      const current = profile();
      return { profileUrl: current.profileUrl, originControlled: current.attestation.originControlled,
        railDestinationControlled: current.attestation.railDestinationControlled,
        solanaDestinationControlled: Boolean(current.solana.recipient), paypalConfigured: current.paypal.enabled };
    }));
    app.use(`/agents/${kind}/.well-known/agent-card.json`, agentCardHandler({ agentCardProvider: handler }));
    app.use(`/api/a2a/${kind}`, jsonRpcHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication, legacyCompat: { enabled: false } }));
  }

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const publicError = error instanceof PublicError ? error : undefined;
    const code = publicError?.code ?? (error instanceof Error && error.message === "MANDATE_TAMPERED" ? "MANDATE_TAMPERED" : "RAIL_REJECTED");
    response.status(publicError?.status ?? 400).json({ code, requestId: request.get("x-request-id") ?? crypto.randomUUID(), message: publicError?.message ?? "The request could not be completed." });
  });
  return app;
}
