/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/patch.js
   Patch Engine — rebuild MP4 + spoof resolution + validation
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — PLATFORM TARGETS
   ───────────────────────────────────────────────────────────── */
const PLATFORM_TARGETS = {
  tiktok:    { width: 1080, height: 1920, bitrate: 8000000  },
  instagram: { width: 1080, height: 1920, bitrate: 10000000 },
  youtube:   { width: 1080, height: 1920, bitrate: 12000000 },
  twitter:   { width: 1080, height: 1920, bitrate: 9000000  }
};

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — MAIN PATCH FUNCTION
   ───────────────────────────────────────────────────────────── */
function patchMP4(buffer, opts) {
  opts = opts || {};
  const t0 = performance.now();
  const before = buffer.byteLength;

  const arr = new Uint8Array(buffer);
  if (!isMp4(arr)) throw new Error('File bukan MP4 valid');

  const dv = new DataView(arr.buffer);
  const atoms = scanAtoms(arr, dv, 0, arr.length);

  const ftyp = pickTop(atoms, 'ftyp');
  const moov = pickTop(atoms, 'moov');
  const mdat = pickTop(atoms, 'mdat');

  if (!moov) throw new Error('moov atom gak ketemu — file corrupt?');
  if (!mdat) throw new Error('mdat atom gak ketemu — file corrupt?');

  const repl = new Map();

  /* STEP A: Spoof mvhd (convert ke version 1 + spoof duration) */
  const mvhd = pickChild(moov, 'mvhd');
  if (mvhd) {
    repl.set(mvhd, rebuildMvhd(arr, dv, mvhd));
  }

  /* STEP B: Spoof resolution + bitrate (H.264 + HEVC) */
  const platform = opts.platform || 'tiktok';
  const target = PLATFORM_TARGETS[platform] || PLATFORM_TARGETS.tiktok;
  const spoofMap = spoofResolutionAndBitrate(arr, dv, moov, target);
  spoofMap.forEach(function(v, k) { repl.set(k, v); });

  /* STEP C: Signature udta (replace, anti double-stack) */
  const sigUdta = buildSignatureUdta();
  const existingUdta = pickChild(moov, 'udta');
  if (existingUdta) {
    repl.set(existingUdta, mergeUdta(arr, existingUdta, sigUdta));
  } else {
    repl.set('__appendUdta__', sigUdta);
  }

  /* STEP D: Collect stco */
  const stcos = [];
  for (let i = 0; i < moov.children.length; i++) {
    const trak = moov.children[i];
    if (trak.type !== 'trak') continue;
    const stbl = pickDeep(trak, ['mdia', 'minf', 'stbl']);
    if (!stbl) continue;
    const stco = pickChild(stbl, 'stco');
    if (stco) stcos.push(stco);
  }

  /* STEP E: Pass 1 — rebuild with delta 0 */
  for (let i = 0; i < stcos.length; i++) {
    repl.set(stcos[i], rebuildStco(scanStco(stcos[i]), 0));
  }
  const ftypBytes = ftyp ? sliceAtomRaw(ftyp) : new Uint8Array(0);
  const moov1 = rebuildTree(moov, repl);

  /* STEP F: Calculate delta */
  const newMdatStart = ftypBytes.length + moov1.length;
  const oldMdatStart = mdat.offset;
  const delta = newMdatStart - oldMdatStart;

  /* STEP G: Pass 2 — rebuild with real delta */
  repl.delete('__appendUdta__');
  for (let i = 0; i < stcos.length; i++) {
    repl.set(stcos[i], rebuildStco(scanStco(stcos[i]), delta));
  }
  const moovFinal = rebuildTree(moov, repl);
  const mdatFull = sliceAtomRaw(mdat);

  /* STEP H: Merge output (faststart order) */
  const output = mergeBytes([ftypBytes, moovFinal, mdatFull]);

  /* STEP I: Validate */
  const validation = validatePatch(output);

  const elapsed = (performance.now() - t0) / 1000;

  return {
    output: output.buffer,
    before: before,
    after: output.length,
    validation: validation,
    elapsed: elapsed
  };
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — MVHD REBUILD + SPOOF DURATION
   ───────────────────────────────────────────────────────────── */
function rebuildMvhd(arr, dv, atom) {
  const version = arr[atom.contentStart];

  // Kalau udah version 1, cuma spoof duration 64-bit
  if (version === 1) {
    const out = sliceAtomRaw(atom).slice();
    const odv = new DataView(out.buffer, out.byteOffset);
    odv.setUint32(32, 0xFFFFFFFF, false);
    odv.setUint32(36, 0xFFFFFFFF, false);
    return out;
  }

  // Version 0 → convert ke version 1 + spoof duration
  const ct      = dv.getUint32(atom.contentStart + 4, false);
  const mt      = dv.getUint32(atom.contentStart + 8, false);
  const ts      = dv.getUint32(atom.contentStart + 12, false);
  const restSrc = atom.contentStart + 20;
  const restLen = atom.size - 8 - 20;
  const newSize = atom.size + 12;

  const out = new Uint8Array(newSize);
  const odv = new DataView(out.buffer);

  odv.setUint32(0, newSize, false);
  writeType(out, 4, 'mvhd');

  out[8] = 1;                              // version → 1
  odv.setUint32(12, 0, false);             // creation_time high
  odv.setUint32(16, ct, false);            // creation_time low
  odv.setUint32(20, 0, false);             // modification_time high
  odv.setUint32(24, mt, false);            // modification_time low
  odv.setUint32(28, ts, false);            // timescale (asli)
  odv.setUint32(32, 0xFFFFFFFF, false);    // duration high (TRICK)
  odv.setUint32(36, 0xFFFFFFFF, false);    // duration low (TRICK)

  out.set(arr.slice(restSrc, restSrc + restLen), 40);
  return out;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — SPOOF RESOLUTION + BITRATE (H.264 + HEVC)
   ───────────────────────────────────────────────────────────── */
function spoofResolutionAndBitrate(arr, dv, moov, target) {
  const repl = new Map();

  for (let i = 0; i < moov.children.length; i++) {
    const trak = moov.children[i];
    if (trak.type !== 'trak') continue;

    const stbl = pickDeep(trak, ['mdia', 'minf', 'stbl']);
    if (!stbl) continue;

    const stsd = pickChild(stbl, 'stsd');
    if (!stsd) continue;

    const entryStart = stsd.contentStart + 8;
    if (entryStart + 8 > stsd.end) continue;

    const entryType = readType(arr, entryStart + 4);

    if (entryType === 'avc1' || entryType === 'avc3' ||
        entryType === 'hvc1' || entryType === 'hev1') {
      const entrySize = dv.getUint32(entryStart, false);
      if (entrySize > stsd.end - entryStart || entrySize < 32) continue;

      const entry = arr.slice(entryStart, entryStart + entrySize).slice();
      const edv = new DataView(entry.buffer);

      const wOff = 16;
      const curW = edv.getUint16(wOff, false);
      const curH = edv.getUint16(wOff + 2, false);

      if (curW < target.width || curH < target.height) {
        const ratio = Math.min(target.width / curW, target.height / curH);
        if (ratio > 1) {
          edv.setUint16(wOff, Math.round(curW * ratio), false);
          edv.setUint16(wOff + 2, Math.round(curH * ratio), false);
        }
      }

      const btrtOff = findChildInBytes(entry, 'btrt');
      if (btrtOff > 0) {
        const bdv = new DataView(entry.buffer, btrtOff);
        bdv.setUint32(8, target.bitrate, false);
        bdv.setUint32(12, Math.round(target.bitrate * 1.5), false);
        bdv.setUint32(16, target.bitrate, false);
      }

      repl.set(stsd, rebuildStsdWithEntry(arr, stsd, entry));
    }
  }

  return repl;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — FIND CHILD IN BYTES
   ───────────────────────────────────────────────────────────── */
function findChildInBytes(bytes, type) {
  let off = 8;
  const dv = new DataView(bytes.buffer, bytes.byteOffset);
  while (off + 8 <= bytes.length) {
    const size = dv.getUint32(off, false);
    if (size < 8 || off + size > bytes.length) break;
    const t = readType(bytes, off + 4);
    if (t === type) return off;
    off += size;
  }
  return -1;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — REBUILD STSD
   ───────────────────────────────────────────────────────────── */
function rebuildStsdWithEntry(arr, stsd, newEntry) {
  const header = arr.slice(stsd.contentStart, stsd.contentStart + 8);
  return buildAtom('stsd', mergeBytes([header, newEntry]));
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — REBUILD STCO
   ───────────────────────────────────────────────────────────── */
function rebuildStco(offsets, delta) {
  const body = new Uint8Array(8 + offsets.length * 4);
  const dv = new DataView(body.buffer);
  dv.setUint32(0, 0, false);
  dv.setUint32(4, offsets.length, false);
  for (let i = 0; i < offsets.length; i++) {
    dv.setUint32(8 + i * 4, (offsets[i] + delta) >>> 0, false);
  }
  return buildAtom('stco', body);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — REBUILD TREE
   ───────────────────────────────────────────────────────────── */
function rebuildTree(atom, repl) {
  if (repl.has(atom)) return repl.get(atom);
  if (!atom.children.length) return sliceAtomRaw(atom);

  const prefix = atom.type === 'meta'
    ? atom.data.slice(atom.contentStart, atom.contentStart + 4)
    : new Uint8Array(0);

  const parts = [prefix];
  for (let i = 0; i < atom.children.length; i++) {
    parts.push(rebuildTree(atom.children[i], repl));
  }

  if (atom.type === 'moov' && repl.has('__appendUdta__')) {
    parts.push(repl.get('__appendUdta__'));
  }

  return buildAtom(atom.type, mergeBytes(parts));
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — SIGNATURE UDTA
   ───────────────────────────────────────────────────────────── */
function buildSignatureUdta() {
  const today = new Date().toISOString().slice(0, 10);

  const tags = [
    buildTag('\u00A9nam', 'FAMZ METHOD'),
    buildTag('\u00A9cpy', '\u00A9 2026 FAMZ // vurkonnn'),
    buildTag('\u00A9too', 'FAMZ Engine'),
    buildTag('\u00A9swr', 'FAMZ METHOD v1.0'),
    buildTag('\u00A9prd', 'vurkonnn'),
    buildTag('\u00A9des', 'Optimized by FAMZ METHOD'),
    buildTag('\u00A9cmt', 't.me/famz_bot'),
    buildTag('\u00A9day', today)
  ];

  const ilst = buildAtom('ilst', mergeBytes(tags));
  const hdlr = buildHdlr();
  const meta = buildAtom('meta', mergeBytes([new Uint8Array(4), hdlr, ilst]));
  return buildAtom('udta', meta);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — BUILD TAG ATOM
   ───────────────────────────────────────────────────────────── */
function buildTag(fourCC, text) {
  const tb = new TextEncoder().encode(text);
  const data = new Uint8Array(16 + tb.length);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, data.length, false);
  writeType(data, 4, 'data');
  dv.setUint32(8, 1, false);
  dv.setUint32(12, 0, false);
  data.set(tb, 16);
  return buildAtom(fourCC, data);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 11 — BUILD HDLR ATOM
   ───────────────────────────────────────────────────────────── */
function buildHdlr() {
  const body = new Uint8Array(25);
  body[8]  = 0x6d;
  body[9]  = 0x64;
  body[10] = 0x69;
  body[11] = 0x72;
  body[12] = 0x61;
  body[13] = 0x70;
  body[14] = 0x70;
  body[15] = 0x6c;
  return buildAtom('hdlr', body);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 12 — MERGE UDTA (REPLACE — anti double-stack)
   ───────────────────────────────────────────────────────────── */
function mergeUdta(arr, oldUdta, sigUdta) {
  return sigUdta;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 13 — VALIDATION
   ───────────────────────────────────────────────────────────── */
function validatePatch(output) {
  try {
    const dv = new DataView(output.buffer, output.byteOffset, output.byteLength);
    const atoms = scanAtoms(output, dv, 0, output.length);

    const ftyp = pickTop(atoms, 'ftyp');
    const moov = pickTop(atoms, 'moov');
    const mdat = pickTop(atoms, 'mdat');

    if (!ftyp) return { ok: false, reason: 'ftyp missing' };
    if (!moov) return { ok: false, reason: 'moov missing' };
    if (!mdat) return { ok: false, reason: 'mdat missing' };

    if (moov.offset > mdat.offset) {
      return { ok: false, reason: 'moov after mdat' };
    }

    for (let i = 0; i < moov.children.length; i++) {
      const trak = moov.children[i];
      if (trak.type !== 'trak') continue;

      const stbl = pickDeep(trak, ['mdia', 'minf', 'stbl']);
      if (!stbl) continue;

      const stco = pickChild(stbl, 'stco');
      if (!stco) continue;

      const offsets = scanStco(stco);
      for (let j = 0; j < offsets.length; j++) {
        const off = offsets[j];
        if (off < mdat.offset || off > mdat.end) {
          return {
            ok: false,
            reason: 'stco offset ' + off + ' out of mdat range'
          };
        }
      }
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 14 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] patch.js loaded');