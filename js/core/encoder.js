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
let _ffmpegLoading  = null;
let _mp4MuxerModule = null;
let _useWebCodecs   = null;

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
      codec:     'avc1.640028',
      width:     1920,
      height:    1080,
      bitrate:   5000000,
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
  opts       = opts       || {};
  onProgress = onProgress || function () {};
  onLog      = onLog      || function () {};

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
  const muxerMod = await loadMp4Muxer();
  const Muxer         = muxerMod.Muxer;
  const ArrayBufferTarget = muxerMod.ArrayBufferTarget;

  const crf       = parseInt(opts.crf || '18', 10);
  const framerate = opts.framerate || 30;

  onLog('Preparing source video...');

  /* STEP 1 — Load video element */
  const video = document.createElement('video');
  const objectUrl = URL.createObjectURL(file);

  video.src        = objectUrl;
  video.muted      = true;
  video.playsInline = true;
  video.preload    = 'auto';

  await new Promise(function (resolve, reject) {
    video.onloadedmetadata = resolve;
    video.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal baca metadata video'));
    };
    setTimeout(function () {
      reject(new Error('Timeout loading video metadata'));
    }, 15000);
  });

  const duration = video.duration;
  const srcW     = video.videoWidth;
  const srcH     = video.videoHeight;

  if (!duration || !srcW || !srcH) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Video metadata tidak lengkap');
  }

  onLog('Source: ' + srcW + '×' + srcH + ', ' + duration.toFixed(1) + 's');

  /* STEP 2 — Calculate output dimensions */
  const dims = fitDimensions(srcW, srcH, 1080, 1920);
  const outW = dims.width;
  const outH = dims.height;

  onLog('Output: ' + outW + '×' + outH);

  const bitrate = crfToBitrate(crf, outW, outH, framerate);
  onLog('Bitrate: ' + (bitrate / 1000000).toFixed(1) + ' Mbps');

  /* STEP 3 — Setup muxer */
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec:  'avc',
      width:  outW,
      height: outH
    },
    fastStart: 'in-memory'
  });

  /* STEP 4 — Setup encoder */
  let encoderError = null;
  const encoder = new VideoEncoder({
    output: function (chunk, meta) {
      try {
        muxer.addVideoChunk(chunk, meta);
      } catch (e) {
        encoderError = e;
      }
    },
    error: function (e) {
      encoderError = e;
    }
  });

  encoder.configure({
    codec:         'avc1.640028',
    width:         outW,
    height:        outH,
    bitrate:       bitrate,
    framerate:     framerate,
    latencyMode:   'quality',
    avc:           { format: 'avc' }
  });

  /* STEP 5 — Canvas for frame rendering */
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx    = canvas.getContext('2d', { alpha: false });

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  /* STEP 6 — Encode loop */
  const totalFrames = Math.ceil(duration * framerate);
  onLog('Total frames: ' + totalFrames);

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (encoderError) {
        throw new Error('Encoder error: ' + encoderError.message);
      }

      const time = i / framerate;

      await seekVideo(video, time);

      ctx.drawImage(video, 0, 0, outW, outH);

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(time * 1000000),
        duration:  Math.round(1000000 / framerate)
      });

      const keyFrame = (i % 60 === 0);
      encoder.encode(frame, { keyFrame: keyFrame });
      frame.close();

      /* Progress */
      if (i % 5 === 0) {
        const pct = (i / totalFrames) * 100;
        onProgress(pct, 'Encoding frame ' + i + '/' + totalFrames);
      }

      /* Backpressure */
      if (encoder.encodeQueueSize > 10) {
        await sleep(5);
      }
    }

    onProgress(95, 'Finalizing...');

    await encoder.flush();
    muxer.finalize();

  } finally {
    /* Cleanup selalu jalan, meski error */
    try { encoder.close(); } catch (e) {}
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
    URL.revokeObjectURL(objectUrl);
  }

  const buffer = muxer.target.buffer;
  onProgress(100, 'Done');

  return new Blob([buffer], { type: 'video/mp4' });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 05 — FFMPEG FALLBACK
   ───────────────────────────────────────────────────────────── */
async function encodeWithFFmpeg(file, opts, onProgress, onLog) {
  const ff = await loadFFmpeg();

  const crf    = opts.crf    || '18';
  const preset = opts.preset || 'medium';

  onLog('Writing input to WASM FS...');
  onProgress(5, 'Loading input');

  const inputData = new Uint8Array(await file.arrayBuffer());
  await ff.writeFile('input.mp4', inputData);

  onLog('Running FFmpeg: CRF ' + crf + ', preset ' + preset);

  let lastProgress = 0;
  function progressHandler(e) {
    if (e && e.progress) {
      const pct = Math.min(95, 10 + e.progress * 80);
      if (pct - lastProgress > 2) {
        lastProgress = pct;
        onProgress(pct, 'Encoding ' + Math.round(e.progress * 100) + '%');
      }
    }
  }

  ff.on('progress', progressHandler);

  try {
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
  } catch (err) {
    /* Cleanup kalau exec gagal */
    try { await ff.deleteFile('input.mp4'); } catch (e) {}
    throw new Error('FFmpeg exec failed: ' + err.message);
  } finally {
    /* Detach progress listener biar gak numpuk */
    try { ff.off && ff.off('progress', progressHandler); } catch (e) {}
  }

  onProgress(95, 'Reading output');

  const outputData = await ff.readFile('output.mp4');

  try { await ff.deleteFile('input.mp4');  } catch (e) {}
  try { await ff.deleteFile('output.mp4'); } catch (e) {}

  onProgress(100, 'Done');

  return new Blob([outputData.buffer], { type: 'video/mp4' });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 06 — FFMPEG LOADER
   ───────────────────────────────────────────────────────────── */
async function loadFFmpeg() {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_ffmpegLoading)  return _ffmpegLoading;

  _ffmpegLoading = (async function () {
    const FFmpegWASM = await loadScriptGlobal(
      'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js'
    );
    const FFmpegUtil = await loadScriptGlobal(
      'https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js'
    );

    if (!FFmpegWASM || !FFmpegWASM.FFmpeg) {
      throw new Error('FFmpeg WASM module gagal load');
    }
    if (!FFmpegUtil || !FFmpegUtil.toBlobURL) {
      throw new Error('FFmpeg Util module gagal load');
    }

    const ffmpeg = new FFmpegWASM.FFmpeg();

    const baseURL  = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const coreURL  = await FFmpegUtil.toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript');
    const wasmURL  = await FFmpegUtil.toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm');

    await ffmpeg.load({ coreURL: coreURL, wasmURL: wasmURL });

    _ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await _ffmpegLoading;
  } catch (err) {
    _ffmpegLoading = null;
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 07 — MP4 MUXER LOADER
   ───────────────────────────────────────────────────────────── */
async function loadMp4Muxer() {
  if (_mp4MuxerModule) return _mp4MuxerModule;

  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.4/+esm');
    _mp4MuxerModule = mod;
    return mod;
  } catch (err) {
    throw new Error('Gagal load mp4-muxer: ' + err.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   SECTION 08 — HELPERS
   ───────────────────────────────────────────────────────────── */

/* 08.1 — CRF to bitrate mapping */
function crfToBitrate(crf, width, height, framerate) {
  const pixels   = width * height * framerate;
  const bpp      = 0.15 - (crf - 16) * 0.01;
  const bppClamp = Math.max(0.03, Math.min(0.20, bpp));
  return Math.round(pixels * bppClamp);
}

/* 08.2 — Fit dimensions (keep aspect, round to even) */
function fitDimensions(srcW, srcH, maxW, maxH) {
  const ratio = Math.min(maxW / srcW, maxH / srcH, 1);
  return {
    width:  Math.round(srcW * ratio / 2) * 2,
    height: Math.round(srcH * ratio / 2) * 2
  };
}

/* 08.3 — Seek video with safety timeout */
function seekVideo(video, time) {
  return new Promise(function (resolve, reject) {
    const target = Math.min(time, video.duration - 0.001);

    /* Skip kalau udah di posisi target */
    if (Math.abs(video.currentTime - target) < 0.01) {
      return resolve();
    }

    let resolved = false;

    function onSeek() {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', onSeek);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
      resolve();
    }

    function onError() {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', onSeek);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
      reject(new Error('Video seek error'));
    }

    /* Safety timeout — 5 detik */
    const timer = setTimeout(function () {
      if (resolved) return;
      resolved = true;
      video.removeEventListener('seeked', onSeek);
      video.removeEventListener('error', onError);
      reject(new Error('Seek timeout at ' + target.toFixed(2) + 's'));
    }, 5000);

    video.addEventListener('seeked', onSeek);
    video.addEventListener('error', onError);
    video.currentTime = target;
  });
}

/* 08.4 — Sleep helper */
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

/* 08.5 — Load external script (global, non-module) */
function loadScriptGlobal(url) {
  return new Promise(function (resolve, reject) {
    const existing = document.querySelector('script[src="' + url + '"]');
    if (existing) {
      if (existing.dataset.loaded) return resolve(window);
      existing.addEventListener('load',  function () { resolve(window); });
      existing.addEventListener('error', function () { reject(new Error('Failed: ' + url)); });
      return;
    }

    const s = document.createElement('script');
    s.src    = url;
    s.async  = true;
    s.onload = function () {
      s.dataset.loaded = 'true';
      resolve(window);
    };
    s.onerror = function () {
      reject(new Error('Failed to load: ' + url));
    };
    document.head.appendChild(s);
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTION 09 — EXPORT
   ───────────────────────────────────────────────────────────── */
console.log('[FAMZ] encoder.js loaded');