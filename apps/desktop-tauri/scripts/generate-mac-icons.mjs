// Regenerates src-tauri/icons/icon.icns (the macOS bundle icon) from the
// committed tile master, src-tauri/icons/official-512.png.
//
// The tile master composes edge to edge: at every size the white tile fills the
// canvas apart from its own rounded corners. The Dock renders the whole canvas
// at the slot size, so a full-bleed tile looks ~25% larger than Apple's icon
// grid, where the shape occupies 824x824 of a 1024x1024 canvas with ~100px
// transparent margins. Every generated size keeps the master exactly as
// designed — proportions, corner radius, and anti-aliasing — and only scales
// it by 824/1024 onto a transparent, centered canvas: the original in the
// Apple slot, with no re-cropped corners. The Windows .ico pipeline and the
// committed PNG family stay untouched; only the macOS Dock shrinks to fit.
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

/**
 * Box-filter resample to an arbitrary size: every destination pixel averages
 * the source rectangle it covers (premultiplied alpha, straight RGBA out).
 * With scale < 1 it downsamples; with scale > 1 it expands the covered
 * source area per destination pixel.
 */
function resample(source, sourceWidth, sourceHeight, destWidth, destHeight) {
  const data = Buffer.alloc(destWidth * destHeight * 4);
  const scaleX = sourceWidth / destWidth;
  const scaleY = sourceHeight / destHeight;
  for (let y = 0; y < destHeight; y++) {
    const sy0 = y * scaleY;
    const sy1 = Math.min(sourceHeight, (y + 1) * scaleY);
    for (let x = 0; x < destWidth; x++) {
      const sx0 = x * scaleX;
      const sx1 = Math.min(sourceWidth, (x + 1) * scaleX);
      // Premultiply-alpha box average: accumulate alpha-weighted colors and
      // the coverage weight itself, then normalize by the REAL weight sum —
      // on upscale the covered source rect is smaller than one source pixel,
      // so scale^2 would understate alpha and leave translucent mottling.
      let rs = 0, gs = 0, bs = 0, was = 0, wsum = 0;
      for (let sy = Math.floor(sy0); sy < sy1; sy++) {
        const wy = Math.min(1, sy + 1 - sy0) - Math.max(0, sy - sy0);
        for (let sx = Math.floor(sx0); sx < sx1; sx++) {
          const wx = Math.min(1, sx + 1 - sx0) - Math.max(0, sx - sx0);
          const w = wx * wy;
          if (w <= 0) continue;
          const at = (sy * sourceWidth + sx) * 4;
          const r = source[at], g = source[at + 1], b = source[at + 2], a = source[at + 3];
          const wa = (w * a) / 255;
          wsum += w;
          was += wa;
          rs += wa * r;
          gs += wa * g;
          bs += wa * b;
        }
      }
      const out = (y * destWidth + x) * 4;
      if (wsum > 0) {
        // `was` accumulates in 0..1 alpha units (w*a/255), so scale back up.
        data[out + 3] = Math.round((255 * was) / wsum);
        if (was > 0) {
          data[out] = Math.round(rs / was);
          data[out + 1] = Math.round(gs / was);
          data[out + 2] = Math.round(bs / was);
        }
      }
    }
  }
  return { width: destWidth, height: destHeight, data };
}

/** Paste one RGBA image centered on a transparent square canvas of `size`. */
function composeOnSquareCanvas(image, size) {
  const inset = Math.round((INSET * size) / CANVAS);
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < image.height; y++) {
    const dst = ((y + inset) * size + inset) * 4;
    image.data.copy(data, dst, y * image.width * 4, (y + 1) * image.width * 4);
  }
  return { width: size, height: size, data };
}

/**
 * Shrink the master onto the macOS icon grid at its own size: content edge
 * size * 824/1024, centered, with the design's own corners and anti-aliasing
 * untouched.
 */
function composeMacGrid(master, size) {
  const contentEdge = Math.round((SHAPE * size) / CANVAS);
  return composeOnSquareCanvas(
    resample(master.data, master.width, master.height, contentEdge, contentEdge),
    size,
  );
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

const rendered = new Map();
for (const size of [...new Set(ENTRIES.map(([, size]) => size))]) {
  const image = composeMacGrid(master, size);
  rendered.set(size, encodePng(image));
}

writeFileSync(TARGET, buildIcns(rendered));
const seen = verifyIcns(TARGET);

// The 1024 entry is what the Dock composes from; decode it from its own PNG
// bytes and confirm the content sits centered in the 824/1024 slot.
const largest = alphaBoundingBox(decodePngBuffer(rendered.get(1024), 1024));
const expectedInset = (INSET * 1024) / CANVAS;
if (largest.l > expectedInset + 2 || largest.t > expectedInset + 2
  || largest.l < expectedInset - 2 || largest.t < expectedInset - 2) {
  throw new Error(
    `grid margin out of tolerance: bbox starts at (${largest.l},${largest.t}), expected ~${expectedInset}`,
  );
}
const expectedContent = (SHAPE * 1024) / CANVAS;
if (largest.width < expectedContent - 4 || largest.height < expectedContent - 4) {
  throw new Error(
    `grid content smaller than the slot: ${largest.width}x${largest.height}, expected ~${expectedContent}`,
  );
}

console.log(`wrote ${TARGET} (${rendered.size} rendered sizes, ${ENTRIES.length} entries)`);
for (const { type, width } of seen) console.log(`  ${type}: ${width}px`);
console.log(
  `grid check: content bbox ${largest.l}..${largest.r} x ${largest.t}..${largest.b}` +
  ` on a 1024 canvas (inset ${expectedInset}, slot ${expectedContent})` +
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
