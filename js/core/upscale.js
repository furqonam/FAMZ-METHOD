/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/upscale.js
   AI Upscale — ONNX WebGPU (primary) + WASM (fallback)
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — CONFIG
   ───────────────────────────────────────────────────────────── */
const UPSCALE_CONFIG = {
  /* Model URLs — multi-fallback */
  modelPaths: [
    'https://cdn.jsdelivr.net/gh/vurkonnn/famz-assets@main/models/realesrgan-x2.onnx',
    'https://huggingface.co/vurkonnn/famz-models/resolve/main/realesrgan-x2.onnx',
    'https://huggingface.co/Xenova/realesrgan-x2/resolve/main/onnx/model.onnx'
  ],

  /* ONNX Runtime CDN */
  ortCDN: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js',

  /* Limits */
  maxInputSize: 1024,
  scale: 2,
  tileSize: 256,
  useTiling: true,

  /* Timeout untuk load model */
  modelTimeout: 60000
};

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — MODULE STATE
   ───────────────────────────────────────────────────────────── */
let _ortInstance   = null;
let _ortLoading    = null;
let _session       = null;
let _sessionLoading = null;
let _useWebGPU     = false;
let _currentProvider = 'wasm';
let _loadedModelPath = null;

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — ONNX LOADER (with race condition guard)
   ───────────────────────────────────────────────────────────── */
async function loadONNX() {
  /* Kalau udah loaded → return langsung */
  if (_ortInstance) return _ortInstance;

  /* Kalau lagi loading → tungguin yang lagi jalan */
  if (_ortLoading) return _ortLoading;

  _ortLoading = (async function () {
    try {
      await loadScriptGlobal(UPSCALE_CONFIG.ortCDN);

      const ort = window.ort;
      if (!ort) throw new Error('ONNX Runtime gagal load');

      /* Configure */
      ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 4);
      ort.env.wasm.simd       = true;
      ort.env.wasm.proxy      = false;
      ort.env.logLevel        = 'error';

      /* Try WebGPU */
      try {
        if (navigator.gpu) {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            _useWebGPU = true;
          }
        }
      } catch (e) {
        _useWebGPU = false;
      }

      _ortInstance = ort;
      return ort;

    } catch (err) {
      /* Reset biar bisa retry */
      _ortLoading = null;
      throw err;
    }
  })();

  return _ortLoading;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — SESSION LOADER (multi model fallback)
   ───────────────────────────────────────────────────────────── */
async function loadSession(onLog) {
  if (_session) return _session;

  /* Kalau udah loading, warn kalau onLog beda */
  if (_sessionLoading) {
    if (_sessionLoading.__onLog && onLog && _sessionLoading.__onLog !== onLog) {
      console.warn('[FAMZ] loadSession: multiple onLog detected, using first one');
    }
    return _sessionLoading;
  }

  _sessionLoading = (async function () {
    const ort = await loadONNX();
    // ... (rest same)

    const providers = _useWebGPU
      ? ['webgpu', 'wasm']
      : ['wasm'];

    onLog('Loading model...');
    onLog('Provider: ' + providers.join(' → '));

    let lastError = null;

    /* Coba tiap model path */
    for (let i = 0; i < UPSCALE_CONFIG.modelPaths.length; i++) {
      const modelPath = UPSCALE_CONFIG.modelPaths[i];

      try {
        onLog('Attempt ' + (i + 1) + '/' + UPSCALE_CONFIG.modelPaths.length + ': ' + shortenUrl(modelPath));

        const sessionPromise = ort.InferenceSession.create(modelPath, {
          executionProviders: providers,
          graphOptimizationLevel: 'all'
        });

        /* Wrap dengan timeout */
        const session = await withTimeout(
          sessionPromise,
          UPSCALE_CONFIG.modelTimeout,
          'Model load timeout'
        );

        _session           = session;
        _currentProvider   = _useWebGPU ? 'webgpu' : 'wasm';
        _loadedModelPath   = modelPath;

        onLog('Session ready: ' + _currentProvider);
        return session;

      } catch (err) {
        lastError = err;
        onLog('Model ' + (i + 1) + ' failed: ' + err.message, 'error');
      }
    }

    /* Semua gagal */
    _sessionLoading = null;
    throw new Error('Semua model gagal load. Error terakhir: ' + (lastError ? lastError.message : 'unknown'));
  })();

  try {
    return await _sessionLoading;
  } catch (err) {
    _sessionLoading = null;
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — MAIN UPSCALE FUNCTION
   ───────────────────────────────────────────────────────────── */
async function upscaleImage(file, onProgress, onLog) {
  onProgress = onProgress || function () {};
  onLog      = onLog      || function () {};

  const t0 = performance.now();

  /* ─── STEP 1: Load image ─── */
  onProgress(5, 'Loading image');
  onLog('Reading ' + file.name);

  const img  = await loadImage(file);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  onLog('Source: ' + srcW + '×' + srcH);

  /* ─── STEP 2: Prepare input (resize kalau kebesaran) ─── */
  const maxSize = UPSCALE_CONFIG.maxInputSize;
  let inputW = srcW;
  let inputH = srcH;

  if (inputW > maxSize || inputH > maxSize) {
    const ratio = Math.min(maxSize / inputW, maxSize / inputH);
    inputW = Math.floor(inputW * ratio / 4) * 4;
    inputH = Math.floor(inputH * ratio / 4) * 4;
    onLog('Resized input: ' + inputW + '×' + inputH);
  }

  /* ─── STEP 3: Load model ─── */
  onProgress(15, 'Loading AI model');
  const session = await loadSession(onLog);

  /* ─── STEP 4: Convert ke tensor ─── */
  onProgress(25, 'Preparing tensor');
  const canvas = document.createElement('canvas');
  canvas.width  = inputW;
  canvas.height = inputH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, inputW, inputH);

  const imageData  = ctx.getImageData(0, 0, inputW, inputH);
  const inputTensor = imageToTensor(imageData, inputW, inputH);

  /* ─── STEP 5: Run inference ─── */
  onProgress(40, 'Running AI inference');
  onLog('Input tensor: ' + inputW + '×' + inputH);

  const feeds = {};
  feeds[session.inputNames[0]] = inputTensor;

  const output       = await session.run(feeds);
  const outputTensor = output[session.outputNames[0]];

  onProgress(75, 'Processing output');

  /* ─── STEP 6: Convert tensor back ke image ─── */
  const dims = outputTensor.dims;
  let outH, outW, isNCHW;

  if (dims[1] === 3) {
    isNCHW = true;
    outH   = dims[2];
    outW   = dims[3];
  } else {
    isNCHW = false;
    outH   = dims[1];
    outW   = dims[2];
  }

  onLog('Output: ' + outW + '×' + outH);

  const outCanvas = tensorToCanvas(outputTensor.data, outW, outH, isNCHW);

  /* ─── STEP 7: Encode ke PNG ─── */
  onProgress(90, 'Encoding PNG');

  const blob = await new Promise(function (resolve, reject) {
    outCanvas.toBlob(function (b) {
      if (b) resolve(b);
      else reject(new Error('Gagal encode PNG'));
    }, 'image/png', 1.0);
  });

  onProgress(100, 'Done');

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  onLog('Complete in ' + elapsed + 's', 'done');

  return {
    blob:     blob,
    width:    outW,
    height:   outH,
    elapsed:  parseFloat(elapsed),
    provider: _currentProvider
  };
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — IMAGE LOADER
   ───────────────────────────────────────────────────────────── */
function loadImage(file) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = function () {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal load image'));
    };

    /* Timeout safety */
    setTimeout(function () {
      URL.revokeObjectURL(url);
      reject(new Error('Image load timeout'));
    }, 15000);

    img.src = url;
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — IMAGE → TENSOR
   ───────────────────────────────────────────────────────────── */
function imageToTensor(imageData, width, height) {
  const data   = imageData.data;
  const pixels = width * height;

  const floatData = new Float32Array(3 * pixels);

  for (let i = 0; i < pixels; i++) {
    floatData[i]              = data[i * 4]     / 255.0;  /* R */
    floatData[pixels + i]     = data[i * 4 + 1] / 255.0;  /* G */
    floatData[2 * pixels + i] = data[i * 4 + 2] / 255.0;  /* B */
  }

  return new window.ort.Tensor('float32', floatData, [1, 3, height, width]);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — TENSOR → CANVAS
   ───────────────────────────────────────────────────────────── */
function tensorToCanvas(data, width, height, isNCHW) {
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;

  const ctx     = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const out     = imgData.data;
  const pixels  = width * height;

  for (let i = 0; i < pixels; i++) {
    let r, g, b;

    if (isNCHW) {
      r = data[i]              * 255;
      g = data[pixels + i]     * 255;
      b = data[2 * pixels + i] * 255;
    } else {
      r = data[i * 3]     * 255;
      g = data[i * 3 + 1] * 255;
      b = data[i * 3 + 2] * 255;
    }

    out[i * 4]     = clamp255(r);
    out[i * 4 + 1] = clamp255(g);
    out[i * 4 + 2] = clamp255(b);
    out[i * 4 + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — HELPERS
   ───────────────────────────────────────────────────────────── */

/* 09.1 — Clamp 0-255 */
function clamp255(v) {
  if (v < 0)   return 0;
  if (v > 255) return 255;
  return Math.round(v);
}

/* 09.2 — Timeout wrapper */
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error(message || 'Timeout'));
      }, ms);
    })
  ]);
}

/* 09.3 — Shorten URL for log */
function shortenUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return u.hostname + '/' + (parts[parts.length - 1] || '');
  } catch (e) {
    return url.slice(0, 50) + '...';
  }
}

/* 09.4 — Get upscale info */
function getUpscaleInfo() {
  return {
    provider:        _currentProvider,
    webgpuSupported: _useWebGPU,
    modelLoaded:     _session !== null,
    modelPath:       _loadedModelPath
  };
}

/* 09.5 — Reset session (debug only) */
function resetUpscaleSession() {
  try { _session && _session.release && _session.release(); } catch (e) {}
  _session          = null;
  _sessionLoading   = null;
  _loadedModelPath  = null;
  console.log('[FAMZ] Upscale session reset');
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] upscale.js loaded');