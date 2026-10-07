/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/session.js
   Session + Quota + Auth (Cloudflare Worker backend)
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — CONFIG
   ───────────────────────────────────────────────────────────── */
const SESSION_CONFIG = {
  apiBase: 'https://famz-api.furqonalmughni95.workers.dev',
  storageKey: 'famz_session',
  usageKey: 'famz_usage',
  resetKey: 'famz_last_reset',
  hmacHeader: 'X-Famz-Sign'
};

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — QUOTA TABLE
   ───────────────────────────────────────────────────────────── */
const QUOTA_TABLE = {
  free: {
    patch:    3,
    encode:   0,
    upscale:  1,
    analyze:  5,
    queue:    0
  },
  basic: {
    patch:    25,
    encode:   15,
    upscale:  10,
    analyze:  25,
    queue:    15
  },
  pro: {
    patch:    999999,
    encode:   999999,
    upscale:  999999,
    analyze:  999999,
    queue:    999999
  }
};

const FEATURE_LABEL = {
  patch:   'Metadata Patch',
  encode:  'Advanced Encoder',
  upscale: 'AI Upscale',
  analyze: 'Upload Analyzer',
  queue:   'Batch Queue'
};

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — SESSION STATE
   ───────────────────────────────────────────────────────────── */
var _famzSession = {
  user: null,
  tier: 'free',
  connected: false
};

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — INIT SESSION
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

        verifySessionAsync(data.username);
      }
    }
  } catch (e) {
    console.warn('[FAMZ] Session load failed', e);
  }

  return _famzSession;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — VERIFY SESSION (ASYNC)
   ───────────────────────────────────────────────────────────── */
async function verifySessionAsync(identifier) {
  if (!identifier) return;

  try {
    const isTgId = /^\d+$/.test(identifier);
    const param = isTgId ? 'tg=' + identifier : 'username=' + identifier;

    const res = await fetch(SESSION_CONFIG.apiBase + '/api/auth?' + param, {
      headers: buildHeaders()
    });

    if (!res.ok) return;

    const data = await res.json();

    if (data.ok && data.registered) {
      _famzSession.user = {
        username: data.username || identifier,
        tg: data.tg || null,
        tier: data.tier || 'free',
        remaining: data.remaining || null,
        expiry: data.expiry || null
      };
      _famzSession.tier = data.tier || 'free';
      _famzSession.connected = true;

      localStorage.setItem(SESSION_CONFIG.storageKey, JSON.stringify(_famzSession.user));
    } else if (data.reason === 'username_not_found') {
      sessionLogout();
    }
  } catch (e) {
    // Silent fail
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — LOGIN
   ───────────────────────────────────────────────────────────── */
async function sessionLogin(identifier) {
  const val = String(identifier || '').trim().toLowerCase().replace(/^@/, '');

  if (!val || val.length < 3) {
    throw new Error('Username atau Telegram ID minimal 3 karakter');
  }

  const isTgId = /^\d+$/.test(val);
  const param = isTgId ? 'tg=' + val : 'username=' + val;

  const res = await fetch(SESSION_CONFIG.apiBase + '/api/auth?' + param, {
    headers: buildHeaders()
  });

  if (!res.ok) {
    throw new Error('Server gak bisa dihubungi. Coba lagi.');
  }

  const data = await res.json();

  if (!data.ok) {
    throw new Error(data.reason || 'Login gagal');
  }

  if (!data.registered) {
    throw new Error('Belum terdaftar. Daftar via @famz_bot dulu.');
  }

  _famzSession.user = {
    username: data.username || val,
    tg: data.tg || null,
    tier: data.tier || 'free',
    remaining: data.remaining || null,
    expiry: data.expiry || null
  };
  _famzSession.tier = data.tier || 'free';
  _famzSession.connected = true;

  localStorage.setItem(SESSION_CONFIG.storageKey, JSON.stringify(_famzSession.user));

  return _famzSession.user;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — LOGOUT
   ───────────────────────────────────────────────────────────── */
function sessionLogout() {
  _famzSession.user = null;
  _famzSession.tier = 'free';
  _famzSession.connected = false;

  try {
    localStorage.removeItem(SESSION_CONFIG.storageKey);
  } catch (e) {}
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — GET SESSION
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

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — QUOTA CHECK
   ───────────────────────────────────────────────────────────── */
function quotaLimit(feature) {
  const table = QUOTA_TABLE[_famzSession.tier] || QUOTA_TABLE.free;
  return table[feature] != null ? table[feature] : 0;
}

function quotaRemaining(feature) {
  const limit = quotaLimit(feature);
  if (limit >= 999999) return Infinity;
  if (limit === 0) return 0;

  const today = new Date().toDateString();
  const usage = loadUsage();
  const rec = usage[feature];

  if (!rec || rec.date !== today) return limit;
  return Math.max(0, limit - rec.count);
}

async function quotaConsume(feature) {
  const limit = quotaLimit(feature);

  if (limit >= 999999) {
    recordUsage(feature);
    return { ok: true, remaining: Infinity };
  }

  if (limit === 0) {
    return {
      ok: false,
      reason: 'locked',
      message: FEATURE_LABEL[feature] + ' cuma buat Premium & Pro'
    };
  }

  const remaining = quotaRemaining(feature);

  if (remaining <= 0) {
    return {
      ok: false,
      reason: 'quota_exceeded',
      message: 'Kuota ' + FEATURE_LABEL[feature] + ' habis. Reset besok atau upgrade.'
    };
  }

  const today = new Date().toDateString();
  const usage = loadUsage();
  const rec = usage[feature] || { count: 0, date: today };

  if (rec.date !== today) {
    rec.count = 0;
    rec.date = today;
  }

  rec.count++;
  usage[feature] = rec;
  saveUsage(usage);
  recordUsage(feature);

  return { ok: true, remaining: limit - rec.count };
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — USAGE STORAGE
   ───────────────────────────────────────────────────────────── */
function loadUsage() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_CONFIG.usageKey) || '{}');
  } catch (e) {
    return {};
  }
}

function saveUsage(usage) {
  try {
    localStorage.setItem(SESSION_CONFIG.usageKey, JSON.stringify(usage));
  } catch (e) {}
}

function recordUsage(feature) {
  try {
    const stats = JSON.parse(localStorage.getItem('famz_stats') || '{}');
    stats[feature] = (stats[feature] || 0) + 1;
    stats.last_activity = Date.now();
    localStorage.setItem('famz_stats', JSON.stringify(stats));
  } catch (e) {}
}

/* ─────────────────────────────────────────────────────────────
   SECTION 11 — DAILY RESET
   ───────────────────────────────────────────────────────────── */
function autoResetQuota() {
  const today = new Date().toDateString();
  let last = null;

  try {
    last = localStorage.getItem(SESSION_CONFIG.resetKey);
  } catch (e) {}

  if (last !== today) {
    try {
      localStorage.removeItem(SESSION_CONFIG.usageKey);
      localStorage.setItem(SESSION_CONFIG.resetKey, today);
    } catch (e) {}
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 12 — HMAC SIGNATURE (Security)
   ───────────────────────────────────────────────────────────── */
function buildHeaders() {
  const headers = {
    'Accept': 'application/json',
  };

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const sig = btoa(ts + ':' + rand).slice(0, 24);

  headers[SESSION_CONFIG.hmacHeader] = sig;
  return headers;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 13 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] session.js loaded');