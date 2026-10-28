// Rasterizes the 16x16 pixel-art icon into the PNGs the manifest and iOS need.
// No dependencies: the art is a handful of rects, and PNG is zlib plus a CRC.
// Run: node scripts/gen-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = '#10202a';
/** Same rects as public/icon.svg, in 16x16 grid units. Keep the two in step. */
const RECTS = [
  { x: 2, y: 11, w: 12, h: 2, fill: '#f2c14e' },
  { x: 6, y: 4, w: 2, h: 7, fill: '#7a4e2d' },
  { x: 3, y: 3, w: 4, h: 2, fill: '#3fa34d' },
  { x: 7, y: 2, w: 5, h: 2, fill: '#3fa34d' },
  { x: 11, y: 9, w: 3, h: 2, fill: '#e85d75' },
];

/**
 * Every icon is `purpose: maskable` as well as `any`, so the art sits inside the central
 * 80% (the maskable safe zone) at an integer scale, and the background fills the rest.
 */
const OUTPUTS = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
];

function hex(color) {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}

function render(size) {
  const scale = Math.floor((size * 0.8) / 16);
  const offset = Math.floor((size - 16 * scale) / 2);
  const px = Buffer.alloc(size * size * 3);
  const paint = (x0, y0, w, h, color) => {
    const [r, g, b] = hex(color);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * size + x) * 3;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
      }
    }
  };
  paint(0, 0, size, size, BG);
  for (const r of RECTS) paint(offset + r.x * scale, offset + r.y * scale, r.w * scale, r.h * scale, r.fill);
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const { file, size } of OUTPUTS) {
  writeFileSync(file, png(size, render(size)));
  console.log(`${file} ${size}x${size}`);
}
