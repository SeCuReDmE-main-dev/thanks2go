import { describe, expect, it } from "vitest";
import { newMandate, sha256 } from "@thanks2go/contracts";
import { issueReceiptCredential, signMandate, verifyMandate } from "../api/crypto.js";

describe("signed mandates and credentials", () => {
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
