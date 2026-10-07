/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/encoder.js
   Encode Tool UI — settings, drop, progress
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — STATE
   ───────────────────────────────────────────────────────────── */
let _encodeFile = null;
let _encodeRunning = false;

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — PICK HANDLER
   ───────────────────────────────────────────────────────────── */
function onPickEncode(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.includes('video') && !file.name.toLowerCase().endsWith('.mp4')) {
    toastError('Cuma MP4 yang didukung');
    return;
  }

  if (file.size > 500 * 1024 * 1024) {
    toastError('File terlalu besar (max 500MB)');
    return;
  }

  _encodeFile = file;

  // Update UI
  const tag = document.getElementById('encode_filetag');
  const name = document.getElementById('encode_name');
  const size = document.getElementById('encode_size');

  if (name) name.textContent = file.name;
  if (size) size.textContent = formatSize(file.size);
  if (tag) tag.hidden = false;

  // Enable button
  const btn = document.getElementById('encode_btn');
  if (btn) btn.disabled = false;

  // Reset status
  setEncodeStatus('Ready', '');
  hideEncodeProgress();

  toastSuccess('File: ' + file.name);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — STATUS
   ───────────────────────────────────────────────────────────── */
function setEncodeStatus(text, kind) {
  const box = document.getElementById('encode_status');
  const txt = document.getElementById('encode_status_text');

  if (txt) txt.textContent = text;
  if (box) {
    box.classList.remove('is-working', 'is-success', 'is-error');
    if (kind) box.classList.add('is-' + kind);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — PROGRESS
   ───────────────────────────────────────────────────────────── */
function hideEncodeProgress() {
  const p = document.getElementById('encode_progress');
  if (p) p.hidden = true;
  const log = document.getElementById('encode_log');
  if (log) log.innerHTML = '';
  setEncodeProgress(0, '');
}

function setEncodeProgress(pct, label) {
  const fill = document.getElementById('encode_fill');
  const pctEl = document.getElementById('encode_pct');
  const lbl = document.getElementById('encode_label');

  if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (lbl && label) lbl.textContent = label;
}

function encodeLog(msg, kind) {
  const log = document.getElementById('encode_log');
  if (!log) return;

  const line = document.createElement('div');
  line.textContent = '→ ' + msg;
  if (kind === 'error') line.classList.add('is-error');
  if (kind === 'done') line.classList.add('is-done');

  log.appendChild(line);

  while (log.children.length > 5) {
    log.removeChild(log.firstChild);
  }
  log.scrollTop = log.scrollHeight;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — RUN ENCODE
   ───────────────────────────────────────────────────────────── */
async function runEncode() {
  if (_encodeRunning) return;

  if (!_encodeFile) {
    toastError('Pilih file dulu');
    return;
  }

  // Check quota
  const quota = await quotaConsume('encode');
  if (!quota.ok) {
    toastError(quota.message);
    if (quota.reason === 'quota_exceeded' || quota.reason === 'locked') {
      showQuotaModal(quota.message);
    }
    return;
  }

  _encodeRunning = true;
  const btn = document.getElementById('encode_btn');
  if (btn) btn.disabled = true;

  // Get settings
  const crf = (document.getElementById('encode_crf') || {}).value || '18';
  const preset = (document.getElementById('encode_preset') || {}).value || 'medium';

  // Show progress
  const progress = document.getElementById('encode_progress');
  if (progress) progress.hidden = false;

  setEncodeStatus('Processing...', 'working');
  setEncodeProgress(2, 'Loading engine');
  encodeLog('Starting encoder');

  try {
    const t0 = performance.now();

    // Encode
    const blob = await encodeVideo(
      _encodeFile,
      { crf: crf, preset: preset },
      function (pct, label) {
        setEncodeProgress(pct, label);
      },
      function (msg, kind) {
        encodeLog(msg, kind);
      }
    );

    const elapsed = (performance.now() - t0) / 1000;

    // Download
    setEncodeProgress(98, 'Building output');
    const filename = buildFilename(_encodeFile.name, 'encode_crf' + crf, 'mp4');
    downloadBlob(blob, filename);

    setEncodeProgress(100, 'Done');
    encodeLog('Saved: ' + filename, 'done');
    encodeLog('Elapsed: ' + elapsed.toFixed(2) + 's', 'done');

    setEncodeStatus('Selesai', 'success');
    toastSuccess('Encode selesai!');

  } catch (err) {
    console.error('[encode]', err);
    setEncodeStatus('Error: ' + err.message, 'error');
    encodeLog(err.message, 'error');
    toastError('Encode gagal: ' + err.message);
  } finally {
    _encodeRunning = false;
    if (btn) btn.disabled = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — INIT
   ───────────────────────────────────────────────────────────── */
function initEncoder() {
  // Drag & drop
  const drop = document.querySelector('#tool_encode .drop');
  if (!drop) return;

  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      drop.style.borderColor = 'var(--accent)';
      drop.style.background = 'rgba(10, 132, 255, 0.08)';
    });
  });

  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      drop.style.borderColor = '';
      drop.style.background = '';
    });
  });

  drop.addEventListener('drop', function (e) {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      onPickEncode({ target: { files: files } });
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] encoder UI loaded');