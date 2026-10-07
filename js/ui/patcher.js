/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/patcher.js
   Patch Tool UI — drop zone, preview, progress, report, mode
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — STATE
   ───────────────────────────────────────────────────────────── */
let _patchFile = null;
let _patchRunning = false;
let _patchMode = 'patch';

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — OPEN FILE PICKER
   ───────────────────────────────────────────────────────────── */
function openPicker(id) {
  const el = document.getElementById(id);
  if (el) el.click();
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — PATCH MODE
   ───────────────────────────────────────────────────────────── */
function pickPatchMode(mode) {
  if (!mode) return;

  document.querySelectorAll('.mode').forEach(function (m) {
    m.classList.remove('is-active');
  });

  const target = document.querySelector('.mode[data-mode="' + mode + '"]');
  if (target) target.classList.add('is-active');

  _patchMode = mode;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — PICK HANDLER
   ───────────────────────────────────────────────────────────── */
function onPickPatch(e) {
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

  _patchFile = file;

  updateFileTag(file);
  updatePreview(file);

  const btn = document.getElementById('patch_btn');
  if (btn) btn.disabled = false;

  setPatchStatus('Ready', '');
  hideProgress();
  hideReport();

  toastSuccess('File: ' + file.name);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — UPDATE FILE TAG
   ───────────────────────────────────────────────────────────── */
function updateFileTag(file) {
  const tag = document.getElementById('patch_filetag');
  const name = document.getElementById('patch_name');
  const size = document.getElementById('patch_size');

  if (name) name.textContent = file.name;
  if (size) size.textContent = formatSize(file.size);
  if (tag) tag.hidden = false;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — UPDATE PREVIEW
   ───────────────────────────────────────────────────────────── */
function updatePreview(file) {
  const box = document.getElementById('patch_preview');
  const vid = document.getElementById('patch_video');

  if (!box || !vid) return;

  if (vid.src && vid.src.startsWith('blob:')) {
    URL.revokeObjectURL(vid.src);
  }

  vid.src = URL.createObjectURL(file);
  vid.muted = true;
  vid.loop = true;
  vid.playsInline = true;

  box.hidden = false;

  vid.play().catch(function () {});
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — STATUS
   ───────────────────────────────────────────────────────────── */
function setPatchStatus(text, kind) {
  const box = document.getElementById('patch_status');
  const txt = document.getElementById('patch_status_text');

  if (txt) txt.textContent = text;
  if (box) {
    box.classList.remove('is-working', 'is-success', 'is-error');
    if (kind) box.classList.add('is-' + kind);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — PROGRESS
   ───────────────────────────────────────────────────────────── */
function showProgress() {
  const p = document.getElementById('patch_progress');
  if (p) p.hidden = false;
}

function hideProgress() {
  const p = document.getElementById('patch_progress');
  if (p) p.hidden = true;
  const log = document.getElementById('patch_log');
  if (log) log.innerHTML = '';
  setPatchProgress(0, '');
}

function setPatchProgress(pct, label) {
  const fill = document.getElementById('patch_fill');
  const pctEl = document.getElementById('patch_pct');
  const lbl = document.getElementById('patch_label');

  if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (lbl && label) lbl.textContent = label;
}

function patchLog(msg, kind) {
  const log = document.getElementById('patch_log');
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
   SECTION 09 — REPORT
   ───────────────────────────────────────────────────────────── */
function showReport(name, elapsed, before, after) {
  const box = document.getElementById('patch_report');
  if (!box) return;

  const elName = document.getElementById('patch_report_name');
  const elTime = document.getElementById('patch_report_time');
  const elBefore = document.getElementById('patch_report_before');
  const elAfter = document.getElementById('patch_report_after');

  if (elName) elName.textContent = name;
  if (elTime) elTime.textContent = elapsed.toFixed(2) + 's';
  if (elBefore) elBefore.textContent = formatSize(before);
  if (elAfter) elAfter.textContent = formatSize(after);

  box.hidden = false;
}

function hideReport() {
  const box = document.getElementById('patch_report');
  if (box) box.hidden = true;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — RUN PATCH
   ───────────────────────────────────────────────────────────── */
async function runPatch() {
  if (_patchRunning) return;

  if (!_patchFile) {
    toastError('Pilih file dulu');
    return;
  }

  const quota = await quotaConsume('patch');
  if (!quota.ok) {
    toastError(quota.message);
    if (quota.reason === 'quota_exceeded') {
      showQuotaModal(quota.message);
    }
    return;
  }

  _patchRunning = true;
  const btn = document.getElementById('patch_btn');
  if (btn) btn.disabled = true;

  hideReport();
  showProgress();
  setPatchStatus('Processing...', 'working');
  setPatchProgress(5, 'Reading file');
  patchLog('Reading ' + _patchFile.name + ' — mode: ' + _patchMode);

  try {
    const buffer = await readFileAsBuffer(_patchFile);

    setPatchProgress(20, 'Analyzing MP4');
    patchLog('Validating MP4 structure');

    setPatchProgress(40, 'Rebuilding moov');
    patchLog('Patching atoms');

    const result = patchMP4(buffer, {
      mode: _patchMode,
      platform: 'tiktok',
      speedScale: 2
    });

    setPatchProgress(70, 'Validating output');
    patchLog('Checking stco offsets');

    if (!result.validation.ok) {
      throw new Error(result.validation.reason);
    }

    setPatchProgress(85, 'Building output');
    patchLog('Preparing download');

    const filename = buildFilename(_patchFile.name, 'patch_famz', 'mp4');
    const blob = new Blob([result.output], { type: 'video/mp4' });
    downloadBlob(blob, filename);

    setPatchProgress(100, 'Done');
    patchLog('Saved: ' + filename, 'done');

    setPatchStatus('Selesai', 'success');

    showReport(_patchFile.name, result.elapsed, result.before, result.after);

    toastSuccess('Patch selesai!');

  } catch (err) {
    console.error('[patch]', err);
    setPatchStatus('Error: ' + err.message, 'error');
    patchLog(err.message, 'error');
    toastError('Patch gagal: ' + err.message);
  } finally {
    _patchRunning = false;
    if (btn) btn.disabled = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 11 — DRAG & DROP
   ───────────────────────────────────────────────────────────── */
function initPatchDragDrop() {
  const drop = document.getElementById('patch_drop');
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
      onPickPatch({ target: { files: files } });
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 12 — INIT
   ───────────────────────────────────────────────────────────── */
function initPatcher() {
  initPatchDragDrop();
}

/* ─────────────────────────────────────────────────────────────
   SECTION 13 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] patcher.js loaded');