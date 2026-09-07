let selectedTemplate = TEMPLATES[0];
let videos = [];
let logoImage = null;

function drawFrame(ctx, canvas, video, template, profile, logo) {
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const vw=video.videoWidth||w, vh=video.videoHeight||h;
  const scale=Math.max(w/vw,h/vh);
  const dw=vw*scale, dh=vh*scale;
  ctx.drawImage(video,(w-dw)/2,(h-dh)/2,dw,dh);

  ctx.fillStyle=template.top; ctx.fillRect(0,0,w,130);
  ctx.fillStyle=template.bottom; ctx.fillRect(0,h-150,w,150);

  if(template.border){
    ctx.strokeStyle="rgba(255,255,255,.35)";
    ctx.lineWidth=template.border;
    ctx.strokeRect(template.border/2,template.border/2,w-template.border,h-template.border);
  }

  ctx.fillStyle="#fff";
  ctx.font="700 30px Arial";
  ctx.textAlign="left";
  ctx.textBaseline="middle";
  ctx.shadowColor="rgba(0,0,0,.65)"; ctx.shadowBlur=8;
  ctx.fillText(profile,28,65);

  if(logo){
    const max=75, ratio=Math.min(max/logo.width,max/logo.height);
    ctx.drawImage(logo,w-28-logo.width*ratio,25,logo.width*ratio,logo.height*ratio);
  }

  ctx.shadowBlur=0;
}

async function loadVideo(file){
  const video=document.createElement("video");
  video.src=URL.createObjectURL(file);
  video.muted=true;
  video.playsInline=true;
  await new Promise((resolve,reject)=>{
    video.onloadedmetadata=resolve; video.onerror=reject;
  });
  return video;
}

async function preview(){
  const canvas=document.getElementById("previewCanvas");
  const ctx=canvas.getContext("2d");
  if(!videos.length){
    ctx.fillStyle="#101319";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#9aa1ad";ctx.font="20px Arial";ctx.textAlign="center";
    ctx.fillText("Adicione um vídeo",canvas.width/2,canvas.height/2);
    return;
  }
  const v=await loadVideo(videos[0]);
  v.currentTime=0;
  drawFrame(ctx,canvas,v,selectedTemplate,document.getElementById("profileInput").value,logoImage);
  URL.revokeObjectURL(v.src);
}