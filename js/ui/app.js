/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝙫𝟭.𝟬
   js/ui/app.js
   App Orchestration + Gate + Account + Badges + Support
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   SECTION 01 — HELPERS
   ═══════════════════════════════════════════════════════════════ */
function esc(text) {
  const div = document.createElement('div');
  div.textContent = String(text || '');
  return div.innerHTML;
}

function openSupport() {
  window.open('https://t.me/vurkonnn', '_blank', 'noopener,noreferrer');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 02 — LOGIN GATE
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   02.1 — Buka Bot untuk Registrasi
   ───────────────────────────────────────────────────────────── */
function openBotForRegister() {
  window.open('https://t.me/Famzzz_bot', '_blank');
}

/* ─────────────────────────────────────────────────────────────
   02.2 — Buka Bot untuk VIP
   ───────────────────────────────────────────────────────────── */
function openBotForVip() {
  window.open('https://t.me/Famzzz_bot', '_blank');
}

/* ─────────────────────────────────────────────────────────────
   02.3 — Buka Gate
   ───────────────────────────────────────────────────────────── */
function openGate(msg) {
  const gate = document.getElementById('gate');
  if (gate) gate.hidden = false;
  if (msg) showGateErr(msg);
}

/* ─────────────────────────────────────────────────────────────
   02.4 — Tutup Gate
   ───────────────────────────────────────────────────────────── */
function closeGate() {
  const gate = document.getElementById('gate');
  if (gate) gate.hidden = true;
}

/* ─────────────────────────────────────────────────────────────
   02.5 — Tampilkan Error
   ───────────────────────────────────────────────────────────── */
function showGateErr(msg) {
  const el = document.getElementById('gate_err');
  if (el) {
    el.textContent = msg;
    el.style.color = 'var(--danger)';
  }
}

/* ─────────────────────────────────────────────────────────────
   02.6 — Bersihkan Error
   ───────────────────────────────────────────────────────────── */
function clearGateErr() {
  const el = document.getElementById('gate_err');
  if (el) el.textContent = '';
}

/* ─────────────────────────────────────────────────────────────
   02.7 — Proses Login
   ───────────────────────────────────────────────────────────── */
async function gateLogin() {
  const input = document.getElementById('gate_input');
  const btn   = document.getElementById('gate_btn');
  const val   = input ? input.value.trim().toLowerCase().replace(/^@/, '') : '';

  clearGateErr();

  if (!val || val.length < 3) {
    showGateErr('Masukkan Telegram ID terlebih dahulu.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Memeriksa...';
  }

  try {
    await sessionLogin(val);

    closeGate();
    updateTierBadge();
    updateQuotaBadges();

    const session = sessionGet();
    showToast('Selamat datang — ' + session.tier.toUpperCase(), 'success');

  } catch (err) {
    console.error('[gate]', err);
    showGateErr(err.message || 'Login gagal.');

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 03 — TIER BADGE
   ═══════════════════════════════════════════════════════════════ */
function handleTierClick() {
  const session = typeof sessionGet === 'function' ? sessionGet() : null;

  if (session && session.connected) {
    if (typeof openAccountModal === 'function') openAccountModal();
  } else {
    openGate();
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

/* ═══════════════════════════════════════════════════════════════
   SECTION 04 — QUOTA MODAL
   ═══════════════════════════════════════════════════════════════ */
function showQuotaModal(message, reason) {
  const old = document.getElementById('famz_quota_modal');
  if (old) old.remove();

  const showVip = (reason === 'quota_exceeded' || !reason);

  const modal = document.createElement('div');
  modal.id = 'famz_quota_modal';
  modal.className = 'modal';
  modal.innerHTML = [
    '<div class="modal__backdrop"></div>',
    '<div class="modal__box glass">',
      '<div class="modal__icon">' + (showVip ? '💎' : '⏱') + '</div>',
      '<h3 class="modal__title">' + (showVip ? 'Batas Tercapai' : 'Akses Ditolak') + '</h3>',
      '<p class="modal__text">' + esc(message || 'Kuota harian Anda telah habis.') + '</p>',
      showVip ? '<p class="modal__sub">Tunggu 24 jam atau upgrade ke VIP untuk akses tanpa batas.</p>' : '',
      '<div class="modal__actions">',
        '<button class="btn btn--ghost" id="famz_quota_close">Tunggu 24 Jam</button>',
        showVip ? '<button class="btn btn--primary" id="famz_quota_vip">💎 Daftar VIP</button>' : '',
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

  const vipBtn = document.getElementById('famz_quota_vip');
  if (vipBtn) {
    vipBtn.addEventListener('click', function () {
      close();
      openBotForVip();
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 05 — AUTO-LOGIN DARI URL
   ═══════════════════════════════════════════════════════════════ */
async function checkUrlLogin() {
  const urlParams = new URLSearchParams(window.location.search);
  const tgId = urlParams.get('tg');

  if (!tgId) return false;

  try {
    await sessionLogin(tgId);
    closeGate();
    updateTierBadge();
    updateQuotaBadges();

    const session = sessionGet();
    showToast('Selamat datang — ' + session.tier.toUpperCase(), 'success');

    window.history.replaceState({}, '', window.location.pathname);

    return true;
  } catch (err) {
    openGate(err.message);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 06 — QUOTA BADGES
   ═══════════════════════════════════════════════════════════════ */
function quotaRemaining(feature) {
  const session = typeof sessionGet === 'function' ? sessionGet() : null;
  if (!session || !session.connected) return 0;

  const limits = {
    free:  { patch: 3,  encode: 0,  upscale: 1,  analyze: 5,  queue: 0  },
    basic: { patch: 25, encode: 15, upscale: 10, analyze: 25, queue: 15 },
    pro:   { patch: -1, encode: -1, upscale: -1, analyze: -1, queue: -1 }
  };

  const table = limits[session.tier] || limits.free;
  return table[feature] === -1 ? Infinity : table[feature];
}

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
  if (badge && !badge.textContent.trim()) badge.textContent = 'v1.0';
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 07 — TOOL INIT
   ═══════════════════════════════════════════════════════════════ */
function initAllTools() {
  try { if (typeof initPatcher  === 'function') initPatcher();  } catch (e) {}
  try { if (typeof initEncoder  === 'function') initEncoder();  } catch (e) {}
  try { if (typeof initUpscale  === 'function') initUpscale();  } catch (e) {}
  try { if (typeof initAnalyzer === 'function') initAnalyzer(); } catch (e) {}
  try { if (typeof initQueue    === 'function') initQueue();    } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 08 — PWA SERVICE WORKER
   ═══════════════════════════════════════════════════════════════ */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    reg.addEventListener('updatefound', function () {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', function () {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('Update tersedia — refresh untuk memakai versi terbaru', 'info', 5000);
        }
      });
    });
  } catch (e) {
    console.warn('[PWA] SW registration failed', e);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 09 — HANDLERS
   ═══════════════════════════════════════════════════════════════ */
function initVisibilityHandler() {
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (typeof autoResetQuota    === 'function') autoResetQuota();
      if (typeof updateQuotaBadges === 'function') updateQuotaBadges();
      if (typeof updateTierBadge   === 'function') updateTierBadge();
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

/* ═══════════════════════════════════════════════════════════════
   SECTION 10 — APP INIT
   ═══════════════════════════════════════════════════════════════ */
async function initApp() {
  console.log('[FAMZ] Starting app...');

  try {
    if (typeof sessionInit === 'function') await sessionInit();
  } catch (e) {
    console.warn('[init] session failed', e);
  }

  const autoLogged = await checkUrlLogin();
  if (!autoLogged) {
    const session = typeof sessionGet === 'function' ? sessionGet() : null;
    if (!session || !session.connected) openGate();
  }

  try { if (typeof initTabs === 'function') initTabs(); } catch (e) {}
  initAllTools();

  updateQuotaBadges();
  initAppBadge();
  updateTierBadge();

  try { if (typeof loadAccount === 'function') loadAccount(); } catch (e) {}

  registerServiceWorker();
  initVisibilityHandler();
  initErrorBoundary();

  setTimeout(function () {
    const s = typeof sessionGet === 'function' ? sessionGet() : null;
    if (s && s.connected) {
      showToast('Selamat datang — ' + (s.tier || 'free').toUpperCase(), 'success');
    }
    updateTierBadge();
  }, 800);

  console.log('[FAMZ] App ready');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 11 — EXPORT
   ═══════════════════════════════════════════════════════════════ */
console.log('[FAMZ] app.js loaded');