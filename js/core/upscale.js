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
  modelPath: 'https://cdn.jsdelivr.net/gh/vurkonnn/famz-assets@main/models/realesrgan-x2.onnx',
  modelFallback: 'https://huggingface.co/vurkonnn/famz-models/resolve/main/realesrgan-x2.onnx',
  maxInputSize: 1024,
  scale: 2,
  tileSize: 256,
  useTiling: true
};

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — MODULE STATE
   ───────────────────────────────────────────────────────────── */
let _ortInstance = null;
let _session = null;
let _sessionLoading = null;
let _useWebGPU = false;
let _currentProvider = 'wasm';

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — ONNX LOADER
   ───────────────────────────────────────────────────────────── */
async function loadONNX() {
  if (_ortInstance) return _ortInstance;
  if (_sessionLoading) return _sessionLoading;

  _sessionLoading = (async function () {
    // Load ONNX Runtime
    await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js');

    const ort = window.ort;
    if (!ort) throw new Error('ONNX Runtime gagal load');

    // Configure
    ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 4);
    ort.env.wasm.simd = true;
    ort.env.wasm.proxy = false;
    ort.env.logLevel = 'error';

    // Try WebGPU provider first
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
  })();

  return _sessionLoading;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — SESSION LOADER
   ───────────────────────────────────────────────────────────── */
async function loadSession(onLog) {
  if (_session) return _session;

  const ort = await loadONNX();

  const providers = _useWebGPU
    ? ['webgpu', 'wasm']
    : ['wasm'];

  onLog('Loading model...');
  onLog('Provider: ' + providers.join(' → '));

  try {
    _session = await ort.InferenceSession.create(UPSCALE_CONFIG.modelPath, {
      executionProviders: providers,
      graphOptimizationLevel: 'all'
    });

    _currentProvider = _useWebGPU ? 'webgpu' : 'wasm';
    onLog('Session ready: ' + _currentProvider);

    return _session;
  } catch (err) {
    onLog('Primary model failed, trying fallback...', 'error');

    _session = await ort.InferenceSession.create(UPSCALE_CONFIG.modelFallback, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });

    _currentProvider = 'wasm';
    onLog('Fallback session ready');

    return _session;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — MAIN UPSCALE FUNCTION
   ───────────────────────────────────────────────────────────── */
async function upscaleImage(file, onProgress, onLog) {
  onProgress = onProgress || function () {};
  onLog = onLog || function () {};

  const t0 = performance.now();

  /* STEP 1 — Load image */
  onProgress(5, 'Loading image');
  onLog('Reading ' + file.name);

  const img = await loadImage(file);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  onLog('Source: ' + srcW + '×' + srcH);

  /* STEP 2 — Prepare input (resize if too large) */
  const maxSize = UPSCALE_CONFIG.maxInputSize;
  let inputW = srcW;
  let inputH = srcH;

  if (inputW > maxSize || inputH > maxSize) {
    const ratio = Math.min(maxSize / inputW, maxSize / inputH);
    inputW = Math.floor(inputW * ratio / 4) * 4;
    inputH = Math.floor(inputH * ratio / 4) * 4;
    onLog('Resized input: ' + inputW + '×' + inputH);
  }

  /* STEP 3 — Load model */
  onProgress(15, 'Loading AI model');
  const session = await loadSession(onLog);

  /* STEP 4 — Convert to tensor */
  onProgress(25, 'Preparing tensor');
  const canvas = document.createElement('canvas');
  canvas.width = inputW;
  canvas.height = inputH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, inputW, inputH);

  const imageData = ctx.getImageData(0, 0, inputW, inputH);
  const inputTensor = imageToTensor(imageData, inputW, inputH);

  /* STEP 5 — Run inference */
  onProgress(40, 'Running AI inference');
  onLog('Input tensor: ' + inputW + '×' + inputH);

  const feeds = {};
  feeds[session.inputNames[0]] = inputTensor;

  const output = await session.run(feeds);
  const outputTensor = output[session.outputNames[0]];

  onProgress(75, 'Processing output');

  /* STEP 6 — Convert tensor back to image */
  const dims = outputTensor.dims;
  let outH, outW, isNCHW;

  if (dims[1] === 3) {
    isNCHW = true;
    outH = dims[2];
    outW = dims[3];
  } else {
    isNCHW = false;
    outH = dims[1];
    outW = dims[2];
  }

  onLog('Output: ' + outW + '×' + outH);

  const outCanvas = tensorToCanvas(outputTensor.data, outW, outH, isNCHW);

  /* STEP 7 — Encode to PNG */
  onProgress(90, 'Encoding PNG');

  const blob = await new Promise(function (resolve) {
    outCanvas.toBlob(resolve, 'image/png', 1.0);
  });

  onProgress(100, 'Done');

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  onLog('Complete in ' + elapsed + 's', 'done');

  return {
    blob: blob,
    width: outW,
    height: outH,
    elapsed: parseFloat(elapsed),
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

    img.src = url;
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — IMAGE → TENSOR
   ───────────────────────────────────────────────────────────── */
function imageToTensor(imageData, width, height) {
  const data = imageData.data;
  const pixels = width * height;

  const floatData = new Float32Array(3 * pixels);

  for (let i = 0; i < pixels; i++) {
    floatData[i]              = data[i * 4]     / 255.0;  // R
    floatData[pixels + i]     = data[i * 4 + 1] / 255.0;  // G
    floatData[2 * pixels + i] = data[i * 4 + 2] / 255.0;  // B
  }

  return new window.ort.Tensor('float32', floatData, [1, 3, height, width]);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — TENSOR → CANVAS
   ───────────────────────────────────────────────────────────── */
function tensorToCanvas(data, width, height, isNCHW) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const out = imgData.data;
  const pixels = width * height;

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
function clamp255(v) {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return Math.round(v);
}

function loadScript(url) {
  return new Promise(function (resolve, reject) {
    // Skip if already loaded
    const existing = document.querySelector('script[src="' + url + '"]');
    if (existing) {
      if (existing.dataset.loaded) return resolve();
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }

    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = function () {
      s.dataset.loaded = 'true';
      resolve();
    };
    s.onerror = function () {
      reject(new Error('Failed to load: ' + url));
    };
    document.head.appendChild(s);
  });
}

function getUpscaleInfo() {
  return {
    provider: _currentProvider,
    webgpuSupported: _useWebGPU,
    modelLoaded: _session !== null
  };
}

/* ─────────────────────────────────────────────────────────────
   SECTION 10 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] upscale.js loaded');