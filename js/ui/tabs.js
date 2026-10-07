/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/ui/tabs.js
   Tab switcher UI — navigasi antar tool
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — STATE
   ───────────────────────────────────────────────────────────── */
let _activeTool = 'patch';

const TOOL_LIST = ['patch', 'encode', 'upscale', 'analyze', 'queue'];

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — SWITCH TOOL
   ───────────────────────────────────────────────────────────── */
function switchTool(name) {
  if (!name || TOOL_LIST.indexOf(name) === -1) {
    console.warn('[FAMZ] Unknown tool:', name);
    return;
  }

  // Update tab buttons
  const tabs = document.querySelectorAll('.tab');
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    if (t.dataset.tool === name) {
      t.classList.add('is-active');
    } else {
      t.classList.remove('is-active');
    }
  }

  // Update tool panels
  const tools = document.querySelectorAll('.tool');
  for (let i = 0; i < tools.length; i++) {
    const p = tools[i];
    if (p.id === 'tool_' + name) {
      p.classList.add('is-active');
    } else {
      p.classList.remove('is-active');
    }
  }

  _activeTool = name;

  // Scroll ke atas (kecuali first time)
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Dispatch event
  try {
    window.dispatchEvent(new CustomEvent('famz:tool-changed', {
      detail: { tool: name }
    }));
  } catch (e) {}
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — GET ACTIVE
   ───────────────────────────────────────────────────────────── */
function getActiveTool() {
  return _activeTool;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — KEYBOARD SHORTCUTS
   ───────────────────────────────────────────────────────────── */
function initTabsKeyboard() {
  document.addEventListener('keydown', function (e) {
    // Skip kalau lagi ngetik di input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Alt + 1..5 → switch tool
    if (e.altKey && e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      if (TOOL_LIST[idx]) {
        switchTool(TOOL_LIST[idx]);
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — URL HASH ROUTING (opsional)
   ───────────────────────────────────────────────────────────── */
function initTabsHash() {
  function readHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash && TOOL_LIST.indexOf(hash) !== -1) {
      switchTool(hash);
    }
  }

  window.addEventListener('hashchange', readHash);
  readHash();
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — INIT
   ───────────────────────────────────────────────────────────── */
function initTabs() {
  initTabsKeyboard();
  initTabsHash();

  // Setup tab buttons (in case onclick gak ke-set)
  const tabs = document.querySelectorAll('.tab');
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    if (t.dataset.tool) {
      t.addEventListener('click', function () {
        switchTool(this.dataset.tool);
      });
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] tabs.js loaded');