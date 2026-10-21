// Regenerates src-tauri/icons/icon.icns (the macOS bundle icon) from the
// committed tile master, src-tauri/icons/official-512.png.
//
// The tile master composes edge to edge: at every size the white tile fills the
// canvas apart from the rounded corners. The Dock renders the whole canvas at
// the slot size, so a full-bleed tile looks ~25% larger than Apple's icon grid,
// where the shape occupies 824x824 of a 1024x1024 canvas with ~100px
// transparent margins and a 185.4px corner radius. Every generated size scales
// the master onto that grid — content = size * 824/1024, inset =
// size * 100/1024, radius = 185.4 * size / 1024 — with a signed-distance alpha
// falloff for the corners. The Windows .ico pipeline and the committed PNG
// family stay untouched; only the macOS Dock shrinks to the grid.
//
//   node scripts/generate-mac-icons.mjs
//
// The script verifies what it wrote — entry set, PNG signatures, dimension
// parity, and the measured grid margin of the largest entry — before exiting.

import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = join(ROOT, 'src-tauri', 'icons', 'official-512.png');
const TARGET = join(ROOT, 'src-tauri', 'icons', 'icon.icns');

// Complete .iconset gamut; sizes are raw pixel edges. Types sharing a size
// carry the same PNG data: icp5 == ic11, icp6 == ic12, ic08 == ic13, ic09 == ic14.
const ENTRIES = [
  ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256],
  ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256],
  ['ic14', 512],
];

// Apple macOS icon grid at the 1024 canvas.
const CANVAS = 1024;
const SHAPE = 824;
const INSET = (CANVAS - SHAPE) / 2;
const RADIUS = 185.4;

// ---------- PNG decode ----------

/** Decode one 8-bit RGBA non-interlaced PNG into a straight-alpha RGBA buffer. */
function decodePng(path) {
  const png = readFileSync(path);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  const interlace = png[28];
  if (width < 1 || height < 1) throw new Error(`${path}: zero-sized image`);
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `${path}: expected 8-bit RGBA non-interlaced (got bit=${bitDepth} type=${colorType} interlace=${interlace})`,
    );
  }
  return unfilterPng(png, width, height);
}

/** Walk IDAT chunks and reverse every row filter into pixels. */
function unfilterPng(png, width, height) {
  const idat = [];
  let off = 8;
  while (off + 8 <= png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }
  const strideFull = width * 4;
  const stride = strideFull + 1;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length !== height * stride) {
    throw new Error(`PNG: decoded rows ${raw.length} != ${height * stride}`);
  }
  const data = Buffer.alloc(height * strideFull);
  const row = Buffer.alloc(strideFull);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];
    const source = raw.subarray(y * stride + 1, (y + 1) * stride);
    const prev = y > 0 ? data.subarray((y - 1) * strideFull, y * strideFull) : null;
    for (let i = 0; i < strideFull; i++) {
      const a = i >= 4 ? row[i - 4] : 0;
      const b = prev !== null ? prev[i] : 0;
      const c = prev !== null && i >= 4 ? prev[i - 4] : 0;
      let v = source[i];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      row[i] = v;
    }
    row.copy(data, y * strideFull);
  }
  return { width, height, data };
}

// ---------- resample ----------

/** Integer-factor box average downscale (factor >= 1; 1 clones). */
function downscaleBox(source, width, height, factor) {
  const outWidth = width / factor;
  const outHeight = height / factor;
  const data = Buffer.alloc(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0;
        for (let sy = 0; sy < factor; sy++) {
          for (let sx = 0; sx < factor; sx++) {
            sum += source[(((y * factor + sy) * width) + (x * factor + sx)) * 4 + ch];
          }
        }
        data[((y * outWidth) + x) * 4 + ch] = Math.round(sum / (factor * factor));
      }
    }
  }
  return { width: outWidth, height: outHeight, data };
}

/** Bilinear upscale; clamped edges, straight alpha. */
function upscaleBilinear(source, width, height, factor) {
  const outWidth = width * factor;
  const outHeight = height * factor;
  const data = Buffer.alloc(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y++) {
    const sy = (y + 0.5) / factor - 0.5;
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(sy)));
    const y1 = Math.min(height - 1, y0 + 1);
    const fy = Math.max(0, Math.min(1, sy - y0));
    for (let x = 0; x < outWidth; x++) {
      const sx = (x + 0.5) / factor - 0.5;
      const x0 = Math.max(0, Math.min(width - 1, Math.floor(sx)));
      const x1 = Math.min(width - 1, x0 + 1);
      const fx = Math.max(0, Math.min(1, sx - x0));
      const out = (y * outWidth + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        const p00 = source[(y0 * width + x0) * 4 + ch];
        const p10 = source[(y0 * width + x1) * 4 + ch];
        const p01 = source[(y1 * width + x0) * 4 + ch];
        const p11 = source[(y1 * width + x1) * 4 + ch];
        const top = p00 + (p10 - p00) * fx;
        const bottom = p01 + (p11 - p01) * fx;
        data[out + ch] = Math.round(top + (bottom - top) * fy);
      }
    }
  }
  return { width: outWidth, height: outHeight, data };
}

/**
 * Shrink the image onto the macOS icon grid at its own size: content edge
 * size * 824/1024, inset size * 100/1024, corner radius 185.4 * size / 1024.
 * The master alpha is multiplied by the rounded-rect coverage, so its own
 * antialiased edges survive intersected with the grid.
 */
function applyMacGrid(image, size) {
  const inset = (INSET * size) / CANVAS;
  const shape = (SHAPE * size) / CANVAS;
  const radius = (RADIUS * size) / CANVAS;
  const half = shape / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ax = Math.abs(x + 0.5 - inset - half) - (half - radius);
      const ay = Math.abs(y + 0.5 - inset - half) - (half - radius);
      const dx = Math.max(ax, 0);
      const dy = Math.max(ay, 0);
      const d = Math.sqrt(dx * dx + dy * dy) + Math.min(Math.max(ax, ay), 0) - radius;
      const coverage = Math.max(0, Math.min(1, 0.5 - d));
      const at = (y * size + x) * 4 + 3;
      image.data[at] = Math.round(image.data[at] * coverage);
    }
  }
  return image;
}

// ---------- PNG encode ----------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, payload) {
  const out = Buffer.alloc(12 + payload.length);
  out.writeUInt32BE(payload.length, 0);
  out.write(type, 4, 'ascii');
  payload.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + payload.length)), 8 + payload.length);
  return out;
}

/** Encode one RGBA image as a filter-0 rows PNG. */
function encodePng(image) {
  const { width, height, data } = image;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA
  header[10] = 0; // compression
  header[11] = 0; // filter
  header[12] = 0; // interlace
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- icns ----------

function buildIcns(rendered) {
  const body = Buffer.concat(
    ENTRIES.map(([type, size]) => {
      const png = rendered.get(size);
      const entry = Buffer.alloc(8);
      entry.write(type, 0, 'ascii');
      entry.writeUInt32BE(8 + png.length, 4);
      return Buffer.concat([entry, png]);
    }),
  );
  const file = Buffer.alloc(8);
  file.write('icns', 0, 'ascii');
  file.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([file, body]);
}

/** Re-read the written icns and assert the entry set and dimension parity. */
function verifyIcns(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'icns') throw new Error(`${path}: icns magic missing`);
  if (buf.readUInt32BE(4) !== buf.length) throw new Error(`${path}: icns length header mismatch`);
  let off = 8;
  const seen = [];
  while (off + 8 <= buf.length) {
    const type = buf.toString('ascii', off, off + 4);
    const len = buf.readUInt32BE(off + 4);
    // len counts the entry header; the iterator advances by len alone.
    if (len < 8 || off + len > buf.length) throw new Error(`${path}: entry ${type} overruns file`);
    const png = buf.subarray(off + 8, off + 8 + len);
    if (png[0] !== 0x89 || png.toString('ascii', 1, 4) !== 'PNG') {
      throw new Error(`${path}: entry ${type} is not a PNG`);
    }
    seen.push({ type, width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
    off += len;
  }
  if (off !== buf.length) throw new Error(`${path}: ${buf.length - off} trailing bytes`);
  if (seen.length !== ENTRIES.length) {
    throw new Error(`${path}: ${seen.length} entries, expected ${ENTRIES.length}`);
  }
  const got = new Map(seen.map((e) => [e.type, e.width]));
  for (const [type, size] of ENTRIES) {
    if (got.get(type) !== size) {
      throw new Error(`${path}: entry ${type} renders ${got.get(type)}px, expected ${size}px`);
    }
  }
  return seen;
}

/** Bounding box of every alpha > 0 pixel in an RGBA buffer image. */
function alphaBoundingBox(image) {
  const { width, height, data } = image;
  let l = width, r = -1, t = height, b = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      }
    }
  }
  return { l, r, t, b, width: r - l + 1, height: b - t + 1 };
}

// ---------- main ----------

const master = decodePng(MASTER);
if (master.width !== master.height) throw new Error(`${MASTER}: master is not square`);
const MASTER_EDGE = master.width;

const rendered = new Map();
for (const size of [...new Set(ENTRIES.map(([, size]) => size))]) {
  let image;
  if (size === MASTER_EDGE) {
    image = { width: size, height: size, data: Buffer.from(master.data) };
  } else if (size < MASTER_EDGE) {
    if (MASTER_EDGE % size !== 0) throw new Error(`master ${MASTER_EDGE} does not divide into ${size}`);
    image = downscaleBox(master.data, master.width, master.height, MASTER_EDGE / size);
  } else {
    if (size % MASTER_EDGE !== 0) throw new Error(`master ${MASTER_EDGE} does not upscale to ${size}`);
    image = upscaleBilinear(master.data, master.width, master.height, size / MASTER_EDGE);
  }
  applyMacGrid(image, size);
  rendered.set(size, encodePng(image));
}

writeFileSync(TARGET, buildIcns(rendered));
const seen = verifyIcns(TARGET);

// The 1024 entry is what the Dock composes from; decode it from its own PNG
// bytes and confirm the content sits in the 824/1024 slot.
const masterOrNull = decodePngBuffer(rendered.get(1024), 1024);
const largest = alphaBoundingBox(masterOrNull);
const expectedInset = (INSET * 1024) / CANVAS;
if (largest.l > expectedInset + 2 || largest.t > expectedInset + 2
  || largest.l < expectedInset - 2 || largest.t < expectedInset - 2) {
  throw new Error(
    `grid margin out of tolerance: bbox starts at (${largest.l},${largest.t}), expected ~${expectedInset}`,
  );
}

console.log(`wrote ${TARGET} (${rendered.size} rendered sizes, ${ENTRIES.length} entries)`);
for (const { type, width } of seen) console.log(`  ${type}: ${width}px`);
console.log(
  `grid check: content bbox ${largest.l}..${largest.r} x ${largest.t}..${largest.b}` +
  ` on a 1024 canvas (inset ${expectedInset}, shape ${expectedInset + (SHAPE * 1024) / CANVAS})` +
  ` — ${((largest.width / 1024) * 100).toFixed(1)}% wide, ${((largest.height / 1024) * 100).toFixed(1)}% tall`,
);

/** Decode a PNG held as a Buffer (same 8-bit RGBA contract, size asserted). */
function decodePngBuffer(png, expectedEdge) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== expectedEdge || height !== expectedEdge) {
    throw new Error(`PNG buffer is ${width}x${height}, expected ${expectedEdge}`);
  }
  if (png[25] !== 6 || png[28] !== 0) throw new Error('unexpected PNG variant in own output');
  return unfilterPng(png, width, height);
}
