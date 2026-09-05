import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("local API configuration", () => {
  it("uses the listener port for internal A2A HTTP", async () => {
    const source = await readFile(new URL("../api/local.ts", import.meta.url), "utf8");
    expect(source).toContain('createApp({ agentOrigin: () => `http://127.0.0.1:${port}` })');
  });
});
