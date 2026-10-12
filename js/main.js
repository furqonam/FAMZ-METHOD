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

  initApp().catch(function (err) {
    console.error('[FAMZ] Boot failed:', err);
    if (typeof showToast === 'function') {
      showToast('Boot error — cek console', 'error', 5000);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — SAFE EXPORT HELPER
   Cek dulu fungsinya ada baru di-export, biar gak error
   kalau file sumbernya gagal load.
   ───────────────────────────────────────────────────────────── */
function safeExport(name, fn) {
  if (typeof fn === 'function') {
    window[name] = fn;
    return true;
  }
  console.warn('[FAMZ] Export skipped (not a function):', name);
  return false;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — GLOBAL EXPORTS (buat onclick di HTML)
   Dipanggil setelah semua script load (main.js di paling akhir)
   ───────────────────────────────────────────────────────────── */
(function exportGlobals() {

  /* 03.1 — Tool navigation */
  safeExport('switchTool',     typeof switchTool     !== 'undefined' ? switchTool     : null);
  safeExport('openPicker',     typeof openPicker     !== 'undefined' ? openPicker     : null);

  /* 03.2 — File pick handlers */
  safeExport('onPickPatch',    typeof onPickPatch    !== 'undefined' ? onPickPatch    : null);
  safeExport('onPickEncode',   typeof onPickEncode   !== 'undefined' ? onPickEncode   : null);
  safeExport('onPickUpscale',  typeof onPickUpscale  !== 'undefined' ? onPickUpscale  : null);
  safeExport('onPickQueue',    typeof onPickQueue    !== 'undefined' ? onPickQueue    : null);
  safeExport('onPickAvatar',   typeof onPickAvatar   !== 'undefined' ? onPickAvatar   : null);

  /* 03.3 — Run handlers */
  safeExport('runPatch',       typeof runPatch       !== 'undefined' ? runPatch       : null);
  safeExport('runEncode',      typeof runEncode      !== 'undefined' ? runEncode      : null);
  safeExport('runUpscale',     typeof runUpscale     !== 'undefined' ? runUpscale     : null);
  safeExport('runAnalyze',     typeof runAnalyze     !== 'undefined' ? runAnalyze     : null);
  safeExport('runQueue',       typeof runQueue       !== 'undefined' ? runQueue       : null);

  /* 03.4 — Patch preview controls */
  safeExport('togglePatchPlay', typeof togglePatchPlay !== 'undefined' ? togglePatchPlay : null);
  safeExport('togglePatchMute', typeof togglePatchMute !== 'undefined' ? togglePatchMute : null);

  /* 03.5 — Login gate */
  safeExport('gateLogin',           typeof gateLogin           !== 'undefined' ? gateLogin           : null);
  safeExport('openBotForRegister',  typeof openBotForRegister  !== 'undefined' ? openBotForRegister  : null);
  safeExport('openBotForVip',       typeof openBotForVip       !== 'undefined' ? openBotForVip       : null);
  safeExport('openGate',            typeof openGate            !== 'undefined' ? openGate            : null);
  safeExport('closeGate',           typeof closeGate           !== 'undefined' ? closeGate           : null);

  /* 03.6 — Tier badge & support */
  safeExport('handleTierClick', typeof handleTierClick !== 'undefined' ? handleTierClick : null);
  safeExport('openSupport',     typeof openSupport     !== 'undefined' ? openSupport     : null);

  /* 03.7 — Account modal */
  safeExport('openAccountModal',  typeof openAccountModal  !== 'undefined' ? openAccountModal  : null);
  safeExport('closeAccountModal', typeof closeAccountModal !== 'undefined' ? closeAccountModal : null);
  safeExport('saveAccount',       typeof saveAccount       !== 'undefined' ? saveAccount       : null);

  /* 03.8 — Quota modal */
  safeExport('showQuotaModal', typeof showQuotaModal !== 'undefined' ? showQuotaModal : null);

})();

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — VERSION INFO
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
   SECTION 05 — DEBUG HELPERS
   ───────────────────────────────────────────────────────────── */
window.FAMZ.debug = {

  /* 05.1 — Clear all cache */
  clearCache: function () {
    try {
      localStorage.removeItem('famz_session');
      localStorage.removeItem('famz_usage');
      localStorage.removeItem('famz_stats');
      localStorage.removeItem('famz_analyzer_cache');
      localStorage.removeItem('famz_errors');
      localStorage.removeItem('famz_account');
      console.log('[FAMZ] All cache cleared');
      location.reload();
    } catch (e) {}
  },

  /* 05.2 — Clear error log */
  clearErrors: function () {
    try {
      localStorage.removeItem('famz_errors');
      console.log('[FAMZ] Errors cleared');
    } catch (e) {}
  },

  /* 05.3 — Show error log */
  showErrors: function () {
    try {
      const errs = JSON.parse(localStorage.getItem('famz_errors') || '[]');
      console.table(errs);
      return errs;
    } catch (e) {
      return [];
    }
  },

  /* 05.4 — Clear Service Worker */
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

  /* 05.5 — Dump current state (safe) */
  state: function () {
    return {
      session:     typeof sessionGet     === 'function' ? sessionGet()     : null,
      queue:       typeof queueGetState  === 'function' ? queueGetState()  : null,
      encoderMode: typeof getEncoderMode === 'function' ? getEncoderMode() : null,
      upscaleInfo: typeof getUpscaleInfo === 'function' ? getUpscaleInfo() : null,
      activeTool:  typeof getActiveTool  === 'function' ? getActiveTool()  : null
    };
  },

  /* 05.6 — Show exported functions */
  exported: function () {
    const keys = [
      'switchTool', 'openPicker',
      'onPickPatch', 'onPickEncode', 'onPickUpscale', 'onPickQueue', 'onPickAvatar',
      'runPatch', 'runEncode', 'runUpscale', 'runAnalyze', 'runQueue',
      'togglePatchPlay', 'togglePatchMute',
      'gateLogin', 'openBotForRegister', 'openBotForVip', 'openGate', 'closeGate',
      'handleTierClick', 'openSupport',
      'openAccountModal', 'closeAccountModal', 'saveAccount',
      'showQuotaModal'
    ];
    const result = {};
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = typeof window[keys[i]] === 'function' ? '✅' : '❌';
    }
    console.table(result);
    return result;
  }

};

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] main.js loaded · ready to boot');