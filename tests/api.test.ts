import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { Express } from "express";
import { exportJWK, generateKeyPair } from "jose";
import { newMandate } from "@thanks2go/contracts";
import { signMandate } from "../api/crypto.js";

let app: Express;
let server: Server;
beforeAll(async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  process.env.ES256_PRIVATE_JWK = JSON.stringify(await exportJWK(pair.privateKey));
  process.env.ES256_KEY_ID = "thanks2go-test";
  process.env.SOLANA_DEVNET_RECIPIENT = "6ywCP21EgS6a7y752rHT38qDypsb9NNLi2Db5iYXd9qj";
  process.env.PAYPAL_T2G_CLIENT_ID = "configured-for-contract-test";
  let agentOrigin = "";
  app = await (await import("../api/app.js")).createApp({ agentOrigin: () => agentOrigin });
  server = await new Promise<Server>(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  agentOrigin = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
afterEach(() => vi.unstubAllEnvs());

describe("API boundaries", () => {
  it("returns a filtered public profile", async () => {
    const response = await request(app).get("/api/profiles/securedme").expect(200);
    expect(response.body.displayName).toContain("SecuredMe");
    expect(JSON.stringify(response.body)).not.toMatch(/secret|email/i);
  });

  it("rejects cross-origin writes", async () => {
    await request(app).post("/api/intents/stage").set("Origin", "https://evil.example").send({}).expect(403);
  });

  it("stages but does not approve a bounded intent", async () => {
    const response = await request(app).post("/api/intents/stage").send({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "solana-devnet", solAmount: "0.001" }).expect(201);
    expect(response.body.state).toBe("STAGED");
    expect(response.body.humanApprovalRequired).toBe(true);
    expect(response.body.mandate.amount.atomicUnits).toBe("1000000");
    expect(response.body.agentExchange.recipient.solanaControlProofVerified).toBe(true);
    expect(response.body.agentExchange.recipient.credential.split(".")).toHaveLength(3);
  });

  it("handles two simultaneous HTTP A2A staging exchanges", async () => {
    const body = { profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "solana-devnet", solAmount: "0.001" };
    const responses = await Promise.all([
      request(app).post("/api/intents/stage").send(body),
      request(app).post("/api/intents/stage").send(body)
    ]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    expect(responses.every(response => response.body.agentExchange?.recipient?.credential)).toBe(true);
  });

  it("refuses PayPal order creation without explicit approval", async () => {
    await request(app).post("/api/paypal/orders").send({ mandateToken: "irrelevant", humanApproved: false }).expect(409);
  });

  it("maps an expired JWT to the public 410 contract", async () => {
    const expired = newMandate({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "paypal" }, "a".repeat(64), new Date(Date.now() - 700_000));
    const mandateToken = await signMandate(expired);
    const response = await request(app).post("/api/paypal/orders").send({ mandateToken, humanApproved: true }).expect(410);
    expect(response.body).toMatchObject({code:"MANDATE_EXPIRED",message:"The gratitude mandate has expired."});
  });

  it("uses only the exact Vercel preview hostname for transport and Origin", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "thanks2go-git-audit-owner.vercel.app");
    const { resolveAllowedOrigins, resolveTransportOrigin } = await import("../api/app.js");
    expect(resolveTransportOrigin(() => "http://127.0.0.1:4555")).toBe("https://thanks2go-git-audit-owner.vercel.app");
    expect(resolveAllowedOrigins()).toEqual(new Set(["https://thanks2go.securedme.ca", "https://thanks2go-git-audit-owner.vercel.app"]));
    await request(app).get("/api/health").set("Origin", "https://thanks2go-git-audit-owner.vercel.app").expect(200);
    await request(app).get("/api/health").set("Origin", "https://attacker.vercel.app").expect(403);
  });

  it("does not admit a Vercel deployment hostname in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "thanks2go-production-alias.vercel.app");
    const { resolveAllowedOrigins, resolveTransportOrigin } = await import("../api/app.js");
    expect(resolveTransportOrigin()).toBe("https://thanks2go.securedme.ca");
    expect(resolveAllowedOrigins()).toEqual(new Set(["https://thanks2go.securedme.ca"]));
  });

  it("publishes JWKS and both agent cards", async () => {
    const jwks = await request(app).get("/.well-known/jwks.json").expect(200);
    expect(jwks.body.keys[0].alg).toBe("ES256");
    const payer = await request(app).get("/agents/payer/.well-known/agent-card.json").expect(200);
    const recipient = await request(app).get("/agents/recipient/.well-known/agent-card.json").expect(200);
    expect(payer.body.signatures).toHaveLength(1);
    expect(recipient.body.signatures).toHaveLength(1);
  });

  it("performs a real A2A 1.0 SendMessage exchange", async () => {
    const response = await request(app).post("/api/a2a/recipient")
      .set("A2A-Version", "1.0")
      .send({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: crypto.randomUUID(), role: "ROLE_USER", parts: [{ text: JSON.stringify({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "solana-devnet" }), mediaType: "application/json" }] } } })
      .expect(200);
    expect(response.body.result.message.role).toBe("ROLE_AGENT");
    expect(response.body.result.message.parts[0].text).toContain("humanIdentityVerified");
  });

  it("rejects an unsupported A2A protocol version", async () => {
    const response = await request(app).post("/api/a2a/recipient")
      .set("A2A-Version", "0.3")
      .send({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: crypto.randomUUID(), role: "ROLE_USER", parts: [{ text: "{}", mediaType: "application/json" }] } } })
      .expect(400);
    expect(response.body.error.code).toBe(-32009);
    expect(response.body.error.data[0].reason).toBe("VERSION_NOT_SUPPORTED");
  });

  it("rejects malformed A2A params without invoking an agent", async () => {
    const response = await request(app).post("/api/a2a/recipient")
      .set("A2A-Version", "1.0")
      .send({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: {} })
      .expect(200);
    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.data[0].reason).toBe("INVALID_PARAMS");
  });
});
