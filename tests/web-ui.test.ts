import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const appSource = () => readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");

describe("visible payment UI safeguards", () => {
  it("clears the devnet stage and wallet choices only after confirmation", async () => {
    const source = await appSource();
    expect(source).toContain("setReceipt(value); setSolStage(undefined); setWallets([]);");
  });

  it("uses WebMCP staging only to prefill a fresh visible Solana choice", async () => {
    const source = await appSource();
    expect(source).toContain('notice.rail === "solana-devnet" && notice.solAmount');
    expect(source).toContain("setSolAmount(notice.solAmount);");
    expect(source).toContain("setSolStage(undefined);");
  });

  it("attaches the receipt download link for browser compatibility", async () => {
    const source = await appSource();
    expect(source).toContain("document.body.appendChild(link); link.click(); document.body.removeChild(link);");
  });
});
