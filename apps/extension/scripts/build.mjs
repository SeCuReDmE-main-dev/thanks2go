import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

function crc32(input) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function icon(size) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const offset = y * (size * 4 + 1); rows[offset] = 0;
    for (let x = 0; x < size; x++) {
      const pixel = offset + 1 + x * 4;
      const mark = y >= size * 0.22 && y <= size * 0.38 && x >= size * 0.2 && x <= size * 0.8 ||
        x >= size * 0.42 && x <= size * 0.58 && y >= size * 0.22 && y <= size * 0.78;
      const [red, green, blue] = mark ? [240, 176, 66] : [3, 9, 20];
      rows[pixel] = red; rows[pixel + 1] = green; rows[pixel + 2] = blue; rows[pixel + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("../dist", import.meta.url), { recursive: true });
await mkdir(new URL("../dist/icons", import.meta.url), { recursive: true });
for (const file of ["manifest.json", "popup.html", "popup.css", "popup.js"]) {
  await cp(new URL(`../src/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
}
for (const size of [16, 48, 128]) await writeFile(new URL(`../dist/icons/icon${size}.png`, import.meta.url), icon(size));
