/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/toast.js
   Toast notification UI
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — STATE
   ───────────────────────────────────────────────────────────── */
let _toastTimer = null;
let _toastEl = null;

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — MAIN TOAST FUNCTION
   ───────────────────────────────────────────────────────────── */
function showToast(message, type, duration) {
  if (!_toastEl) {
    _toastEl = document.getElementById('toast');
  }
  if (!_toastEl) return;

  type = type || 'default';
  duration = duration || 2800;

  // Reset classes
  _toastEl.classList.remove('is-show', 'is-error', 'is-success', 'is-warning');

  // Set message
  _toastEl.textContent = String(message || '');

  // Set type
  if (type === 'error') {
    _toastEl.classList.add('is-error');
  } else if (type === 'success') {
    _toastEl.classList.add('is-success');
  } else if (type === 'warning') {
    _toastEl.classList.add('is-warning');
  }

  // Show
  _toastEl.classList.add('is-show');

  // Clear existing timer
  if (_toastTimer) {
    clearTimeout(_toastTimer);
  }

  // Auto hide
  _toastTimer = setTimeout(function () {
    _toastEl.classList.remove('is-show');
  }, duration);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — SHORTCUT FUNCTIONS
   ───────────────────────────────────────────────────────────── */
function toastInfo(message, duration) {
  showToast(message, 'default', duration);
}

function toastSuccess(message, duration) {
  showToast(message, 'success', duration);
}

function toastError(message, duration) {
  showToast(message, 'error', duration || 3500);
}

function toastWarning(message, duration) {
  showToast(message, 'warning', duration || 3000);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — HIDE TOAST
   ───────────────────────────────────────────────────────────── */
function hideToast() {
  if (_toastEl) {
    _toastEl.classList.remove('is-show');
  }
  if (_toastTimer) {
    clearTimeout(_toastTimer);
    _toastTimer = null;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] toast.js loaded');