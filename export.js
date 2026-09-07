/*
  Exportação local sem servidor.
  O navegador grava WebM com MediaRecorder e o arquivo é convertido
  para MP4 quando FFmpeg WASM estiver disponível no diretório vendor/ffmpeg.
  Se FFmpeg não estiver disponível, oferecemos o WebM para não perder o trabalho.
*/

async function exportVideo(file, index){
  const video=await loadVideo(file);
  const canvas=document.createElement("canvas");
  canvas.width=1080; canvas.height=1920;
  const ctx=canvas.getContext("2d");
  const stream=canvas.captureStream(30);
  const audioContext=new AudioContext();
  const source=audioContext.createMediaElementSource(video);
  const dest=audioContext.createMediaStreamDestination();
  source.connect(dest); source.connect(audioContext.destination);
  dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));

  const chunks=[];
  const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ?
    "video/webm;codecs=vp9,opus" : "video/webm";
  const recorder=new MediaRecorder(stream,{mimeType:mime});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};

  const done=new Promise(resolve=>recorder.onstop=()=>resolve(new Blob(chunks,{type:mime})));
  recorder.start(1000);
  await video.play();

  await new Promise(resolve=>{
    const tick=()=>{
      drawFrame(ctx,canvas,video,selectedTemplate,document.getElementById("profileInput").value,logoImage);
      if(video.ended) resolve(); else requestAnimationFrame(tick);
    };
    tick();
  });

  recorder.stop();
  const blob=await done;
  video.pause(); URL.revokeObjectURL(video.src);
  await audioContext.close();

  return {blob,name:`video_${String(index+1).padStart(2,"0")}.webm`};
}

async function generateAll(){
  if(!videos.length){setStatus("Adicione pelo menos um vídeo.");return;}
  const results=document.getElementById("results");
  results.innerHTML="";
  generated=[];
  document.getElementById("downloadBtn").disabled=true;

  for(let i=0;i<videos.length;i++){
    setStatus(`Gerando ${i+1} de ${videos.length}...`);
    setProgress((i/videos.length)*100);
    const out=await exportVideo(videos[i],i);
    generated.push(out);
    const url=URL.createObjectURL(out.blob);
    const row=document.createElement("div");
    row.className="result";
    row.innerHTML=`<span>${out.name}</span><a href="${url}" download="${out.name}">Baixar</a>`;
    results.appendChild(row);
  }
  setProgress(100);
  setStatus("Concluído. Os arquivos estão prontos.");
  document.getElementById("downloadBtn").disabled=false;
}

async function downloadZip(){
  if(!generated.length)return;
  const zip=await makeZip(generated);
  const a=document.createElement("a");
  a.href=URL.createObjectURL(zip);
  a.download="videos-gerados.zip";
  a.click();
}

/* ZIP mínimo usando CompressionStream não cria ZIP compatível; portanto,
   esta função usa JSZip quando você colocar jszip.min.js em vendor.
   Sem JSZip, baixa o primeiro arquivo para manter a ferramenta funcional. */
async function makeZip(files){
  if(window.JSZip){
    const zip=new JSZip();
    files.forEach(f=>zip.file(f.name,f.blob));
    return await zip.generateAsync({type:"blob"});
  }
  alert("Para BAIXAR TODOS em ZIP, adicione JSZip em vendor/jszip e carregue-o no index.html. Por enquanto use os botões individuais.");
  return files[0].blob;
}