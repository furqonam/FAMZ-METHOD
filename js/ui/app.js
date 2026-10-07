/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/app.js
   App Orchestration — init semua UI + modal + PWA
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — QUOTA MODAL
   ───────────────────────────────────────────────────────────── */
/* Helper lokal — jangan depend ke queue-ui.js */
function esc(text) {
  if (typeof escapeHtml === 'function') {
    try { return escapeHtml(text); } catch (e) {}
  }
  const div = document.createElement('div');
  div.textContent = String(text || '');
  return div.innerHTML;
}

function showQuotaModal(message) {
  // Hapus modal lama kalau ada
  const old = document.getElementById('famz_quota_modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'famz_quota_modal';
  modal.className = 'modal';
  modal.innerHTML = [
    '<div class="modal__backdrop"></div>',
    '<div class="modal__box glass">',
      '<div class="modal__icon">⏱</div>',
      '<h3 class="modal__title">Kuota Habis</h3>',
      '<p class="modal__text">' + esc(message || 'Kuota harian lu udah abis. Upgrade buat unlimited.') + '</p>',
      '<div class="modal__actions">',
        '<button class="btn btn--ghost" id="famz_quota_close">Nanti</button>',
        '<button class="btn btn--primary" id="famz_quota_upgrade">Upgrade</button>',
      '</div>',
    '</div>'
  ].join('');

  document.body.appendChild(modal);

  // Animate in
  requestAnimationFrame(function () {
    modal.classList.add('is-show');
  });

  // Handlers
  const close = function () {
    modal.classList.remove('is-show');
    setTimeout(function () { modal.remove(); }, 300);
  };

  const backdrop = modal.querySelector('.modal__backdrop');
  if (backdrop) backdrop.addEventListener('click', close);

  const closeBtn = document.getElementById('famz_quota_close');
  if (closeBtn) closeBtn.addEventListener('click', close);

  const upgradeBtn = document.getElementById('famz_quota_upgrade');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', function () {
      window.open('https://t.me/famz_bot', '_blank');
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — TOOL INIT REGISTRY
   ───────────────────────────────────────────────────────────── */
function initAllTools() {
  try { if (typeof initPatcher === 'function') initPatcher(); } catch (e) { console.warn('[init] patcher', e); }
  try { if (typeof initEncoder === 'function') initEncoder(); } catch (e) { console.warn('[init] encoder', e); }
  try { if (typeof initUpscale === 'function') initUpscale(); } catch (e) { console.warn('[init] upscale', e); }
  try { if (typeof initAnalyzer === 'function') initAnalyzer(); } catch (e) { console.warn('[init] analyzer', e); }
  try { if (typeof initQueue === 'function') initQueue(); } catch (e) { console.warn('[init] queue', e); }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — QUOTA BADGE UPDATE
   ───────────────────────────────────────────────────────────── */
function updateQuotaBadges() {
  const features = ['patch', 'encode', 'upscale', 'analyze'];
  const prefix = 'famz_quota_';

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const el = document.getElementById(prefix + f);
    if (!el) continue;

    const remaining = quotaRemaining(f);
    if (remaining === Infinity) {
      el.textContent = '∞';
      el.classList.add('is-unlimited');
    } else {
      el.textContent = remaining;
      el.classList.remove('is-unlimited');
      if (remaining === 0) el.classList.add('is-empty');
      else el.classList.remove('is-empty');
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — PWA SERVICE WORKER
   ───────────────────────────────────────────────────────────── */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    // Detect update
    reg.addEventListener('updatefound', function () {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', function () {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('Update tersedia — refresh buat pakai', 'info', 5000);
        }
      });
    });
  } catch (e) {
    console.warn('[PWA] SW registration failed', e);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — APP BADGE (Header Version)
   ───────────────────────────────────────────────────────────── */
function initAppBadge() {
  const badge = document.querySelector('.badge');
  if (badge && !badge.textContent.trim()) {
    badge.textContent = 'v1.0';
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05.1 — TIER BADGE (Free / Basic / Pro)
   ───────────────────────────────────────────────────────────── */
function updateTierBadge() {
  const el = document.getElementById('tier_badge');
  if (!el) return;

  const session = typeof sessionGet === 'function' ? sessionGet() : null;
  const tier = (session && session.connected) ? (session.tier || 'free') : 'free';

  el.textContent = tier.toUpperCase();
  el.className = 'tier-badge tier-badge--' + tier;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — VISIBILITY HANDLER
   ───────────────────────────────────────────────────────────── */
function initVisibilityHandler() {
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      // Auto-reset quota kalau ganti hari
      if (typeof autoResetQuota === 'function') {
        autoResetQuota();
      }
      if (typeof updateQuotaBadges === 'function') {
        updateQuotaBadges();
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — ERROR BOUNDARY
   ───────────────────────────────────────────────────────────── */
function initErrorBoundary() {
  window.addEventListener('error', function (e) {
    // Log ke localStorage
    try {
      const errors = JSON.parse(localStorage.getItem('famz_errors') || '[]');
      errors.push({
        msg: e.message,
        ts: Date.now(),
        url: location.href
      });
      if (errors.length > 30) errors.shift();
      localStorage.setItem('famz_errors', JSON.stringify(errors));
    } catch (err) {}
  });

  window.addEventListener('unhandledrejection', function (e) {
    try {
      const errors = JSON.parse(localStorage.getItem('famz_errors') || '[]');
      errors.push({
        msg: 'Promise: ' + (e.reason ? e.reason.message : 'unknown'),
        ts: Date.now(),
        url: location.href
      });
      if (errors.length > 30) errors.shift();
      localStorage.setItem('famz_errors', JSON.stringify(errors));
    } catch (err) {}
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — APP INIT (Main)
   ───────────────────────────────────────────────────────────── */
async function initApp() {
  console.log('[FAMZ] Starting app...');

  // 1. Session init
  try {
    if (typeof sessionInit === 'function') {
      await sessionInit();
    }
  } catch (e) {
    console.warn('[init] session failed', e);
  }

  // 2. Init tabs
  try {
    if (typeof initTabs === 'function') initTabs();
  } catch (e) {
    console.warn('[init] tabs failed', e);
  }

  // 3. Init all tools
  initAllTools();

// 4. Update UI badges
updateQuotaBadges();
initAppBadge();
updateTierBadge(); 

  // 5. Register service worker (PWA)
  registerServiceWorker();

  // 6. Setup handlers
  initVisibilityHandler();
  initErrorBoundary();

// 7. Welcome toast
setTimeout(function () {
  const session = typeof sessionGet === 'function' ? sessionGet() : null;
  if (session && session.connected) {
    const tier = session.tier || 'free';
    showToast('Welcome back — ' + tier.toUpperCase(), 'success');
  }
  updateTierBadge();
}, 800);

  // 8. Detect encoder mode (async, background)
  if (typeof detectEncoderSupport === 'function') {
    detectEncoderSupport().then(function (supported) {
      const mode = supported ? 'WebCodecs (fast)' : 'FFmpeg (fallback)';
      console.log('[FAMZ] Encoder mode:', mode);
    }).catch(function () {});
  }

  console.log('[FAMZ] App ready — 𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] app.js loaded');