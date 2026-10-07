/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/analyzer.js
   Analyze Tool UI — cek HD retained di platform
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — STATE
   ───────────────────────────────────────────────────────────── */
let _analyzeRunning = false;

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — STATUS
   ───────────────────────────────────────────────────────────── */
function setAnalyzeStatus(text, kind) {
  const box = document.getElementById('analyze_status');
  const txt = document.getElementById('analyze_status_text');

  if (txt) txt.textContent = text;
  if (box) {
    box.classList.remove('is-working', 'is-success', 'is-error');
    if (kind) box.classList.add('is-' + kind);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — PROGRESS
   ───────────────────────────────────────────────────────────── */
function hideAnalyzeProgress() {
  const p = document.getElementById('analyze_progress');
  if (p) p.hidden = true;
  const log = document.getElementById('analyze_log');
  if (log) log.innerHTML = '';
  setAnalyzeProgress(0, '');
}

function setAnalyzeProgress(pct, label) {
  const fill = document.getElementById('analyze_fill');
  const pctEl = document.getElementById('analyze_pct');
  const lbl = document.getElementById('analyze_label');

  if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (lbl && label) lbl.textContent = label;
}

function analyzeLog(msg, kind) {
  const log = document.getElementById('analyze_log');
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
   SECTION 04 — RESULT RENDERING
   ───────────────────────────────────────────────────────────── */
function hideAnalyzeResult() {
  const box = document.getElementById('analyze_result');
  if (box) {
    box.hidden = true;
    box.innerHTML = '';
  }
}

function renderAnalyzeResult(result) {
  const box = document.getElementById('analyze_result');
  if (!box) return;

  const hdClass = result.hdRetained ? 'result__badge--ok' : 'result__badge--no';
  const hdTitle = result.hdRetained ? '✓ HD Detected' : '✗ Standard Quality';
  const hdSub = result.hdRetained
    ? 'Video ke-upload dalam kualitas HD'
    : 'Video dikompres oleh platform';

  const stats = result.stats || {};
  const bitrate = result.bitrate ? (result.bitrate / 1000000).toFixed(2) + ' Mbps' : '—';

  box.innerHTML = [
    '<div class="result__badge ' + hdClass + '">',
      '<b>' + hdTitle + '</b>',
      '<i>' + hdSub + '</i>',
    '</div>',

    '<div class="result__grid">',
      renderItem('Platform', result.platform.toUpperCase()),
      renderItem('Resolution', result.resolution),
      renderItem('Bitrate', bitrate),
      renderItem('Duration', result.duration ? result.duration + 's' : '—'),
      renderItem('File Size', result.fileSize ? formatSize(result.fileSize) : '—'),
      renderItem('HD Size', result.hdSize ? formatSize(result.hdSize) : '—'),
      renderItem('Likes', stats.likes ? stats.likes.toLocaleString() : '0'),
      renderItem('Views', stats.views ? stats.views.toLocaleString() : '0'),
      renderItem('Shares', stats.shares ? stats.shares.toLocaleString() : '0'),
      renderItem('Comments', stats.comments ? stats.comments.toLocaleString() : '0'),
    '</div>'
  ].join('');

  box.hidden = false;
}

function renderItem(label, value) {
  return [
    '<div class="result__item">',
      '<div class="result__label">' + label + '</div>',
      '<div class="result__value">' + value + '</div>',
    '</div>'
  ].join('');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — RUN ANALYZE
   ───────────────────────────────────────────────────────────── */
async function runAnalyze() {
  if (_analyzeRunning) return;

  const input = document.getElementById('analyze_url');
  const url = input ? input.value.trim() : '';

  if (!url) {
    toastError('Paste URL dulu');
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    toastError('URL harus mulai dengan http:// atau https://');
    return;
  }

  // Check quota
  const quota = await quotaConsume('analyze');
  if (!quota.ok) {
    toastError(quota.message);
    if (quota.reason === 'quota_exceeded' || quota.reason === 'locked') {
      showQuotaModal(quota.message);
    }
    return;
  }

  _analyzeRunning = true;
  const btn = document.getElementById('analyze_btn');
  if (btn) btn.disabled = true;

  hideAnalyzeResult();

  const progress = document.getElementById('analyze_progress');
  if (progress) progress.hidden = false;

  setAnalyzeStatus('Fetching...', 'working');
  setAnalyzeProgress(5, 'Starting');
  analyzeLog('Analyzing URL');

  try {
    const result = await analyzeUrl(
      url,
      function (pct, label) {
        setAnalyzeProgress(pct, label);
      },
      function (msg, kind) {
        analyzeLog(msg, kind);
      }
    );

    setAnalyzeProgress(100, 'Done');

    setAnalyzeStatus(
      result.hdRetained ? 'HD Detected' : 'Standard Quality',
      result.hdRetained ? 'success' : 'error'
    );

    renderAnalyzeResult(result);

    if (result.hdRetained) {
      toastSuccess('HD retained ✓');
    } else {
      toastWarning('Video dikompres');
    }

  } catch (err) {
    console.error('[analyze]', err);
    setAnalyzeStatus('Error', 'error');
    analyzeLog(err.message, 'error');
    toastError('Analyze gagal: ' + err.message);
  } finally {
    _analyzeRunning = false;
    if (btn) btn.disabled = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — INIT
   ───────────────────────────────────────────────────────────── */
function initAnalyzer() {
  const input = document.getElementById('analyze_url');
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        runAnalyze();
      }
    });

    // Auto detect platform
    input.addEventListener('input', function () {
      const platform = detectPlatform(this.value);
      const hint = document.querySelector('#tool_analyze .hint');
      if (hint) {
        if (platform) {
          hint.textContent = 'Detected: ' + platform.toUpperCase();
          hint.style.color = 'var(--accent)';
        } else {
          hint.textContent = 'Support: TikTok, Instagram, YouTube, Twitter';
          hint.style.color = '';
        }
      }
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] analyzer UI loaded');