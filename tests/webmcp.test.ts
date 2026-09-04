import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("WebMCP progressive boundary", () => {
  it("registers exactly four non-authoritative tools", async () => {
    const source = await readFile(new URL("../apps/web/src/webmcp.ts", import.meta.url), "utf8");
    for (const name of ["inspect_gratitude_profile", "stage_gratitude_intent", "open_payment_handoff", "verify_gratitude_receipt"]) expect(source).toContain(name);
    expect(source).not.toMatch(/captureOrder|signTransaction|humanApproved:\s*true/);
    expect(source).toContain("if (!document.modelContext)");
  });
});
