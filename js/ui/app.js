/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/app.js
   App Orchestration + Gate + Account + Badges + Support
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — HELPERS
   ───────────────────────────────────────────────────────────── */
function esc(text) {
  if (typeof escapeHtml === 'function') {
    try { return escapeHtml(text); } catch (e) {}
  }
  const div = document.createElement('div');
  div.textContent = String(text || '');
  return div.innerHTML;
}
function openSupport() {
  window.open('https://sociabuzz.com/famzid/support', '_blank', 'noopener,noreferrer');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — GATE (Login Fullscreen)
   ───────────────────────────────────────────────────────────── */
function openGate(msg) {
  const gate = document.getElementById('gate');
  if (gate) gate.hidden = false;
  if (msg) showGateErr(msg);

  setTimeout(function () {
    const input = document.getElementById('gate_input');
    if (input) input.focus();
  }, 300);
}

function closeGate() {
  const gate = document.getElementById('gate');
  if (gate) gate.hidden = true;
}

function showGateErr(msg) {
  const el = document.getElementById('gate_err');
  if (el) {
    el.textContent = msg;
    el.classList.add('is-show');
  }
}

function clearGateErr() {
  const el = document.getElementById('gate_err');
  if (el) {
    el.textContent = '';
    el.classList.remove('is-show');
  }
}

async function gateLogin() {
  const input = document.getElementById('gate_input');
  const btn = document.getElementById('gate_btn');
  const val = input ? input.value.trim().toLowerCase().replace(/^@/, '') : '';

  clearGateErr();

  if (!val || val.length < 3) {
    showGateErr('Masukkan username atau TG ID (min 3 karakter)');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Checking...';
  }

  try {
    await sessionLogin(val);

    closeGate();
    updateTierBadge();

    const session = sessionGet();
    showToast('Welcome — ' + session.tier.toUpperCase(), 'success');

  } catch (err) {
    console.error('[gate]', err);
    showGateErr(err.message || 'Login gagal. Coba lagi.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Continue';
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — TIER BADGE
   ───────────────────────────────────────────────────────────── */
function handleTierClick() {
  const session = typeof sessionGet === 'function' ? sessionGet() : null;

  if (session && session.connected) {
    if (typeof openAccountModal === 'function') {
      openAccountModal();
    }
  } else {
    openGate();
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — QUOTA MODAL
   ───────────────────────────────────────────────────────────── */
function showQuotaModal(message) {
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
        '<button class="btn btn--primary" id="famz_quota_upgrade">Support</button>',
      '</div>',
    '</div>'
  ].join('');

  document.body.appendChild(modal);

  requestAnimationFrame(function () { modal.classList.add('is-show'); });

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
      window.open('https://t.me/vurkonnn', '_blank');
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — TOOL INIT
   ───────────────────────────────────────────────────────────── */
function initAllTools() {
  try { if (typeof initPatcher === 'function') initPatcher(); } catch (e) { console.warn('[init] patcher', e); }
  try { if (typeof initEncoder === 'function') initEncoder(); } catch (e) { console.warn('[init] encoder', e); }
  try { if (typeof initUpscale === 'function') initUpscale(); } catch (e) { console.warn('[init] upscale', e); }
  try { if (typeof initAnalyzer === 'function') initAnalyzer(); } catch (e) { console.warn('[init] analyzer', e); }
  try { if (typeof initQueue === 'function') initQueue(); } catch (e) { console.warn('[init] queue', e); }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — BADGES
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

function initAppBadge() {
  const badge = document.querySelector('.badge');
  if (badge && !badge.textContent.trim()) {
    badge.textContent = 'v1.0';
  }
}

function updateTierBadge() {
  const el = document.getElementById('tier_badge');
  if (!el) return;

  const session = typeof sessionGet === 'function' ? sessionGet() : null;

  if (session && session.connected) {
    const tier = session.tier || 'free';
    el.textContent = tier.toUpperCase();
    el.className = 'tier-badge tier-badge--' + tier;
  } else {
    el.textContent = 'LOGIN';
    el.className = 'tier-badge tier-badge--free';
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — PWA SERVICE WORKER
   ───────────────────────────────────────────────────────────── */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

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
   SECTION 08 — HANDLERS
   ───────────────────────────────────────────────────────────── */
function initVisibilityHandler() {
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (typeof autoResetQuota === 'function') autoResetQuota();
      if (typeof updateQuotaBadges === 'function') updateQuotaBadges();
      if (typeof updateTierBadge === 'function') updateTierBadge();
    }
  });
}

function initErrorBoundary() {
  window.addEventListener('error', function (e) {
    try {
      const errors = JSON.parse(localStorage.getItem('famz_errors') || '[]');
      errors.push({ msg: e.message, ts: Date.now(), url: location.href });
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
   SECTION 09 — APP INIT
   ───────────────────────────────────────────────────────────── */
async function initApp() {
  console.log('[FAMZ] Starting app...');

  // 1. Session init
  try {
    if (typeof sessionInit === 'function') await sessionInit();
  } catch (e) {
    console.warn('[init] session failed', e);
  }

  // 2. Cek session — kalo gak login, buka gate
  const session = typeof sessionGet === 'function' ? sessionGet() : null;
  const hasSavedSession = localStorage.getItem('famz_session');

  if (!session || !session.connected) {
    if (!hasSavedSession) {
      openGate();
    } else {
      try {
        const saved = JSON.parse(hasSavedSession);
        if (saved && saved.username) {
          await sessionLogin(saved.username).catch(function () {
            openGate();
          });
        }
      } catch (e) {
        openGate();
      }
    }
  }

  // 3. Tabs
  try {
    if (typeof initTabs === 'function') initTabs();
  } catch (e) {
    console.warn('[init] tabs failed', e);
  }

  // 4. All tools
  initAllTools();

  // 5. Badges
  updateQuotaBadges();
  initAppBadge();
  updateTierBadge();

  // 6. Load account
  try {
    if (typeof loadAccount === 'function') loadAccount();
  } catch (e) {
    console.warn('[init] account failed', e);
  }

  // 7. PWA
  registerServiceWorker();

  // 8. Handlers
  initVisibilityHandler();
  initErrorBoundary();

  // 9. Welcome toast
  setTimeout(function () {
    const s = typeof sessionGet === 'function' ? sessionGet() : null;
    if (s && s.connected) {
      showToast('Welcome back — ' + (s.tier || 'free').toUpperCase(), 'success');
    }
    updateTierBadge();
  }, 800);

  // 10. Encoder detection
  if (typeof detectEncoderSupport === 'function') {
    detectEncoderSupport().then(function (supported) {
      console.log('[FAMZ] Encoder mode:', supported ? 'WebCodecs' : 'FFmpeg');
    }).catch(function () {});
  }

  console.log('[FAMZ] App ready');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] app.js loaded');