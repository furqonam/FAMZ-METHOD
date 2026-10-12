/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝙫𝟭.𝟬
   js/core/session.js
   Session + Quota + Auth + Device Binding
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   CONFIG
   ───────────────────────────────────────────────────────────── */
const SESSION_CONFIG = {
  apiBase:    'https://famz-bot.furqonalmughni95.workers.dev',
  authPath:   '/auth',
  quotaPath:  '/quota',
  storageKey: 'famz_session',
  usageKey:   'famz_usage_cache',
  resetKey:   'famz_last_reset',
  deviceKey:  'famz_device_token'
};

/* ─────────────────────────────────────────────────────────────
   SESSION STATE
   ───────────────────────────────────────────────────────────── */
var _famzSession = {
  user: null,
  tier: 'free',
  connected: false
};

/* ─────────────────────────────────────────────────────────────
   DEVICE TOKEN STORAGE
   ───────────────────────────────────────────────────────────── */
function getStoredDeviceToken() {
  try { return localStorage.getItem(SESSION_CONFIG.deviceKey) || null; }
  catch (e) { return null; }
}

function saveDeviceToken(token) {
  try { if (token) localStorage.setItem(SESSION_CONFIG.deviceKey, token); }
  catch (e) {}
}

function clearDeviceToken() {
  try { localStorage.removeItem(SESSION_CONFIG.deviceKey); }
  catch (e) {}
}

/* ─────────────────────────────────────────────────────────────
   INIT SESSION
   ───────────────────────────────────────────────────────────── */
async function sessionInit() {
  autoResetQuota();

  try {
    const raw = localStorage.getItem(SESSION_CONFIG.storageKey);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.username) {
        _famzSession.user = data;
        _famzSession.tier = data.tier || 'free';
        _famzSession.connected = true;
      }
    }
  } catch (e) {
    console.warn('[FAMZ] Session load failed', e);
  }

  return _famzSession;
}

/* ─────────────────────────────────────────────────────────────
   LOGIN
   ───────────────────────────────────────────────────────────── */
async function sessionLogin(identifier) {
  const val = String(identifier || '').trim().toLowerCase().replace(/^@/, '');
  if (!val) throw new Error('ID tidak valid');

  const deviceToken = getStoredDeviceToken();
  const headers = { 'Accept': 'application/json' };
  if (deviceToken) headers['X-Famz-Device'] = deviceToken;

  const res = await fetch(
    SESSION_CONFIG.apiBase + SESSION_CONFIG.authPath + '?tg=' + encodeURIComponent(val),
    { headers }
  );

  if (res.status === 429) {
    throw new Error('Terlalu banyak percobaan. Silakan coba lagi dalam 1 jam.');
  }

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));

    if (data.need_register) {
      throw new Error('ID belum terdaftar. Buka bot @Famzzz_bot dan kirim /register terlebih dahulu.');
    }

    if (data.device_locked) {
      throw new Error('Akun ini sudah terikat ke device lain. Hubungi owner untuk reset device.');
    }

    throw new Error(data.error || 'Akses ditolak.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login gagal.');
  }

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Login gagal.');

  if (data.device_token) saveDeviceToken(data.device_token);

  _famzSession.user = data;
  _famzSession.tier = data.tier || 'free';
  _famzSession.connected = true;

  localStorage.setItem(SESSION_CONFIG.storageKey, JSON.stringify(data));

  return _famzSession.user;
}

/* ─────────────────────────────────────────────────────────────
   LOGOUT
   ───────────────────────────────────────────────────────────── */
function sessionLogout() {
  _famzSession.user = null;
  _famzSession.tier = 'free';
  _famzSession.connected = false;

  try { localStorage.removeItem(SESSION_CONFIG.storageKey); } catch (e) {}
  clearDeviceToken();
}

/* ─────────────────────────────────────────────────────────────
   GET SESSION
   ───────────────────────────────────────────────────────────── */
function sessionGet() {
  return {
    user: _famzSession.user,
    tier: _famzSession.tier,
    connected: _famzSession.connected
  };
}

function sessionIsPro() {
  return _famzSession.tier === 'pro';
}

function sessionIsBasic() {
  return _famzSession.tier === 'basic' || _famzSession.tier === 'pro';
}

function sessionIsOwner() {
  return _famzSession.user && _famzSession.user.is_owner === true;
}

/* ─────────────────────────────────────────────────────────────
   QUOTA CHECK
   ───────────────────────────────────────────────────────────── */
function quotaLimit(feature) {
  const table = QUOTA_TABLE[_famzSession.tier] || QUOTA_TABLE.free;
  return table[feature] != null ? table[feature] : 0;
}

async function quotaConsume(feature) {
  const session = sessionGet();

  if (!session || !session.connected) {
    return {
      ok: false,
      reason: 'not_logged_in',
      message: 'Silakan login terlebih dahulu'
    };
  }

  const tg = session.user.tg || session.user.username;

  try {
    const res = await fetch(SESSION_CONFIG.apiBase + SESSION_CONFIG.quotaPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tg, feature })
    });

    if (!res.ok) {
      return { ok: false, reason: 'server_error', message: 'Server error: ' + res.status };
    }

    const data = await res.json();

    if (!data.ok) {
      return {
        ok: false,
        reason: data.reason || 'error',
        message: data.error || 'Quota check failed'
      };
    }

    return {
      ok: true,
      remaining: data.remaining,
      unlimited: data.unlimited || false
    };

  } catch (err) {
    console.warn('[FAMZ] Server unreachable');
    return { ok: false, reason: 'network_error', message: 'Koneksi bermasalah' };
  }
}

/* ─────────────────────────────────────────────────────────────
   DAILY RESET
   ───────────────────────────────────────────────────────────── */
function autoResetQuota() {
  const today = new Date().toDateString();
  let last = null;

  try { last = localStorage.getItem(SESSION_CONFIG.resetKey); } catch (e) {}

  if (last !== today) {
    try {
      localStorage.removeItem(SESSION_CONFIG.usageKey);
      localStorage.setItem(SESSION_CONFIG.resetKey, today);
    } catch (e) {}
  }
}

/* ─────────────────────────────────────────────────────────────
   QUOTA TABLE (local fallback)
   ───────────────────────────────────────────────────────────── */
const QUOTA_TABLE = {
  free:  { patch: 3,  encode: 0,  upscale: 1,  analyze: 5,  queue: 0  },
  basic: { patch: 25, encode: 15, upscale: 10, analyze: 25, queue: 15 },
  pro:   { patch: -1, encode: -1, upscale: -1, analyze: -1, queue: -1 }
};

/* ─────────────────────────────────────────────────────────────
   EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] session.js loaded — worker: ' + SESSION_CONFIG.apiBase);