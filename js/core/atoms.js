/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/atoms.js
   MP4 Atom Parser — baca struktur binary MP4
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — CONSTANTS
   ───────────────────────────────────────────────────────────── */
const CONTAINER_BOXES = new Set([
  'moov', 'trak', 'mdia', 'minf', 'stbl',
  'edts', 'dinf', 'udta', 'meta', 'ilst',
  'moof', 'traf', 'mvex', 'mfra'
]);

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — TYPE HELPERS
   ───────────────────────────────────────────────────────────── */
function readType(data, offset) {
  return String.fromCharCode(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3]
  );
}

function writeType(data, offset, type) {
  for (let i = 0; i < 4; i++) {
    data[offset + i] = type.charCodeAt(i);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — VALIDATION
   ───────────────────────────────────────────────────────────── */
function isMp4(data) {
  if (!data || data.length < 12) return false;
  const t = readType(data, 4);
  return t === 'ftyp'
      || t === 'moov'
      || t === 'mdat'
      || t === 'free'
      || t === 'wide';
}

function guardU32(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 0xFFFFFFFF) {
    throw new Error((label || 'value') + ' out of uint32 range: ' + value);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — ATOM PARSER (Single)
   ───────────────────────────────────────────────────────────── */
function parseAtom(data, view, offset, end) {
  if (offset + 8 > end) return null;

  const smallSize = view.getUint32(offset, false);
  const type = readType(data, offset + 4);
  let size = smallSize;
  let headerSize = 8;

  // Handle 64-bit size
  if (smallSize === 1) {
    if (offset + 16 > end) return null;
    const high = view.getUint32(offset + 8, false);
    const low  = view.getUint32(offset + 12, false);
    size = high * 0x100000000 + low;
    headerSize = 16;
  } else if (smallSize === 0) {
    // Size = 0 means extends to end of file
    size = end - offset;
  }

  if (size < headerSize) return null;
  if (offset + size > end) size = end - offset;
  if (size < headerSize) return null;

  return {
    type,
    offset,
    size,
    headerSize,
    contentStart: offset + headerSize,
    end: offset + size,
    data,
    view,
    children: []
  };
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — SCAN ATOMS (Recursive)
   ───────────────────────────────────────────────────────────── */
function scanAtoms(data, view, start, end, parentPath) {
  start = start || 0;
  end = end || data.length;
  parentPath = parentPath || '';

  const atoms = [];
  let offset = start;

  while (offset + 8 <= end) {
    const atom = parseAtom(data, view, offset, end);
    if (!atom) break;

    // Recursively scan container boxes
    if (CONTAINER_BOXES.has(atom.type)) {
      const innerStart = atom.type === 'meta'
        ? atom.contentStart + 4
        : atom.contentStart;

      if (innerStart < atom.end) {
        try {
          atom.children = scanAtoms(
            data,
            view,
            innerStart,
            atom.end,
            parentPath ? parentPath + '/' + atom.type : atom.type
          );
        } catch (e) {
          atom.children = [];
        }
      }
    }

    atoms.push(atom);

    // Prevent infinite loop
    if (atom.end <= atom.offset) break;
    offset = atom.end;
  }

  return atoms;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — TREE QUERIES
   ───────────────────────────────────────────────────────────── */
function pickChild(atom, type) {
  if (!atom || !atom.children) return null;
  for (let i = 0; i < atom.children.length; i++) {
    if (atom.children[i].type === type) return atom.children[i];
  }
  return null;
}

function pickDeep(atom, path) {
  let cur = atom;
  for (let i = 0; i < path.length; i++) {
    cur = pickChild(cur, path[i]);
    if (!cur) return null;
  }
  return cur;
}

function pickTop(atoms, type) {
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i].type === type) return atoms[i];
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — SLICE HELPERS
   ───────────────────────────────────────────────────────────── */
function sliceAtomRaw(atom) {
  return atom.data.slice(atom.offset, atom.end);
}

function sliceAtomBody(atom) {
  return atom.data.slice(atom.contentStart, atom.end);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — BYTE UTILITIES
   ───────────────────────────────────────────────────────────── */
function mergeBytes(parts) {
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    total += parts[i].length;
  }
  guardU32(total, 'mergeBytes.size');

  const out = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    out.set(parts[i], offset);
    offset += parts[i].length;
  }
  return out;
}

function buildAtom(type, body) {
  const size = 8 + body.length;
  guardU32(size, type + '.size');

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, size, false);
  writeType(out, 4, type);
  out.set(body, 8);
  return out;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — STCO SCANNER (Chunk Offsets)
   ───────────────────────────────────────────────────────────── */
function scanStco(stco) {
  const count = stco.view.getUint32(stco.offset + 12, false);
  const tableStart = stco.offset + 16;

  if (tableStart + count * 4 > stco.end) return [];

  const offsets = [];
  for (let i = 0; i < count; i++) {
    offsets.push(stco.view.getUint32(tableStart + i * 4, false));
  }
  return offsets;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — STSZ SCANNER (Sample Sizes)
   ───────────────────────────────────────────────────────────── */
function scanStsz(stsz) {
  const sampleSize = stsz.view.getUint32(stsz.offset + 12, false);
  const count = stsz.view.getUint32(stsz.offset + 16, false);

  // If sampleSize != 0, all samples have same size
  if (sampleSize !== 0) {
    const arr = new Array(count);
    for (let i = 0; i < count; i++) arr[i] = sampleSize;
    return arr;
  }

  const tableStart = stsz.offset + 20;
  if (tableStart + count * 4 > stsz.end) return [];

  const sizes = [];
  for (let i = 0; i < count; i++) {
    sizes.push(stsz.view.getUint32(tableStart + i * 4, false));
  }
  return sizes;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 11 — STSC SCANNER (Sample-to-Chunk)
   ───────────────────────────────────────────────────────────── */
function scanStsc(stsc) {
  const count = stsc.view.getUint32(stsc.offset + 12, false);
  const tableStart = stsc.offset + 16;

  if (tableStart + count * 12 > stsc.end) return [];

  const rows = [];
  for (let i = 0; i < count; i++) {
    const o = tableStart + i * 12;
    rows.push([
      stsc.view.getUint32(o, false),
      stsc.view.getUint32(o + 4, false),
      stsc.view.getUint32(o + 8, false)
    ]);
  }
  return rows;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 12 — FASTSTART DETECTION
   ───────────────────────────────────────────────────────────── */
function isFastStart(data) {
  if (!data || data.length < 8) return false;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  while (offset + 8 <= data.length) {
    const size = view.getUint32(offset, false);
    const type = readType(data, offset + 4);

    if (type === 'moov') return true;
    if (type === 'mdat') return false;

    if (size < 8 || offset + size > data.length) break;
    offset += size;
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 13 — EXPORT (Global Scope)
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] atoms.js loaded');