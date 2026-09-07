let generated=[];

function setStatus(t){document.getElementById("status").textContent=t}
function setProgress(v){document.getElementById("progress").value=v}

function renderTemplates(){
  const box=document.getElementById("templateList");
  box.innerHTML="";
  TEMPLATES.forEach(t=>{
    const el=document.createElement("div");
    el.className="template"+(t.id===selectedTemplate.id?" active":"");
    el.innerHTML=`<div class="template-preview"></div><small>${t.name}</small>`;
    el.onclick=()=>{selectedTemplate=t;renderTemplates();preview()};
    box.appendChild(el);
  });
}

document.getElementById("videoInput").addEventListener("change",e=>{
  videos=[...e.target.files];
  document.getElementById("videoCount").textContent=
    videos.length ? `${videos.length} vídeo(s) selecionado(s).` : "Nenhum vídeo selecionado.";
  preview();
});

document.getElementById("profileInput").addEventListener("input",preview);

document.getElementById("logoInput").addEventListener("change",e=>{
  const file=e.target.files[0];
  if(!file){logoImage=null;preview();return}
  const img=new Image();
  img.onload=()=>{logoImage=img;preview()};
  img.src=URL.createObjectURL(file);
});

document.getElementById("generateBtn").onclick=generateAll;
document.getElementById("downloadBtn").onclick=downloadZip;

renderTemplates();
preview();