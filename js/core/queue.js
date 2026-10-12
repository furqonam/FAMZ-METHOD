/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/queue.js
   Batch Queue Engine — proses banyak file sekaligus
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — CONFIG
   ───────────────────────────────────────────────────────────── */
const QUEUE_CONFIG = {
  maxFiles:      10,
  maxConcurrent: 1,                /* Process 1 at a time (stability) */
  maxFileSize:   500 * 1024 * 1024 /* 500MB */
};

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — QUEUE STATE
   ───────────────────────────────────────────────────────────── */
const _queue = {
  items:        [],  /* { id, file, name, size, status, progress, result, error } */
  running:      false,
  currentIndex: -1,
  autoDownload: true
};

let _queueIdCounter = 0;

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — ADD ITEMS
   ───────────────────────────────────────────────────────────── */
function queueAddFiles(files) {
  const arr      = Array.from(files);
  const added    = [];
  const rejected = [];

  for (let i = 0; i < arr.length; i++) {
    const file = arr[i];

    /* 03.1 — Check max files */
    if (_queue.items.length >= QUEUE_CONFIG.maxFiles) {
      rejected.push({
        name:   file.name,
        reason: 'Queue penuh (max ' + QUEUE_CONFIG.maxFiles + ')'
      });
      continue;
    }

    /* 03.2 — Check type */
    if (!file.type.includes('video') && !file.name.toLowerCase().endsWith('.mp4')) {
      rejected.push({ name: file.name, reason: 'Bukan MP4' });
      continue;
    }

    /* 03.3 — Check size */
    if (file.size > QUEUE_CONFIG.maxFileSize) {
      rejected.push({ name: file.name, reason: 'File terlalu besar' });
      continue;
    }

    /* 03.4 — Add item */
    const item = {
      id:       ++_queueIdCounter,
      file:     file,
      name:     file.name,
      size:     file.size,
      status:   'pending',  /* pending | processing | done | error */
      progress: 0,
      result:   null,
      error:    null
    };

    _queue.items.push(item);
    added.push(item);
  }

  return { added: added, rejected: rejected };
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — REMOVE ITEM
   ───────────────────────────────────────────────────────────── */
function queueRemoveItem(id) {
  const idx = _queue.items.findIndex(function (item) { return item.id === id; });
  if (idx === -1) return false;

  /* Gak boleh remove item yang lagi diproses */
  if (_queue.items[idx].status === 'processing') return false;

  _queue.items.splice(idx, 1);
  return true;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — CLEAR QUEUE
   ───────────────────────────────────────────────────────────── */
function queueClear() {
  if (_queue.running) return false;
  _queue.items        = [];
  _queue.currentIndex = -1;
  return true;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — GET STATE
   ───────────────────────────────────────────────────────────── */
function queueGetState() {
  const counts = {
    total:      _queue.items.length,
    pending:    0,
    processing: 0,
    done:       0,
    error:      0
  };

  for (let i = 0; i < _queue.items.length; i++) {
    counts[_queue.items[i].status]++;
  }

  return {
    items:        _queue.items,
    counts:       counts,
    running:      _queue.running,
    currentIndex: _queue.currentIndex
  };
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — PROCESS QUEUE
   ───────────────────────────────────────────────────────────── */
async function queueProcess(options, callbacks) {
  if (_queue.running) {
    throw new Error('Queue sedang berjalan');
  }

  if (_queue.items.length === 0) {
    throw new Error('Queue kosong');
  }

  /* 07.1 — Resolve processor (dengan guard) */
  const processor = options && options.processor
    ? options.processor
    : (typeof patchMP4 === 'function' ? patchMP4 : null);

  if (!processor || typeof processor !== 'function') {
    throw new Error('Processor tidak tersedia — patch engine gagal load');
  }

  _queue.running = true;
  options   = options   || {};
  callbacks = callbacks || {};

  const onItemStart    = callbacks.onItemStart    || function () {};
  const onItemProgress = callbacks.onItemProgress || function () {};
  const onItemDone     = callbacks.onItemDone     || function () {};
  const onItemError    = callbacks.onItemError    || function () {};
  const onAllDone      = callbacks.onAllDone      || function () {};

  try {
    for (let i = 0; i < _queue.items.length; i++) {
      const item = _queue.items[i];

      /* Skip yang udah done */
      if (item.status === 'done') continue;

      _queue.currentIndex = i;
      item.status         = 'processing';
      item.progress       = 0;
      item.error          = null;

      onItemStart(item, i);

      try {
        const buffer = await item.file.arrayBuffer();
        const result = await processor(buffer, options);

        /* Validate result */
        if (!result.validation || !result.validation.ok) {
          const reason = result.validation
            ? result.validation.reason
            : 'Validation failed';
          throw new Error(reason);
        }

        /* Build output file */
        const outputName = buildOutputName(item.name, options.mode || 'patch');
        const blob       = new Blob([result.output], { type: 'video/mp4' });

        item.status   = 'done';
        item.progress = 100;
        item.result   = {
          blob:    blob,
          name:    outputName,
          size:    blob.size,
          before:  result.before,
          after:   result.after,
          elapsed: result.elapsed
        };

        onItemDone(item, i);

        /* Auto download */
        if (_queue.autoDownload) {
          downloadBlob(blob, outputName);
        }

        /* Delay kecil biar UI sempet update */
        await sleep(300);

      } catch (err) {
        item.status = 'error';
        item.error  = err.message;

        onItemError(item, i, err);
      }
    }
  } finally {
    _queue.running      = false;
    _queue.currentIndex = -1;
    onAllDone(queueGetState());
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — BUILD OUTPUT NAME
   ───────────────────────────────────────────────────────────── */
function buildOutputName(inputName, mode) {
  const base      = inputName.replace(/\.[^/.]+$/, '');
  const suffix    = mode || 'patch';
  const timestamp = Date.now().toString().slice(-6);
  return base + '_' + suffix + '_' + timestamp + '.mp4';
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — AUTO DOWNLOAD TOGGLE
   ───────────────────────────────────────────────────────────── */
function queueSetAutoDownload(enabled) {
  _queue.autoDownload = !!enabled;
  return _queue.autoDownload;
}

function queueGetAutoDownload() {
  return _queue.autoDownload;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — DOWNLOAD ALL (FIXED: skip yang udah ke-download)
   ═══════════════════════════════════════════════════════════════
   Kalau autoDownload aktif → file udah ke-download otomatis.
   Fungsi ini cuma buat download yang BELUM ke-download.
   ───────────────────────────────────────────────────────────── */
async function queueDownloadAll() {
  const doneItems = _queue.items.filter(function (item) {
    return item.status === 'done' && item.result && !item.result.downloaded;
  });

  if (doneItems.length === 0) {
    throw new Error('Gak ada file baru untuk di-download');
  }

  let count = 0;
  for (let i = 0; i < doneItems.length; i++) {
    const item = doneItems[i];

    try {
      downloadBlob(item.result.blob, item.result.name);
      item.result.downloaded = true;
      count++;
      await sleep(200);
    } catch (err) {
      console.warn('[queue] download failed:', item.name, err.message);
    }
  }

  return count;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 11 — STATS
   ───────────────────────────────────────────────────────────── */
function queueGetStats() {
  const state       = queueGetState();
  let totalBefore   = 0;
  let totalAfter    = 0;
  let totalTime     = 0;

  for (let i = 0; i < state.items.length; i++) {
    const item = state.items[i];
    if (item.result) {
      totalBefore += item.result.before  || 0;
      totalAfter  += item.result.after   || 0;
      totalTime   += item.result.elapsed || 0;
    }
  }

  return {
    files:       state.counts.done,
    totalBefore: totalBefore,
    totalAfter:  totalAfter,
    totalTime:   totalTime
  };
}

/* ─────────────────────────────────────────────────────────────
   SECTION 12 — EXPORT
   ═══════════════════════════════════════════════════════════════
   CATATAN: sleep() TIDAK didefinisikan di sini.
   Pakai sleep() dari encoder.js (SECTION 08.4).
   Cek urutan load di index.html: encoder.js → queue.js
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] queue.js loaded');