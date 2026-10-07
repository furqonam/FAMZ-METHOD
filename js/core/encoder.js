/* ═══════════════════════════════════════════════════════════════
   𝙁𝘼𝙈𝙕 𝙈𝙀𝙏𝙃𝙊𝘿 𝘃𝟭.𝟬
   js/core/encoder.js
   Video Encoder — WebCodecs (primary) + FFmpeg.wasm (fallback)
   © 2026 𝙁𝘼𝙈𝙕 // 𝙫𝙪𝙧𝙠𝙤𝙣𝙣𝙣
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   SECTION 01 — MODULE STATE
   ───────────────────────────────────────────────────────────── */
let _ffmpegInstance = null;
let _ffmpegLoading = null;
let _useWebCodecs = null;

/* ─────────────────────────────────────────────────────────────
   SECTION 02 — CAPABILITY DETECTION
   ───────────────────────────────────────────────────────────── */
async function detectEncoderSupport() {
  if (_useWebCodecs !== null) return _useWebCodecs;

  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    _useWebCodecs = false;
    return false;
  }

  try {
    const config = {
      codec: 'avc1.640028',
      width: 1920,
      height: 1080,
      bitrate: 5000000,
      framerate: 30
    };
    const support = await VideoEncoder.isConfigSupported(config);
    _useWebCodecs = support.supported === true;
  } catch (e) {
    _useWebCodecs = false;
  }

  return _useWebCodecs;
}

function getEncoderMode() {
  return _useWebCodecs ? 'webcodecs' : 'ffmpeg';
}

/* ─────────────────────────────────────────────────────────────
   SECTION 03 — MAIN ENCODE FUNCTION
   ───────────────────────────────────────────────────────────── */
async function encodeVideo(file, opts, onProgress, onLog) {
  opts = opts || {};
  onProgress = onProgress || function () {};
  onLog = onLog || function () {};

  const support = await detectEncoderSupport();

  if (support) {
    try {
      onLog('WebCodecs detected — using hardware acceleration');
      return await encodeWithWebCodecs(file, opts, onProgress, onLog);
    } catch (err) {
      onLog('WebCodecs failed: ' + err.message, 'error');
      onLog('Falling back to FFmpeg.wasm');
      return await encodeWithFFmpeg(file, opts, onProgress, onLog);
    }
  }

  onLog('WebCodecs not supported — using FFmpeg.wasm');
  return await encodeWithFFmpeg(file, opts, onProgress, onLog);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 04 — WEBCODECS ENCODER
   ───────────────────────────────────────────────────────────── */
async function encodeWithWebCodecs(file, opts, onProgress, onLog) {
  const { Muxer, ArrayBufferTarget } = await loadMp4Muxer();

  const crf = parseInt(opts.crf || '18', 10);
  const width = opts.width || 1080;
  const height = opts.height || 1920;
  const framerate = opts.framerate || 30;
  const bitrate = crfToBitrate(crf, width, height, framerate);

  onLog('Target: ' + width + '×' + height + ' @ ' + framerate + 'fps');
  onLog('Bitrate: ' + (bitrate / 1000000).toFixed(1) + ' Mbps');

  // Decode source video
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  await new Promise(function (resolve, reject) {
    video.onloadedmetadata = resolve;
    video.onerror = function () { reject(new Error('Gagal baca video')); };
  });

  const duration = video.duration;
  const totalFrames = Math.ceil(duration * framerate);
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;

  onLog('Source: ' + srcW + '×' + srcH + ', ' + duration.toFixed(1) + 's');

  // Calculate target resolution (keep aspect, max 1080×1920)
  const dims = fitDimensions(srcW, srcH, 1080, 1920);
  const outW = dims.width;
  const outH = dims.height;

  onLog('Output: ' + outW + '×' + outH);

  // Setup muxer
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: outW,
      height: outH
    },
    fastStart: 'in-memory'
  });

  // Setup encoder
  const encoder = new VideoEncoder({
    output: function (chunk, meta) {
      muxer.addVideoChunk(chunk, meta);
    },
    error: function (e) {
      throw new Error('Encoder error: ' + e.message);
    }
  });

  encoder.configure({
    codec: 'avc1.640028',
    width: outW,
    height: outH,
    bitrate: bitrate,
    framerate: framerate,
    latencyMode: 'quality',
    avc: { format: 'avc' }
  });

  // Canvas for frame rendering
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Seek through video and encode each frame
  for (let i = 0; i < totalFrames; i++) {
    const time = i / framerate;

    await seekVideo(video, time);

    ctx.drawImage(video, 0, 0, outW, outH);

    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(time * 1000000),
      duration: Math.round(1000000 / framerate)
    });

    const keyFrame = i % 60 === 0;
    encoder.encode(frame, { keyFrame: keyFrame });
    frame.close();

    // Report progress
    if (i % 5 === 0) {
      const pct = (i / totalFrames) * 100;
      onProgress(pct, 'Encoding frame ' + i + '/' + totalFrames);
    }

    // Backpressure: wait if queue too big
    if (encoder.encodeQueueSize > 10) {
      await new Promise(function (r) { setTimeout(r, 5); });
    }
  }

  onProgress(95, 'Finalizing...');

  await encoder.flush();
  muxer.finalize();

  video.src = '';
  URL.revokeObjectURL(video.src);

  const buffer = muxer.target.buffer;
  onProgress(100, 'Done');

  return new Blob([buffer], { type: 'video/mp4' });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — FFMPEG FALLBACK
   ───────────────────────────────────────────────────────────── */
async function encodeWithFFmpeg(file, opts, onProgress, onLog) {
  const ff = await loadFFmpeg();

  const crf = opts.crf || '18';
  const preset = opts.preset || 'medium';

  onLog('Writing input to WASM FS...');
  onProgress(5, 'Loading input');

  const inputData = new Uint8Array(await file.arrayBuffer());
  await ff.writeFile('input.mp4', inputData);

  onLog('Running FFmpeg: CRF ' + crf + ', preset ' + preset);

  let lastProgress = 0;
  ff.on('progress', function (e) {
    if (e && e.progress) {
      const pct = Math.min(95, 10 + e.progress * 80);
      if (pct - lastProgress > 2) {
        lastProgress = pct;
        onProgress(pct, 'Encoding ' + Math.round(e.progress * 100) + '%');
      }
    }
  });

  await ff.exec([
    '-i', 'input.mp4',
    '-c:v', 'libx264',
    '-crf', String(crf),
    '-preset', preset,
    '-profile:v', 'high',
    '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'copy',
    'output.mp4'
  ]);

  onProgress(95, 'Reading output');

  const outputData = await ff.readFile('output.mp4');

  try { await ff.deleteFile('input.mp4'); } catch (e) {}
  try { await ff.deleteFile('output.mp4'); } catch (e) {}

  onProgress(100, 'Done');

  return new Blob([outputData.buffer], { type: 'video/mp4' });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — FFMPEG LOADER
   ───────────────────────────────────────────────────────────── */
async function loadFFmpeg() {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_ffmpegLoading) return _ffmpegLoading;

  _ffmpegLoading = (async function () {
    const FFmpegWASM = await loadScript(
      'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js'
    );
    const FFmpegUtil = await loadScript(
      'https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js'
    );

    const ffmpeg = new FFmpegWASM.FFmpeg();

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const coreURL = await FFmpegUtil.toBlobURL(
      baseURL + '/ffmpeg-core.js',
      'text/javascript'
    );
    const wasmURL = await FFmpegUtil.toBlobURL(
      baseURL + '/ffmpeg-core.wasm',
      'application/wasm'
    );

    await ffmpeg.load({ coreURL: coreURL, wasmURL: wasmURL });

    _ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return _ffmpegLoading;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — MP4 MUXER LOADER
   ───────────────────────────────────────────────────────────── */
let _mp4MuxerModule = null;

async function loadMp4Muxer() {
  if (_mp4MuxerModule) return _mp4MuxerModule;

  const mod = await loadScriptModule(
    'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.4/+esm'
  );
  _mp4MuxerModule = mod;
  return mod;
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — HELPERS
   ───────────────────────────────────────────────────────────── */
function crfToBitrate(crf, width, height, framerate) {
  // Empirical mapping: CRF 18 ≈ 0.1 bpp (bits per pixel)
  const pixels = width * height * framerate;
  const bpp = 0.15 - (crf - 16) * 0.01;
  const bppClamped = Math.max(0.03, Math.min(0.20, bpp));
  return Math.round(pixels * bppClamped);
}

function fitDimensions(srcW, srcH, maxW, maxH) {
  const ratio = Math.min(maxW / srcW, maxH / srcH, 1);
  return {
    width: Math.round(srcW * ratio / 2) * 2,
    height: Math.round(srcH * ratio / 2) * 2
  };
}

function seekVideo(video, time) {
  return new Promise(function (resolve) {
    function onSeek() {
      video.removeEventListener('seeked', onSeek);
      resolve();
    }
    video.addEventListener('seeked', onSeek);
    video.currentTime = Math.min(time, video.duration);
  });
}

function loadScript(url) {
  return new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = function () { resolve(window); };
    s.onerror = function () { reject(new Error('Failed to load: ' + url)); };
    document.head.appendChild(s);
  });
}

function loadScriptModule(url) {
  return import(url);
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] encoder.js loaded');