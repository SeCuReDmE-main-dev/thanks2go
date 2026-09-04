import { describe, expect, it } from "vitest";
import { newMandate, sha256 } from "@thanks2go/contracts";
import { issueReceiptCredential, signMandate, verifyMandate, verifyReceiptCredential } from "../api/crypto.js";

describe("signed mandates and credentials", () => {
  it("binds every displayed receipt field to its signature", async () => {
    const mandate = newMandate({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "paypal" }, "c".repeat(64));
    const confirmedAt = new Date().toISOString();
    const credential = await issueReceiptCredential(mandate, "provider-1", "confirmed", undefined, confirmedAt);
    const receipt = { version: "1", mandateHash: sha256(mandate), rail: "paypal", status: "confirmed", providerReference: "provider-1", confirmedAt, credential };
    await expect(verifyReceiptCredential(receipt)).resolves.toEqual(receipt);
    for (const changed of [{ providerReference: "another-payment" }, { mandateHash: "d".repeat(64) }, { rail: "solana-devnet" }, { status: "failed" }, { confirmedAt: "2026-01-01T00:00:00.000Z" }, { payerReference: "e".repeat(64) }]) {
      await expect(verifyReceiptCredential({ ...receipt, ...changed })).rejects.toThrow();
    }
    await expect(verifyReceiptCredential({ ...receipt, confirmedAt: undefined })).rejects.toThrow();
  });
  it("round-trips a valid signed mandate and rejects tampering", async () => {
    const mandate = newMandate({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "paypal" }, "b".repeat(64));
    const token = await signMandate(mandate);
    await expect(verifyMandate(token)).resolves.toEqual(mandate);
    const tampered = `${token.slice(0, -2)}aa`;
    await expect(verifyMandate(tampered)).rejects.toThrow();
  });

  it("issues a W3C-shaped vc+jwt receipt", async () => {
    const mandate = newMandate({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "paypal" }, "c".repeat(64));
    const credential = await issueReceiptCredential(mandate, "provider-1", "confirmed");
    expect(credential.split(".")).toHaveLength(3);
    expect(sha256(mandate)).toHaveLength(64);
  });
});
