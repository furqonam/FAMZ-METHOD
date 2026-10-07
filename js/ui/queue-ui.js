/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/queue-ui.js
   Batch Queue UI — multi-file processing
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — STATE
   ───────────────────────────────────────────────────────────── */
let _queueRunning = false;

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — PICK HANDLER
   ───────────────────────────────────────────────────────────── */
function onPickQueue(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const result = queueAddFiles(files);

  // Show rejected
  if (result.rejected.length > 0) {
    for (let i = 0; i < result.rejected.length; i++) {
      const r = result.rejected[i];
      toastWarning(r.name + ': ' + r.reason);
    }
  }

  if (result.added.length > 0) {
    toastSuccess(result.added.length + ' file ditambah');
  }

  // Reset input
  const input = document.getElementById('queue_input');
  if (input) input.value = '';

  renderQueue();
  updateQueueButton();

  // Clear status
  setQueueStatus('Ready', '');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — RENDER QUEUE LIST
   ───────────────────────────────────────────────────────────── */
function renderQueue() {
  const list = document.getElementById('queue_list');
  if (!list) return;

  const state = queueGetState();

  // Empty state
  if (state.items.length === 0) {
    list.innerHTML = '<div class="queue__empty">Belum ada file. Pilih file MP4 buat mulai.</div>';
    return;
  }

  // Render items
  const html = state.items.map(function (item, i) {
    return renderQueueItem(item, i);
  }).join('');

  list.innerHTML = html;

  // Attach remove buttons
  const removeBtns = list.querySelectorAll('.queue__remove');
  for (let i = 0; i < removeBtns.length; i++) {
    removeBtns[i].addEventListener('click', function (e) {
      e.stopPropagation();
      const id = parseInt(this.dataset.id, 10);
      if (queueRemoveItem(id)) {
        renderQueue();
        updateQueueButton();
      } else {
        toastWarning('Gak bisa remove — file sedang diproses');
      }
    });
  }
}

function renderQueueItem(item, index) {
  let statusClass = '';
  let statusIcon = '📄';
  let statusMeta = formatSize(item.size);

  if (item.status === 'processing') {
    statusClass = 'is-processing';
    statusIcon = '⚙️';
    statusMeta = 'Processing... ' + item.progress + '%';
  } else if (item.status === 'done') {
    statusClass = 'is-done';
    statusIcon = '✓';
    statusMeta = 'Done · ' + (item.result ? formatSize(item.result.after) : '');
  } else if (item.status === 'error') {
    statusClass = 'is-error';
    statusIcon = '✗';
    statusMeta = item.error || 'Error';
  }

  const progressBar = item.status === 'processing'
    ? '<div class="queue__bar"><div class="queue__bar-fill" style="width:' + item.progress + '%"></div></div>'
    : '';

  return [
    '<div class="queue__item ' + statusClass + '">',
      '<div class="queue__icon">' + statusIcon + '</div>',
      '<div class="queue__info">',
        '<div class="queue__name">' + escapeHtml(item.name) + '</div>',
        '<div class="queue__meta">' + statusMeta + '</div>',
      '</div>',
      '<button class="queue__remove" data-id="' + item.id + '" aria-label="Remove">×</button>',
      progressBar,
    '</div>'
  ].join('');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — STATUS
   ───────────────────────────────────────────────────────────── */
function setQueueStatus(text, kind) {
  const box = document.getElementById('queue_status');
  const txt = document.getElementById('queue_status_text');

  if (txt) txt.textContent = text;
  if (box) {
    box.classList.remove('is-working', 'is-success', 'is-error');
    if (kind) box.classList.add('is-' + kind);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — UPDATE BUTTON
   ───────────────────────────────────────────────────────────── */
function updateQueueButton() {
  const btn = document.getElementById('queue_btn');
  const state = queueGetState();

  if (btn) {
    btn.disabled = state.items.length === 0 || state.running;
    btn.textContent = state.running
      ? 'Processing ' + state.counts.done + '/' + state.counts.total
      : 'Run Queue';
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — RUN QUEUE
   ───────────────────────────────────────────────────────────── */
async function runQueue() {
  if (_queueRunning) return;

  const state = queueGetState();
  if (state.items.length === 0) {
    toastError('Queue kosong');
    return;
  }

  // Check quota
  const quota = await quotaConsume('queue');
  if (!quota.ok) {
    toastError(quota.message);
    if (quota.reason === 'quota_exceeded' || quota.reason === 'locked') {
      showQuotaModal(quota.message);
    }
    return;
  }

  _queueRunning = true;
  updateQueueButton();

  setQueueStatus('Processing...', 'working');
  toastInfo('Mulai process queue');

  try {
    await queueProcess(
      { mode: 'smart', platform: 'tiktok' },
      {
        onItemStart: function (item, i) {
          renderQueue();
          updateQueueButton();
          setQueueStatus('Processing: ' + item.name, 'working');
        },

        onItemProgress: function (item, pct) {
          item.progress = pct;
        },

        onItemDone: function (item, i) {
          renderQueue();
          updateQueueButton();
        },

        onItemError: function (item, i, err) {
          renderQueue();
          updateQueueButton();
        },

        onAllDone: function (finalState) {
          const done = finalState.counts.done;
          const err = finalState.counts.error;

          if (err === 0) {
            setQueueStatus('Selesai — ' + done + ' file', 'success');
            toastSuccess('Queue selesai: ' + done + ' file');
          } else {
            setQueueStatus('Selesai — ' + done + ' ok, ' + err + ' error', 'error');
            toastWarning(done + ' ok, ' + err + ' gagal');
          }
        }
      }
    );

  } catch (err) {
    console.error('[queue]', err);
    setQueueStatus('Error: ' + err.message, 'error');
    toastError('Queue gagal: ' + err.message);
  } finally {
    _queueRunning = false;
    renderQueue();
    updateQueueButton();
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — HELPERS
   ───────────────────────────────────────────────────────────── */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — INIT
   ───────────────────────────────────────────────────────────── */
function initQueue() {
  renderQueue();
  updateQueueButton();

  // Drag & drop
  const drop = document.querySelector('#tool_queue .drop');
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
      onPickQueue({ target: { files: files } });
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] queue UI loaded');