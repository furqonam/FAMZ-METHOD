/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/main.js
   Entry point — bootstrap aplikasi
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — BOOT
   ───────────────────────────────────────────────────────────── */
(function bootstrap() {
  // Tunggu DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();

function onReady() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║                                              ║');
  console.log('║        𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬                       ║');
  console.log('║        Patch. Encode. Upscale. Analyze.      ║');
  console.log('║                                              ║');
  console.log('║        © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣              ║');
  console.log('║                                              ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Initialize app
  initApp().catch(function (err) {
    console.error('[FAMZ] Boot failed:', err);
    showToast('Boot error — cek console', 'error', 5000);
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — GLOBAL EXPORTS (buat onclick di HTML)
   ───────────────────────────────────────────────────────────── */
window.switchTool     = switchTool;
window.openPicker     = openPicker;
window.onPickPatch    = onPickPatch;
window.onPickEncode   = onPickEncode;
window.onPickUpscale  = onPickUpscale;
window.onPickQueue    = onPickQueue;
window.runPatch       = runPatch;
window.runEncode      = runEncode;
window.runUpscale     = runUpscale;
window.runAnalyze     = runAnalyze;
window.runQueue       = runQueue;
window.showQuotaModal = showQuotaModal;

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — VERSION INFO
   ───────────────────────────────────────────────────────────── */
window.FAMZ = {
  name:    'FAMZ METHOD',
  version: '1.0.0',
  brand:   '𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝙫𝟭.𝟬',
  handle:  'vurkonnn',
  build:   '2026',
  info: function () {
    return {
      name: this.name,
      version: this.version,
      brand: this.brand,
      handle: this.handle
    };
  }
};

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — DEBUG HELPERS
   ───────────────────────────────────────────────────────────── */
window.FAMZ.debug = {
  clearCache: function () {
    try {
      localStorage.removeItem('famz_session');
      localStorage.removeItem('famz_usage');
      localStorage.removeItem('famz_stats');
      localStorage.removeItem('famz_analyzer_cache');
      localStorage.removeItem('famz_errors');
      console.log('[FAMZ] All cache cleared');
      location.reload();
    } catch (e) {}
  },

  clearErrors: function () {
    try {
      localStorage.removeItem('famz_errors');
    } catch (e) {}
  },

  showErrors: function () {
    try {
      const errs = JSON.parse(localStorage.getItem('famz_errors') || '[]');
      console.table(errs);
    } catch (e) {}
  },

  clearSW: async function () {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (let i = 0; i < regs.length; i++) {
        await regs[i].unregister();
      }
      console.log('[FAMZ] Service workers cleared');
      location.reload();
    }
  },

  state: function () {
    return {
      session: typeof sessionGet === 'function' ? sessionGet() : null,
      queue: typeof queueGetState === 'function' ? queueGetState() : null,
      encoderMode: typeof getEncoderMode === 'function' ? getEncoderMode() : null,
      upscaleInfo: typeof getUpscaleInfo === 'function' ? getUpscaleInfo() : null
    };
  }
};

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] main.js loaded · ready to boot');