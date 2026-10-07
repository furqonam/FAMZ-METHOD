/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/download.js
   Download helper + file utilities
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — DOWNLOAD BLOB
   ───────────────────────────────────────────────────────────── */
function downloadBlob(blob, filename) {
  if (!blob) throw new Error('Blob kosong');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || ('famz_' + Date.now() + '.mp4');
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  // Cleanup setelah 1 detik
  setTimeout(function () {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — DOWNLOAD ARRAYBUFFER
   ───────────────────────────────────────────────────────────── */
function downloadBuffer(buffer, filename, mimeType) {
  const blob = new Blob([buffer], {
    type: mimeType || 'video/mp4'
  });
  downloadBlob(blob, filename);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — DOWNLOAD IMAGE
   ───────────────────────────────────────────────────────────── */
function downloadImage(blob, filename) {
  const name = filename || ('famz_' + Date.now() + '.png');
  downloadBlob(blob, name);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — BUILD FILENAME
   ───────────────────────────────────────────────────────────── */
function buildFilename(originalName, suffix, ext) {
  const base = (originalName || 'file').replace(/\.[^/.]+$/, '');
  const sfx = suffix ? '_' + suffix : '';
  const extension = ext || 'mp4';
  const timestamp = Date.now().toString().slice(-6);
  return base + sfx + '_' + timestamp + '.' + extension;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — FORMAT FILE SIZE
   ───────────────────────────────────────────────────────────── */
function formatSize(bytes) {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — FORMAT DURATION
   ───────────────────────────────────────────────────────────── */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '—';
  const s = Math.round(seconds);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + 'm ' + (r < 10 ? '0' : '') + r + 's';
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — COPY TO CLIPBOARD
   ───────────────────────────────────────────────────────────── */
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — SHARE FILE (Web Share API)
   ───────────────────────────────────────────────────────────── */
async function shareFile(blob, filename) {
  if (!navigator.share || !navigator.canShare) {
    return { ok: false, reason: 'not_supported' };
  }

  try {
    const file = new File([blob], filename, { type: blob.type });

    if (!navigator.canShare({ files: [file] })) {
      return { ok: false, reason: 'file_not_supported' };
    }

    await navigator.share({
      files: [file],
      title: 'FAMZ METHOD',
      text: 'Shared from FAMZ METHOD v1.0'
    });

    return { ok: true };
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — READ FILE AS ARRAYBUFFER
   ───────────────────────────────────────────────────────────── */
function readFileAsBuffer(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function (e) { resolve(e.target.result); };
    reader.onerror = function () { reject(new Error('Gagal baca file')); };
    reader.readAsArrayBuffer(file);
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — READ FILE AS DATAURL
   ───────────────────────────────────────────────────────────── */
function readFileAsDataURL(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function (e) { resolve(e.target.result); };
    reader.onerror = function () { reject(new Error('Gagal baca file')); };
    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 11 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] download.js loaded');