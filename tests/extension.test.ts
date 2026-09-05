import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../apps/extension/src/", import.meta.url);

describe("MV3 extension boundary", () => {
  it("has only activeTab and scripting permissions", async () => {
    const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["activeTab", "scripting"]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.background).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.icons).toEqual({"16":"icons/icon16.png","48":"icons/icon48.png","128":"icons/icon128.png"});
  });

  it("requires clicks and checks declaration conflicts", async () => {
    const source = await readFile(new URL("popup.js", root), "utf8");
    expect(source).toContain('addEventListener("click"');
    expect(source).toContain("DECLARATION_CONFLICT");
    expect(source).not.toMatch(/cookies|history|clipboardRead|notifications/);
  });

  it("builds deterministic icons and packages without a platform-specific npm command", async () => {
    const build = await readFile(new URL("../scripts/build.mjs", root), "utf8");
    const packageFile = await readFile(new URL("../package.json", root), "utf8");
    expect(build).toContain("for (const size of [16, 48, 128])");
    expect(JSON.parse(packageFile).scripts.package).toBe("npm run build && node scripts/package.mjs");
  });
});
