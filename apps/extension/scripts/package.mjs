import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
const output = fileURLToPath(new URL("../thanks2go-extension-0.1.0.zip", import.meta.url));
await rm(output, { force: true });

const result = process.platform === "win32"
  ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Compress-Archive -Path (Join-Path $env:T2G_EXTENSION_DIST '*') -DestinationPath $env:T2G_EXTENSION_ZIP"], {
      stdio: "inherit", env: { ...process.env, T2G_EXTENSION_DIST: dist, T2G_EXTENSION_ZIP: output }
    })
  : spawnSync("zip", ["-q", "-r", output, "."], { cwd: dist, stdio: "inherit" });

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Extension packaging failed with exit code ${result.status ?? "unknown"}`);
