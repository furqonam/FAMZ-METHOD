/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/upscale.js
   Upscale Tool UI — image picker, preview, AI upscale
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — STATE
   ───────────────────────────────────────────────────────────── */
let _upscaleFile = null;
let _upscaleRunning = false;

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — PICK HANDLER
   ───────────────────────────────────────────────────────────── */
function onPickUpscale(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    toastError('Cuma gambar yang didukung');
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    toastError('File terlalu besar (max 20MB)');
    return;
  }

  _upscaleFile = file;

  // Update file tag
  const tag = document.getElementById('upscale_filetag');
  const name = document.getElementById('upscale_name');
  const size = document.getElementById('upscale_size');

  if (name) name.textContent = file.name;
  if (size) size.textContent = formatSize(file.size);
  if (tag) tag.hidden = false;

  // Update preview
  const box = document.getElementById('upscale_preview');
  const img = document.getElementById('upscale_img');
  if (box && img) {
    if (img.src && img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
    img.src = URL.createObjectURL(file);
    box.hidden = false;
  }

  // Enable button
  const btn = document.getElementById('upscale_btn');
  if (btn) btn.disabled = false;

  // Reset status
  setUpscaleStatus('Ready', '');
  hideUpscaleProgress();

  toastSuccess('File: ' + file.name);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — STATUS
   ───────────────────────────────────────────────────────────── */
function setUpscaleStatus(text, kind) {
  const box = document.getElementById('upscale_status');
  const txt = document.getElementById('upscale_status_text');

  if (txt) txt.textContent = text;
  if (box) {
    box.classList.remove('is-working', 'is-success', 'is-error');
    if (kind) box.classList.add('is-' + kind);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — PROGRESS
   ───────────────────────────────────────────────────────────── */
function hideUpscaleProgress() {
  const p = document.getElementById('upscale_progress');
  if (p) p.hidden = true;
  const log = document.getElementById('upscale_log');
  if (log) log.innerHTML = '';
  setUpscaleProgress(0, '');
}

function setUpscaleProgress(pct, label) {
  const fill = document.getElementById('upscale_fill');
  const pctEl = document.getElementById('upscale_pct');
  const lbl = document.getElementById('upscale_label');

  if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (lbl && label) lbl.textContent = label;
}

function upscaleLog(msg, kind) {
  const log = document.getElementById('upscale_log');
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
   SECTION 05 — RUN UPSCALE
   ───────────────────────────────────────────────────────────── */
async function runUpscale() {
  if (_upscaleRunning) return;

  if (!_upscaleFile) {
    toastError('Pilih gambar dulu');
    return;
  }

  // Check quota
  const quota = await quotaConsume('upscale');
  if (!quota.ok) {
    toastError(quota.message);
    if (quota.reason === 'quota_exceeded' || quota.reason === 'locked') {
      showQuotaModal(quota.message);
    }
    return;
  }

  _upscaleRunning = true;
  const btn = document.getElementById('upscale_btn');
  if (btn) btn.disabled = true;

  // Show progress
  const progress = document.getElementById('upscale_progress');
  if (progress) progress.hidden = false;

  setUpscaleStatus('Processing...', 'working');
  setUpscaleProgress(2, 'Starting');
  upscaleLog('AI upscale started');

  try {
    const result = await upscaleImage(
      _upscaleFile,
      function (pct, label) {
        setUpscaleProgress(pct, label);
      },
      function (msg, kind) {
        upscaleLog(msg, kind);
      }
    );

    // Download
    setUpscaleProgress(98, 'Saving');
    const filename = buildFilename(_upscaleFile.name, 'upscaled_famz', 'png');
    downloadBlob(result.blob, filename);

    setUpscaleProgress(100, 'Done');
    upscaleLog('Saved: ' + filename, 'done');
    upscaleLog('Provider: ' + result.provider, 'done');

    setUpscaleStatus('Selesai', 'success');
    toastSuccess('Upscale selesai!');

  } catch (err) {
    console.error('[upscale]', err);
    setUpscaleStatus('Error: ' + err.message, 'error');
    upscaleLog(err.message, 'error');
    toastError('Upscale gagal: ' + err.message);
  } finally {
    _upscaleRunning = false;
    if (btn) btn.disabled = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — INIT
   ───────────────────────────────────────────────────────────── */
function initUpscale() {
  const drop = document.querySelector('#tool_upscale .drop');
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
      onPickUpscale({ target: { files: files } });
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] upscale UI loaded');