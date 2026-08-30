/**
 * Generates the PWA PNG icons from a tiny hand-rolled rasteriser.
 * No image dependency, no licensing question, deterministic output.
 * Run: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/icons');

const BG = [0x0e, 0x10, 0x15];
const BRAND = [0x33, 0x87, 0xfb];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const p = pixels[y * size + x];
      raw[offset] = p[0];
      raw[offset + 1] = p[1];
      raw[offset + 2] = p[2];
      offset += 3;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Draws the GWAN:GANG mark: two brand bars flanking a white colon. */
function render(size, { maskable = false } = {}) {
  const pixels = new Array(size * size);
  const s = size / 512;
  const inset = maskable ? size * 0.1 : 0;

  const rect = (x, y, w, h, r) => (px, py) => {
    if (px < x || py < y || px >= x + w || py >= y + h) return false;
    if (r <= 0) return true;
    const cx = Math.min(Math.max(px, x + r), x + w - r);
    const cy = Math.min(Math.max(py, y + r), y + h - r);
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
  };

  const circle = (cx, cy, r) => (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;

  const shapes = [
    { hit: rect(96 * s + inset, 128 * s + inset * 0.6, 40 * s, 256 * s - inset * 1.2, 20 * s), color: BRAND },
    { hit: rect(376 * s - inset, 128 * s + inset * 0.6, 40 * s, 256 * s - inset * 1.2, 20 * s), color: BRAND },
    { hit: circle(256 * s, 196 * s + inset * 0.4, 34 * s), color: WHITE },
    { hit: circle(256 * s, 316 * s - inset * 0.4, 34 * s), color: WHITE },
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // The canvas is fully opaque: launchers apply their own corner masking.
      let color = BG;
      for (const shape of shapes) {
        if (shape.hit(x + 0.5, y + 0.5)) {
          color = shape.color;
          break;
        }
      }
      pixels[y * size + x] = color;
    }
  }
  return pixels;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'icon-192.png'), png(192, render(192)));
writeFileSync(resolve(outDir, 'icon-512.png'), png(512, render(512)));
writeFileSync(resolve(outDir, 'icon-maskable-512.png'), png(512, render(512, { maskable: true })));
console.log('icons written to', outDir);
