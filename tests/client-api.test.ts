import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../apps/web/src/client-api.js";

afterEach(() => vi.unstubAllGlobals());

describe("browser API response handling", () => {
  it("preserves a public JSON API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({code:"MANDATE_EXPIRED",message:"The gratitude mandate has expired."}), {status:410})));
    await expect(api("/api/paypal/orders")).rejects.toThrow("The gratitude mandate has expired.");
  });

  it("sanitizes an HTML gateway error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>private gateway detail</html>", {status:502})));
    await expect(api("/api/paypal/orders")).rejects.toThrow("Request failed");
  });

  it("rejects malformed successful responses explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", {status:200})));
    await expect(api("/api/profiles/securedme")).rejects.toThrow("The server returned an invalid response.");
  });
});
