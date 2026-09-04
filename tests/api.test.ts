import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { exportJWK, generateKeyPair } from "jose";

let app: Express;
beforeAll(async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  process.env.ES256_PRIVATE_JWK = JSON.stringify(await exportJWK(pair.privateKey));
  process.env.ES256_KEY_ID = "thanks2go-test";
  process.env.SOLANA_DEVNET_RECIPIENT = "6ywCP21EgS6a7y752rHT38qDypsb9NNLi2Db5iYXd9qj";
  process.env.PAYPAL_T2G_CLIENT_ID = "configured-for-contract-test";
  app = await (await import("../api/app.js")).createApp();
});

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
  });

  it("refuses PayPal order creation without explicit approval", async () => {
    await request(app).post("/api/paypal/orders").send({ mandateToken: "irrelevant", humanApproved: false }).expect(409);
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
      .send({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: crypto.randomUUID(), role: "ROLE_USER", parts: [{ text: "Verify the declared recipient", mediaType: "text/plain" }] } } })
      .expect(200);
    expect(response.body.result.message.role).toBe("ROLE_AGENT");
    expect(response.body.result.message.parts[0].text).toContain("humanIdentityVerified");
  });
});
