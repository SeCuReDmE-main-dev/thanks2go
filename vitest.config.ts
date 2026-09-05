import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: {
    "@thanks2go/contracts/paypal": fileURLToPath(new URL("./packages/contracts/src/paypal.ts", import.meta.url)),
    "@thanks2go/contracts": fileURLToPath(new URL("./packages/contracts/src/index.ts", import.meta.url)),
    "@thanks2go/a2a": fileURLToPath(new URL("./packages/a2a/src/index.ts", import.meta.url))
  } },
  test: { environment: "node", coverage: { reporter: ["text", "json-summary"] } }
});
