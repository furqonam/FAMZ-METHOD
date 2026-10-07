/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/analyzer.js
   Upload Analyzer — cek HD retained di TikTok/IG/YT/Twitter
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — CONFIG
   ───────────────────────────────────────────────────────────── */
const ANALYZER_CONFIG = {
  cacheTTL: 24 * 60 * 60 * 1000, // 24 jam
  cacheKey: 'famz_analyzer_cache',
  maxCacheEntries: 30,
  requestTimeout: 8000
};

const PLATFORM_PATTERNS = {
  tiktok:    /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i,
  instagram: /(?:instagram\.com|instagr\.am)/i,
  youtube:   /(?:youtube\.com|youtu\.be|youtube\.com\/shorts)/i,
  twitter:   /(?:twitter\.com|x\.com)/i
};

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — MAIN ANALYZE FUNCTION
   ───────────────────────────────────────────────────────────── */
async function analyzeUrl(url, onProgress, onLog) {
  onProgress = onProgress || function () {};
  onLog = onLog || function () {};

  const t0 = performance.now();

  /* STEP 1 — Validate URL */
  const platform = detectPlatform(url);
  if (!platform) {
    throw new Error('URL gak dikenali. Support: TikTok, Instagram, YouTube, Twitter');
  }

  onProgress(5, 'Detecting platform');
  onLog('Platform: ' + platform);

  /* STEP 2 — Check cache */
  const cached = getCache(url);
  if (cached) {
    onProgress(100, 'From cache');
    onLog('Loaded from cache', 'done');
    return cached;
  }

  /* STEP 3 — Fetch metadata */
  onProgress(15, 'Fetching metadata');
  onLog('Requesting API...');

  let data;

  if (platform === 'tiktok') {
    data = await fetchTikTok(url, onLog);
  } else if (platform === 'instagram') {
    data = await fetchInstagram(url, onLog);
  } else if (platform === 'youtube') {
    data = await fetchYouTube(url, onLog);
  } else if (platform === 'twitter') {
    data = await fetchTwitter(url, onLog);
  }

  onProgress(80, 'Parsing result');

  /* STEP 4 — Build result */
  const result = buildResult(platform, url, data);

  /* STEP 5 — Cache */
  setCache(url, result);

  onProgress(100, 'Done');

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  onLog('Complete in ' + elapsed + 's', 'done');

  return result;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — PLATFORM DETECTION
   ───────────────────────────────────────────────────────────── */
function detectPlatform(url) {
  for (const platform in PLATFORM_PATTERNS) {
    if (PLATFORM_PATTERNS[platform].test(url)) {
      return platform;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — TIKTOK FETCHER (multi-fallback)
   ───────────────────────────────────────────────────────────── */
async function fetchTikTok(url, onLog) {
  const enc = encodeURIComponent(url);

  const attempts = [
    {
      name: 'TikWM Direct',
      fn: async function () {
        const res = await fetchT('https://www.tikwm.com/api/?url=' + enc + '&hd=1&web=1');
        const d = await res.json();
        if (d.code !== 0 || !d.data) throw new Error('no data');
        return d.data;
      }
    },
    {
      name: 'Tiklydown',
      fn: async function () {
        const res = await fetchT('https://api.tiklydown.eu.org/api/download?url=' + enc);
        const d = await res.json();
        if (!d.video) throw new Error('no data');
        return {
          title: d.title,
          duration: d.duration,
          width: d.video.width,
          height: d.video.height,
          hdplay: d.video.noWatermark,
          play: d.video.watermark,
          cover: d.video.cover,
          author: { nickname: d.author ? d.author.name : null, unique_id: d.author ? d.author.username : null }
        };
      }
    },
    {
      name: 'TikWM via AllOrigins',
      fn: async function () {
        const proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.tikwm.com/api/?url=' + enc + '&hd=1');
        const res = await fetchT(proxy);
        const p = await res.json();
        const d = JSON.parse(p.contents);
        if (d.code !== 0 || !d.data) throw new Error('no data');
        return d.data;
      }
    },
    {
      name: 'TikWM Raw',
      fn: async function () {
        const res = await fetchT('https://www.tikwm.com/api/?url=' + enc + '&hd=1');
        const d = await res.json();
        if (d.code !== 0 || !d.data) throw new Error('no data');
        return d.data;
      }
    },
    {
      name: 'oEmbed',
      fn: async function () {
        const res = await fetchT('https://www.tiktok.com/oembed?url=' + enc);
        const d = await res.json();
        return {
          title: d.title,
          author: { nickname: d.author_name },
          cover: d.thumbnail_url,
          hdplay: null,
          width: 0,
          height: 0
        };
      }
    }
  ];

  let lastError = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      onLog('Trying ' + attempt.name + '...');
      const data = await attempt.fn();
      onLog(attempt.name + ' OK');
      return data;
    } catch (err) {
      lastError = err;
      onLog(attempt.name + ' failed: ' + err.message, 'error');
    }
  }

  throw new Error('Semua sumber TikTok gagal. Coba lagi nanti.');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — INSTAGRAM FETCHER
   ───────────────────────────────────────────────────────────── */
async function fetchInstagram(url, onLog) {
  const enc = encodeURIComponent(url);

  const attempts = [
    {
      name: 'SnapInsta',
      fn: async function () {
        const res = await fetchT('https://api.snapinsta.app/api/v1/fetch?url=' + enc);
        const d = await res.json();
        if (!d.url) throw new Error('no data');
        return d;
      }
    },
    {
      name: 'oEmbed',
      fn: async function () {
        const res = await fetchT('https://api.instagram.com/oembed?url=' + enc);
        const d = await res.json();
        return {
          title: d.title,
          author: { nickname: d.author_name },
          cover: d.thumbnail_url,
          hdplay: null
        };
      }
    }
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      onLog('Trying ' + attempts[i].name + '...');
      const data = await attempts[i].fn();
      onLog(attempts[i].name + ' OK');
      return data;
    } catch (err) {
      onLog(attempts[i].name + ' failed', 'error');
    }
  }

  throw new Error('Instagram fetch gagal. Coba lagi nanti.');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — YOUTUBE FETCHER
   ───────────────────────────────────────────────────────────── */
async function fetchYouTube(url, onLog) {
  const enc = encodeURIComponent(url);

  const attempts = [
    {
      name: 'oEmbed',
      fn: async function () {
        const res = await fetchT('https://www.youtube.com/oembed?url=' + enc + '&format=json');
        const d = await res.json();
        return {
          title: d.title,
          author: { nickname: d.author_name },
          cover: d.thumbnail_url,
          hdplay: null
        };
      }
    }
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      onLog('Trying ' + attempts[i].name + '...');
      const data = await attempts[i].fn();
      onLog(attempts[i].name + ' OK');
      return data;
    } catch (err) {
      onLog(attempts[i].name + ' failed', 'error');
    }
  }

  throw new Error('YouTube fetch gagal.');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — TWITTER FETCHER
   ───────────────────────────────────────────────────────────── */
async function fetchTwitter(url, onLog) {
  const enc = encodeURIComponent(url);

  const attempts = [
    {
      name: 'oEmbed',
      fn: async function () {
        const res = await fetchT('https://publish.twitter.com/oembed?url=' + enc);
        const d = await res.json();
        return {
          title: d.author_name,
          author: { nickname: d.author_name },
          cover: null,
          hdplay: null
        };
      }
    }
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      onLog('Trying ' + attempts[i].name + '...');
      const data = await attempts[i].fn();
      onLog(attempts[i].name + ' OK');
      return data;
    } catch (err) {
      onLog(attempts[i].name + ' failed', 'error');
    }
  }

  throw new Error('Twitter fetch gagal.');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — BUILD RESULT
   ───────────────────────────────────────────────────────────── */
function buildResult(platform, url, data) {
  const w = parseInt(data.width, 10) || 0;
  const h = parseInt(data.height, 10) || 0;

  let hdRetained = false;

  if (data.hdplay && typeof data.hdplay === 'string' && data.hdplay.length > 10) {
    hdRetained = true;
  }
  if (w >= 1080 || h >= 1080) {
    hdRetained = true;
  }

  // Fallback: kalau platform YT/IG tanpa data width/height
  // → hdRetained: null (unknown), bukan false
  const isUnknown = (w === 0 && h === 0 && !data.hdplay);

  return {
    platform: platform,
    url: url,
    hdRetained: isUnknown ? null : hdRetained,
    resolution: (w && h) ? (w + '×' + h) : '—',
    bitrate: estimateBitrate(data),
    fileSize: data.size || 0,
    hdSize: data.hd_size || 0,
    duration: data.duration || 0,
    title: data.title || '(no title)',
    author: data.author ? (data.author.nickname || data.author.unique_id) : '—',
    cover: normalizeCover(data.cover || data.origin_cover || null),
    stats: {
      likes: data.digg_count || 0,
      views: data.play_count || 0,
      comments: data.comment_count || 0,
      shares: data.share_count || 0
    }
  };
}

function estimateBitrate(data) {
  if (data.hd_size && data.duration) {
    return Math.round((data.hd_size * 8) / data.duration);
  }
  if (data.size && data.duration) {
    return Math.round((data.size * 8) / data.duration);
  }
  return 0;
}

function normalizeCover(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return null;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — CACHE
   ───────────────────────────────────────────────────────────── */
function getCache(url) {
  try {
    const cache = JSON.parse(localStorage.getItem(ANALYZER_CONFIG.cacheKey) || '{}');
    const rec = cache[url];
    if (rec && Date.now() - rec.ts < ANALYZER_CONFIG.cacheTTL) {
      return rec.data;
    }
  } catch (e) {}
  return null;
}

function setCache(url, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(ANALYZER_CONFIG.cacheKey) || '{}');
    cache[url] = { ts: Date.now(), data: data };

    const keys = Object.keys(cache);
    if (keys.length > ANALYZER_CONFIG.maxCacheEntries) {
      keys.sort(function (a, b) { return cache[a].ts - cache[b].ts; });
      const toRemove = keys.length - ANALYZER_CONFIG.maxCacheEntries;
      for (let i = 0; i < toRemove; i++) {
        delete cache[keys[i]];
      }
    }

    localStorage.setItem(ANALYZER_CONFIG.cacheKey, JSON.stringify(cache));
  } catch (e) {}
}

function clearCache() {
  try {
    localStorage.removeItem(ANALYZER_CONFIG.cacheKey);
  } catch (e) {}
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — HELPERS
   ───────────────────────────────────────────────────────────── */
function fetchT(url, timeout) {
  const ms = timeout || ANALYZER_CONFIG.requestTimeout;
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, ms);

  return fetch(url, {
    signal: ctrl.signal,
    headers: { 'Accept': 'application/json' }
  }).finally(function () {
    clearTimeout(timer);
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 11 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] analyzer.js loaded');