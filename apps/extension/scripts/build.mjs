import { cp, mkdir, rm } from "node:fs/promises";

await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("../dist", import.meta.url), { recursive: true });
for (const file of ["manifest.json", "popup.html", "popup.css", "popup.js"]) {
  await cp(new URL(`../src/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
}
