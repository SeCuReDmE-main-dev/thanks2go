import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("deployment security", () => {
  it("ships defensive headers and a bounded API body", async () => {
    const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
    const headers = Object.fromEntries(vercel.headers[0].headers.map((entry: { key: string; value: string }) => [entry.key, entry.value]));
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    const api = await readFile(new URL("../api/app.ts", import.meta.url), "utf8");
    expect(api).toContain('limit: "32kb"');
    expect(api).not.toMatch(/fetch\(request\.(body|query|params)/);
  });

  it("generates the general QR from the canonical profile URL only", async () => {
    const app = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
    expect(app).toContain("QRCode.toDataURL(profile.profileUrl");
    expect(app).not.toMatch(/QRCode\.toDataURL\([^\n]*(wallet|recipient|amount|mandateToken)/);
  });
});
