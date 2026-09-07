/*
 * Exportação MP4/H.264 + AAC com FFmpeg.wasm.
 * O vídeo é processado localmente no navegador.
 */

let ffmpegInstance = null;
let ffmpegLoading = null;

function getFFmpegClass() {
  if (window.FFmpeg && window.FFmpeg.FFmpeg) return window.FFmpeg.FFmpeg;
  if (typeof window.FFmpeg === "function") return window.FFmpeg;
  throw new Error("FFmpeg.wasm não foi carregado. Atualize a página e tente novamente.");
}

async function toBlobURL(url, mime) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar FFmpeg (HTTP ${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: mime }));
}

async function ensureFFmpeg() {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    setStatus("Carregando FFmpeg pela primeira vez (~31 MB)...");

    const FFmpegClass = getFFmpegClass();
    const ffmpeg = new FFmpegClass();

    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
    });

    ffmpeg.on("progress", ({ progress }) => {
      const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
      setStatus(`Convertendo para MP4... ${pct}%`);
    });

    const baseURL =
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

    const coreURL = await toBlobURL(
      `${baseURL}/ffmpeg-core.js`,
      "text/javascript"
    );

    const wasmURL = await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      "application/wasm"
    );

    try {
      await ffmpeg.load({ coreURL, wasmURL });
    } finally {
      URL.revokeObjectURL(coreURL);
      URL.revokeObjectURL(wasmURL);
    }

    ffmpegInstance = ffmpeg;
    setStatus("FFmpeg carregado. Pronto.");
    return ffmpeg;
  })();

  try {
    return await ffmpegLoading;
  } finally {
    ffmpegLoading = null;
  }
}

async function exportVideo(file, index) {
  const ffmpeg = await ensureFFmpeg();

  const video = await loadVideo(file);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = canvas.getContext("2d", { alpha: false });
  const stream = canvas.captureStream(30);

  let audioContext = null;

  // Tenta preservar o áudio original.
  try {
    audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();

    source.connect(destination);

    destination.stream.getAudioTracks().forEach(track => {
      stream.addTrack(track);
    });
  } catch (error) {
    console.warn("Áudio não pôde ser capturado:", error);
  }

  const chunks = [];

  const mime = MediaRecorder.isTypeSupported(
    "video/webm;codecs=vp9,opus"
  )
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8000000
  });

  recorder.ondataavailable = event => {
    if (event.data && event.data.size) {
      chunks.push(event.data);
    }
  };

  const recordingDone = new Promise(resolve => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mime }));
    };
  });

  recorder.start(1000);
  await video.play();

  await new Promise(resolve => {
    const render = () => {
      drawFrame(
        ctx,
        canvas,
        video,
        selectedTemplate,
        document.getElementById("profileInput").value,
        logoImage
      );

      if (video.ended) {
        resolve();
      } else {
        requestAnimationFrame(render);
      }
    };

    render();
  });

  recorder.stop();

  const webmBlob = await recordingDone;

  video.pause();
  URL.revokeObjectURL(video.src);

  if
