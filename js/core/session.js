/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/session.js
   Session + Quota + Auth + Device Binding
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   SECTION 01 — CONFIG
   ═══════════════════════════════════════════════════════════════ */
const SESSION_CONFIG = {
  apiBase:    'https://famz-bot.furqonalmughni95.workers.dev',
  authPath:   '/auth',
  quotaPath:  '/quota',
  storageKey: 'famz_session',
  usageKey:   'famz_usage_cache',
  resetKey:   'famz_last_reset',
  deviceKey:  'famz_device_token'
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 02 — QUOTA TABLE (client-side hint only)
   ⚠️  Server tetap source of truth. Ini cuma buat UI.
   ═══════════════════════════════════════════════════════════════ */
const QUOTA_TABLE = {
  free:  { patch: 3,  encode: 0,  upscale: 1,  analyze: 5,  queue: 0  },
  basic: { patch: 25, encode: 15, upscale: 10, analyze: 25, queue: 15 },
  pro:   { patch: -1, encode: -1, upscale: -1, analyze: -1, queue: -1 }
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 03 — SESSION STATE
   ═══════════════════════════════════════════════════════════════ */
var _famzSession = {
  user:      null,
  tier:      'free',
  connected: false
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 04 — DEVICE TOKEN STORAGE
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   SECTION 05 — HELPER: extract user data dari response
   Support 2 format:
   1. { ok, username, tier, ... }          (flat)
   2. { ok, user: { username, ... }, tier } (nested)
   ═══════════════════════════════════════════════════════════════ */
function extractUserData(data) {
  if (!data) return null;

  /* Format 1: flat — username di root */
  if (data.username) {
    return data;
  }

  /* Format 2: nested — user object */
  if (data.user && data.user.username) {
    return Object.assign({}, data.user, {
      tier: data.tier || data.user.tier || 'free'
    });
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 06 — INIT SESSION
   ═══════════════════════════════════════════════════════════════ */
async function sessionInit() {
  autoResetQuota();

  try {
    const raw = localStorage.getItem(SESSION_CONFIG.storageKey);
    if (raw) {
      const stored = JSON.parse(raw);
      const user   = extractUserData(stored);

      if (user) {
        _famzSession.user      = user;
        _famzSession.tier      = user.tier || 'free';
        _famzSession.connected = true;
      }
    }
  } catch (e) {
    console.warn('[FAMZ] Session load failed', e);
  }

  return _famzSession;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 07 — LOGIN
   ═══════════════════════════════════════════════════════════════ */
async function sessionLogin(identifier) {
  const val = String(identifier || '').trim().toLowerCase().replace(/^@/, '');
  if (!val) throw new Error('ID tidak valid');

  const deviceToken = getStoredDeviceToken();
  const headers     = { 'Accept': 'application/json' };
  if (deviceToken) headers['X-Famz-Device'] = deviceToken;

  const res = await fetch(
    SESSION_CONFIG.apiBase + SESSION_CONFIG.authPath + '?tg=' + encodeURIComponent(val),
    { headers }
  );

  /* 07.1 — Rate limited */
  if (res.status === 429) {
    throw new Error('Terlalu banyak percobaan. Silakan coba lagi dalam 1 jam.');
  }

  /* 07.2 — Forbidden */
  if (res.status === 403) {
    const data = await res.json().catch(function () { return {}; });

    if (data.need_register) {
      throw new Error('ID belum terdaftar. Buka bot @Famzzz_bot dan kirim /register terlebih dahulu.');
    }

    if (data.device_locked) {
      throw new Error('Akun ini sudah terikat ke device lain. Hubungi owner untuk reset device.');
    }

    throw new Error(data.error || 'Akses ditolak.');
  }

  /* 07.3 — Other errors */
  if (!res.ok) {
    const data = await res.json().catch(function () { return {}; });
    throw new Error(data.error || 'Login gagal.');
  }

  /* 07.4 — Parse response */
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Login gagal.');

  if (data.device_token) saveDeviceToken(data.device_token);

  /* Extract user data (support flat + nested) */
  const user = extractUserData(data);
  if (!user) {
    throw new Error('Format response server tidak valid');
  }

  _famzSession.user      = user;
  _famzSession.tier      = user.tier || 'free';
  _famzSession.connected = true;

  /* Simpan raw response biar sessionInit bisa parse */
  try {
    localStorage.setItem(SESSION_CONFIG.storageKey, JSON.stringify(data));
  } catch (e) {}

  return _famzSession.user;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 08 — LOGOUT
   ═══════════════════════════════════════════════════════════════ */
function sessionLogout() {
  _famzSession.user      = null;
  _famzSession.tier      = 'free';
  _famzSession.connected = false;

  try { localStorage.removeItem(SESSION_CONFIG.storageKey); } catch (e) {}
  clearDeviceToken();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 09 — GET SESSION
   ═══════════════════════════════════════════════════════════════ */
function sessionGet() {
  return {
    user:      _famzSession.user,
    tier:      _famzSession.tier,
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
  return !!(_famzSession.user && _famzSession.user.is_owner === true);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 10 — QUOTA
   ═══════════════════════════════════════════════════════════════ */

/* 10.1 — Get limit dari table (client-side hint) */
function quotaLimit(feature) {
  const table = QUOTA_TABLE[_famzSession.tier] || QUOTA_TABLE.free;
  return table[feature] != null ? table[feature] : 0;
}

/* 10.2 — Get remaining (pakai usage cache) */
function quotaRemaining(feature) {
  const limit = quotaLimit(feature);

  /* -1 = unlimited */
  if (limit === -1) return Infinity;

  /* Cek usage dari cache */
  const usage = getUsageCache();
  const used  = usage[feature] || 0;
  const sisa  = Math.max(0, limit - used);

  return sisa;
}

/* 10.3 — Get usage dari localStorage */
function getUsageCache() {
  try {
    const raw = localStorage.getItem(SESSION_CONFIG.usageKey);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return (data && typeof data === 'object') ? data : {};
  } catch (e) {
    return {};
  }
}

/* 10.4 — Simpan usage ke localStorage */
function setUsageCache(usage) {
  try {
    localStorage.setItem(SESSION_CONFIG.usageKey, JSON.stringify(usage));
  } catch (e) {}
}

/* 10.5 — Increment usage lokal */
function incUsageLocal(feature) {
  const usage = getUsageCache();
  usage[feature] = (usage[feature] || 0) + 1;
  setUsageCache(usage);
  return usage[feature];
}

/* 10.6 — Consume quota (server-based) */
async function quotaConsume(feature) {
  const session = sessionGet();

  /* Not logged in */
  if (!session || !session.connected) {
    return {
      ok:      false,
      reason:  'not_logged_in',
      message: 'Silakan login terlebih dahulu'
    };
  }

  const tg = session.user.tg || session.user.username;

  /* Build request dengan device token */
  const deviceToken = getStoredDeviceToken();
  const headers     = { 'Content-Type': 'application/json' };
  if (deviceToken) headers['X-Famz-Device'] = deviceToken;

  try {
    const res = await fetch(SESSION_CONFIG.apiBase + SESSION_CONFIG.quotaPath, {
      method:  'POST',
      headers: headers,
      body:    JSON.stringify({ tg: tg, feature: feature })
    });

    /* Server error */
    if (!res.ok) {
      return {
        ok:      false,
        reason:  'server_error',
        message: 'Server error: ' + res.status
      };
    }

    const data = await res.json();

    /* Quota ditolak server */
    if (!data.ok) {
      return {
        ok:      false,
        reason:  data.reason || 'error',
        message: data.error || 'Quota check failed'
      };
    }

    /* Sukses: increment usage lokal */
    incUsageLocal(feature);

    return {
      ok:        true,
      remaining: data.remaining,
      unlimited: data.unlimited || false
    };

  } catch (err) {
    console.warn('[FAMZ] Quota server unreachable', err);
    return {
      ok:      false,
      reason:  'network_error',
      message: 'Koneksi bermasalah'
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 11 — DAILY RESET
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   SECTION 12 — EXPORT
   ═══════════════════════════════════════════════════════════════ */
console.log('[FAMZ] session.js loaded — worker: ' + SESSION_CONFIG.apiBase);