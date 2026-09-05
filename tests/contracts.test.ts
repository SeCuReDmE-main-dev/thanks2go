import { describe, expect, it } from "vitest";
import { PublicError, assertMandateActive, canonicalJson, isCanonicalProfileUrl, newMandate, sha256 } from "@thanks2go/contracts";

describe("canonical profile contract", () => {
  it.each([
    "http://thanks2go.securedme.ca/p/securedme",
    "https://evil.example/p/securedme",
    "https://thanks2go.securedme.ca/p/securedme?redirect=x",
    "https://thanks2go.securedme.ca/p/securedme#pay",
    "https://thanks2go.securedme.ca/not-a-profile"
  ])("rejects %s", (url) => expect(isCanonicalProfileUrl(url)).toBe(false));

  it("accepts the exact canonical profile", () => expect(isCanonicalProfileUrl("https://thanks2go.securedme.ca/p/securedme")).toBe(true));
});

describe("mandate contract", () => {
  const attestation = "a".repeat(64);
  it("fixes PayPal at two USD and ten minutes", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    const mandate = newMandate({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "paypal" }, attestation, now);
    expect(mandate.amount).toEqual({ currency: "USD", minorUnits: 200 });
    expect(Date.parse(mandate.expiresAt) - Date.parse(mandate.issuedAt)).toBe(600_000);
    expect(sha256(mandate)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects expired mandates", () => {
    const mandate = newMandate({ profileUrl: "https://thanks2go.securedme.ca/p/securedme", rail: "solana-devnet", solAmount: "0.001" }, attestation, new Date("2026-09-04T12:00:00.000Z"));
    expect(() => assertMandateActive(mandate, new Date("2026-09-04T12:10:00.001Z"))).toThrow(PublicError);
  });
});

describe("canonical JSON domain", () => {
  it("preserves deterministic valid-JSON serialization", () => {
    expect(canonicalJson({ z: [true, null, 2], a: { y: "value", x: 1 } })).toBe('{"a":{"x":1,"y":"value"},"z":[true,null,2]}');
    expect(sha256({ b: 2, a: 1 })).toBe(sha256({ a: 1, b: 2 }));
  });

  it.each([undefined, NaN, Infinity, 1n, Symbol("x"), () => undefined, { field: undefined }, [undefined], new Date()])("rejects non-JSON-domain input %#", value => {
    expect(() => canonicalJson(value)).toThrow(TypeError);
  });
});
