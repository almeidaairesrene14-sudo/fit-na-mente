// CORRECAO MP4/H264 - substitua todo o conteudo deste arquivo
let ffmpegInstance=null, ffmpegLoading=null, lastFFmpegLog="";

function getFFmpegClass(){
  if(window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg==="function") return window.FFmpegWASM.FFmpeg;
  if(window.FFmpeg && typeof window.FFmpeg.FFmpeg==="function") return window.FFmpeg.FFmpeg;
  if(typeof window.FFmpeg==="function") return window.FFmpeg;
  throw new Error("FFmpeg.wasm não foi carregado. Verifique o index.html e use Ctrl+F5.");
}

async function blobURL(url,type){
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) throw new Error("Falha ao baixar FFmpeg: HTTP "+r.status);
  return URL.createObjectURL(new Blob([await r.arrayBuffer()],{type}));
}

async function ensureFFmpeg(){
  if(ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if(ffmpegLoading) return ffmpegLoading;
  ffmpegLoading=(async()=>{
    setStatus("Carregando FFmpeg... primeira vez demora um pouco.");
    const ff=new (getFFmpegClass())();
    ff.on("log",({message})=>{lastFFmpegLog=message||"";console.log("[FFmpeg]",message);});
    ff.on("progress",({progress})=>setStatus("Convertendo para MP4/H.264... "+Math.round((progress||0)*100)+"%"));
    const base="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
    const core=await blobURL(base+"/ffmpeg-core.js","text/javascript");
    const wasm=await blobURL(base+"/ffmpeg-core.wasm","application/wasm");
    try{await ff.load({coreURL:core,wasmURL:wasm});}
    finally{URL.revokeObjectURL(core);URL.revokeObjectURL(wasm);}
    ffmpegInstance=ff;
    return ff;
  })();
  try{return await ffmpegLoading;}finally{ffmpegLoading=null;}
}

function metadata(video){
  if(video.readyState>=1 && Number.isFinite(video.duration)) return Promise.resolve();
  return new Promise((ok,bad)=>{
    const t=setTimeout(()=>{clean();bad(new Error("O vídeo não conseguiu
