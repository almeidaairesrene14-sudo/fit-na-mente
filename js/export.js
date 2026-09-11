// CORRECAO MP4/H264 - substitua todo o conteudo deste arquivo
let ffmpegInstance=null, ffmpegLoading=null, lastFFmpegLog="";

function getFFmpegClass(){
  if(window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg==="function") return window.FFmpegWASM.FFmpeg;
  if(window.FFmpeg && typeof window.FFmpeg.FFmpeg==="function") return window.FFmpeg.FFmpeg;
  if(typeof window.FFmpeg==="function") return window.FFmpeg;
  throw new Error("FFmpeg.wasm nao foi carregado. Verifique o index.html e use Ctrl+F5.");
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
    const t=setTimeout(()=>{clean();bad(new Error("O video nao conseguiu carregar os metadados."));},15000);
    const clean=()=>{clearTimeout(t);video.removeEventListener("loadedmetadata",done);video.removeEventListener("error",fail);};
    const done=()=>{clean();ok();}, fail=()=>{clean();bad(new Error("O navegador nao conseguiu abrir o video."));};
    video.addEventListener("loadedmetadata",done);video.addEventListener("error",fail);
  });
}

function ended(video){
  if(video.ended) return Promise.resolve();
  return new Promise((ok,bad)=>{
    const ms=Math.max(120000,((video.duration||60)+30)*1000);
    const t=setTimeout(()=>{clean();bad(new Error("A reproducao demorou demais para terminar."));},ms);
    const clean=()=>{clearTimeout(t);video.removeEventListener("ended",done);video.removeEventListener("error",fail);};
    const done=()=>{clean();ok();}, fail=()=>{clean();bad(new Error("Erro durante a reproducao do video."));};
    video.addEventListener("ended",done);video.addEventListener("error",fail);
  });
}

async function exportVideo(file,index){
  const ff=await ensureFFmpeg();
  setStatus("Abrindo video "+(index+1)+"...");
  const video=await loadVideo(file);
  await metadata(video);
  if(!video.duration || !Number.isFinite(video.duration)) throw new Error("Duracao do video invalida.");

  const canvas=document.createElement("canvas"); canvas.width=1080;canvas.height=1920;
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx) throw new Error("Nao foi possivel criar o canvas.");
  const stream=canvas.captureStream(30);

  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(AC){
      const ac=new AC(), src=ac.createMediaElementSource(video), dst=ac.createMediaStreamDestination();
      src.connect(dst);src.connect(ac.destination);
      dst.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
      if(ac.state==="suspended") await ac.resume();
    }
  }catch(e){console.warn("Audio nao capturado:",e);}

  let mime="";
  for(const m of ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"])
    if(MediaRecorder.isTypeSupported(m)){mime=m;break;}
  if(!mime) throw new Error("Este navegador nao suporta gravacao WebM.");

  const chunks=[], rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000});
  rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
  const done=new Promise((ok,bad)=>{rec.onstop=()=>ok(new Blob(chunks,{type:mime}));rec.onerror=e=>bad(e.error||new Error("Erro no MediaRecorder."));});

  const draw=()=>{drawFrame(ctx,canvas,video,selectedTemplate,document.getElementById("profileInput").value,logoImage);if(!video.ended)requestAnimationFrame(draw);};
  draw();rec.start(250);
  try{await video.play();}catch(e){if(rec.state!=="inactive")rec.stop();throw new Error("O navegador bloqueou a reproducao. Clique na pagina e tente novamente.");}
  await ended(video);
  await new Promise(r=>setTimeout(r,300));
  if(rec.state!=="inactive")rec.stop();
  const webm=await done;
  if(!webm.size) throw new Error("O navegador gerou um WebM vazio.");
  video.pause();if(video.src&&video.src.startsWith("blob:"))URL.revokeObjectURL(video.src);

  setStatus("Convertendo video "+(index+1)+" para MP4/H.264...");
  const input="input_"+index+".webm", output="fitnamente_"+String(index+1).padStart(2,"0")+".mp4";
  try{await ff.deleteFile(input);}catch(e){} try{await ff.deleteFile(output);}catch(e){}
  await ff.writeFile(input,new Uint8Array(await webm.arrayBuffer()));
  await ff.exec(["-i",input,"-map","0:v:0","-map","0:a:0?","-c:v","libx264","-preset","veryfast","-crf","23","-pix_fmt","yuv420p","-r","30","-c:a","aac","-b:a","128k","-ar","48000","-movflags","+faststart","-shortest",output]);
  const data=await ff.readFile(output);
  if(!data||!data.length) throw new Error("FFmpeg nao criou o MP4. "+lastFFmpegLog);
  try{await ff.deleteFile(input);}catch(e){} try{await ff.deleteFile(output);}catch(e){}
  return {blob:new Blob([data.buffer],{type:"video/mp4"}),name:output};
}

async function generateAll(){
  if(!videos||!videos.length){setStatus("Adicione pelo menos um video.");return;}
  const results=document.getElementById("results"), gen=document.getElementById("generateBtn"), dl=document.getElementById("downloadBtn");
  results.innerHTML="";generated=[];gen.disabled=true;dl.disabled=true;
  try{
    setProgress(0);await ensureFFmpeg();
    for(let i=0;i<videos.length;i++){
      const out=await exportVideo(videos[i],i);generated.push(out);
      const url=URL.createObjectURL(out.blob), row=document.createElement("div");row.className="result";
      row.innerHTML=`<span>${out.name} <small>(MP4/H.264)</small></span><a href="${url}" download="${out.name}">Baixar</a>`;
      results.appendChild(row);setProgress(((i+1)/videos.length)*100);
    }
    setStatus("Concluido! MP4/H.264 pronto.");dl.disabled=false;
  }catch(e){
    console.error("ERRO:",e);const msg=e&&e.message?e.message:String(e);
    setStatus("Erro: "+msg);alert("A geracao parou.\n\n"+msg+"\n\nUltimo log FFmpeg:\n"+lastFFmpegLog);
  }finally{gen.disabled=false;}
}

async function downloadZip(){
  if(!generated||!generated.length)return;
  if(!window.JSZip){alert("JSZip nao carregou. Use Ctrl+F5.");return;}
  const zip=new JSZip();generated.forEach(f=>zip.file(f.name,f.blob));
  const blob=await zip.generateAsync({type:"blob",compression:"STORE"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="videos-fitnamente-mp4.zip";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("ZIP pronto.");
}
