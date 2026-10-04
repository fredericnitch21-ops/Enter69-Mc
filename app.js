const $=s=>document.querySelector(s);
let songs=[],admin=false,pending=null,previewing=false,serverSkew=0;
const codes={};
const placeholder='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#202027"/><text x="200" y="230" text-anchor="middle" font-size="100" fill="#d6ff3f">♫</text><text x="200" y="285" text-anchor="middle" font-size="30" fill="#aaa">ENTER</text></svg>');
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function api(path,opt={}){
  const o={method:opt.method||"GET",credentials:"same-origin",headers:{"X-Requested-With":"enter"}};
  if(opt.json){o.headers["Content-Type"]="application/json";o.body=JSON.stringify(opt.json)}
  let r;try{r=await fetch(path,o)}catch{throw Object.assign(new Error("Sem ligação. Verifica a internet e tenta de novo."),{status:0})}
  let d=null;try{d=await r.json()}catch{}
  if(!r.ok)throw Object.assign(new Error((d&&d.message)||"Algo correu mal. Tenta de novo."),{status:r.status,code:d&&d.error});
  return d;
}
function left(ms){
  if(ms<=0)return"a expirar";
  const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.max(1,Math.floor(ms%36e5/6e4));
  return d?`${d}d ${h}h`:h?`${h}h`:`${m}min`;
}
function updateAdminUI(){$("#logoutBtn").classList.toggle("hidden",!admin)}

async function load(){
  try{const d=await api("/api/songs");songs=d.songs;admin=d.admin;serverSkew=d.now-Date.now();updateAdminUI();render()}catch(e){}
}
function render(){
  const q=$("#search").value.toLowerCase().trim(),cat=$("#filter").value,keep=cat;
  const list=songs.filter(s=>(!q||`${s.title} ${s.artist} ${s.category}`.toLowerCase().includes(q))&&(cat==="all"||s.category===cat));
  $("#songs").innerHTML="";$("#empty").hidden=!!list.length;
  for(const s of list){
    const c=document.createElement("article");c.className="card";
    const cover=s.hasCover?`/api/songs/${s.id}/cover`:placeholder;
    c.innerHTML=`<img class="cover" src="${cover}" alt="Capa de ${esc(s.title)}" loading="lazy"><div class="cardbody"><div class="title">${esc(s.title)}</div><div class="artist">${esc(s.artist)} · ${esc(s.category)}</div><div class="meta">Expira em ${left(s.expiresAt-(Date.now()+serverSkew))}</div><div class="actions"><button class="play${s.previewUsed&&!admin?" locked":""}">${s.previewUsed&&!admin?"🔒 Ouvir":"▶ Ouvir 30s"}</button><button class="download">↓ Baixar</button></div>${admin?'<button class="del">Eliminar</button>':""}</div>`;
    c.querySelector(".play").onclick=()=>onListen(s);
    c.querySelector(".download").onclick=()=>access(s,"download");
    const del=c.querySelector(".del");if(del)del.onclick=()=>onDelete(s);
    $("#songs").append(c);
  }
  const cats=[...new Set(songs.map(s=>s.category).filter(Boolean))];
  $("#filter").innerHTML='<option value="all">Todas as categorias</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  $("#filter").value=cats.includes(keep)?keep:"all";
}

function startPlayer(s,url,isPreview){
  previewing=isPreview;
  $("#playerCover").src=s.hasCover?`/api/songs/${s.id}/cover`:placeholder;
  $("#playerTitle").textContent=s.title;
  $("#playerArtist").textContent=isPreview?`${s.artist} · prévia 30s`:s.artist;
  $("#audio").src=url;$("#player").classList.remove("hidden");
  $("#audio").play().catch(()=>{});
}
$("#audio").addEventListener("ended",()=>{if(previewing){$("#playerArtist").textContent="Prévia terminada · usa o código"}});

async function onListen(s){
  if(admin||codes[s.id])return access(s,"play");
  if(s.previewUsed)return openCode(s,"play");
  try{
    const d=await api(`/api/songs/${s.id}/preview`,{method:"POST"});
    s.previewUsed=true;render();startPlayer(s,d.url,true);
  }catch(e){
    if(e.code==="preview_used"){s.previewUsed=true;render();openCode(s,"play")}
    else if(e.status===404){alert("Esta música já não está disponível.");load()}
    else alert(e.message);
  }
}
async function access(s,mode){
  if(admin||codes[s.id]){
    try{return done(s,mode,await api(`/api/songs/${s.id}/unlock`,{method:"POST",json:{code:codes[s.id]||""}}))}
    catch(e){
      if(e.status===404){alert("Esta música já não está disponível.");return load()}
      if(admin||e.status===429){return alert(e.message)}
      delete codes[s.id];
    }
  }
  openCode(s,mode);
}
function done(s,mode,d){
  if(mode==="download"){const a=document.createElement("a");a.href=d.download;a.download="";document.body.append(a);a.click();a.remove()}
  else startPlayer(s,d.stream,false);
}
function openCode(s,mode){
  pending={s,mode};
  $("#pinText").textContent=mode==="download"?"Introduz o código definido por quem adicionou esta música para a baixar.":"Já ouviste a prévia de 30 segundos. Introduz o código para ouvir completa.";
  $("#pinBtn").textContent=mode==="download"?"Desbloquear e baixar":"Desbloquear e ouvir";
  $("#pinModal").classList.remove("hidden");$("#pinEntry").value="";$("#pinStatus").textContent="";$("#pinEntry").focus();
}
$("#pinForm").onsubmit=async e=>{
  e.preventDefault();if(!pending)return;
  const {s,mode}=pending,code=$("#pinEntry").value,btn=$("#pinBtn");
  btn.disabled=true;$("#pinStatus").textContent="";
  try{
    const d=await api(`/api/songs/${s.id}/unlock`,{method:"POST",json:{code}});
    codes[s.id]=code;pending=null;$("#pinModal").classList.add("hidden");done(s,mode,d);
  }catch(err){$("#pinStatus").textContent=err.message;if(err.status===404)load()}
  finally{btn.disabled=false}
};

async function onDelete(s){
  if(!confirm(`Eliminar "${s.title}"? Esta ação não pode ser desfeita.`))return;
  try{await api(`/api/songs/${s.id}`,{method:"DELETE"});delete codes[s.id];await load()}
  catch(e){if(e.status===401){admin=false;updateAdminUI();render()}alert(e.message)}
}

/* ---- add (login + upload) ---- */
$("#adminBtn").onclick=()=>{
  if(admin){$("#modal").classList.remove("hidden")}
  else{$("#loginModal").classList.remove("hidden");$("#loginStatus").textContent="";$("#loginName").focus()}
};
$("#logoutBtn").onclick=async()=>{try{await api("/api/logout",{method:"POST"})}catch{}admin=false;updateAdminUI();render()};
$("#loginClose").onclick=()=>$("#loginModal").classList.add("hidden");
$("#loginForm").onsubmit=async e=>{
  e.preventDefault();const b=$("#loginForm button.primary");b.disabled=true;$("#loginStatus").textContent="";
  try{
    await api("/api/login",{method:"POST",json:{name:$("#loginName").value}});$("#loginModal").classList.add("hidden");admin=true;updateAdminUI();await load();$("#modal").classList.remove("hidden");
  }catch(err){$("#loginStatus").textContent=err.message}
  finally{b.disabled=false}
};
$("#close").onclick=()=>$("#modal").classList.add("hidden");
$("#pinClose").onclick=()=>$("#pinModal").classList.add("hidden");
$("#stop").onclick=()=>{$("#audio").pause();$("#audio").removeAttribute("src");$("#audio").load();$("#player").classList.add("hidden")};
$("#search").oninput=render;$("#filter").onchange=render;

async function prepCover(file){
  if(!file)return new Blob([]);
  const LIMIT=140*1024;
  try{
    const bmp=await createImageBitmap(file);
    for(const [max,q] of [[600,.82],[500,.7],[400,.6],[320,.5]]){
      const sc=Math.min(1,max/Math.max(bmp.width,bmp.height)),c=document.createElement("canvas");
      c.width=Math.max(1,Math.round(bmp.width*sc));c.height=Math.max(1,Math.round(bmp.height*sc));
      c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
      const b=await new Promise(r=>c.toBlob(r,"image/jpeg",q));
      if(b&&b.size<=LIMIT)return b;
    }
  }catch{}
  throw new Error("Não foi possível preparar a capa. Tenta outra imagem.");
}
function u32(n){const b=new ArrayBuffer(4);new DataView(b).setUint32(0,n);return b}
$("#songForm").onsubmit=async e=>{
  e.preventDefault();
  const af=$("#audioFile").files[0],cf=$("#coverFile").files[0],st=$("#status"),btn=$("#saveBtn");
  if(!af)return;
  if(af.size>15*1024*1024){st.textContent="O MP3 é demasiado grande (máx. 15 MB).";return}
  btn.disabled=true;st.textContent="A preparar…";
  try{
    const cover=await prepCover(cf);
    const meta=new TextEncoder().encode(JSON.stringify({title:$("#title").value,artist:$("#artist").value,category:$("#category").value,code:$("#pin").value}));
    const body=new Blob([u32(meta.length),meta,u32(cover.size),cover,af]);
    await new Promise((resolve,reject)=>{
      const x=new XMLHttpRequest();x.open("POST","/api/songs");
      x.setRequestHeader("X-Requested-With","enter");x.setRequestHeader("Content-Type","application/octet-stream");
      x.upload.onprogress=ev=>{if(ev.lengthComputable)st.textContent=`A enviar… ${Math.round(ev.loaded/ev.total*100)}%`};
      x.onerror=()=>reject(new Error("Sem ligação. Tenta de novo."));
      x.onload=()=>{let d={};try{d=JSON.parse(x.responseText)}catch{}
        if(x.status>=200&&x.status<300)resolve();
        else{if(x.status===401){admin=false;updateAdminUI()}reject(new Error(d.message||"Não foi possível publicar."))}};
      x.send(body);
    });
    $("#songForm").reset();$("#modal").classList.add("hidden");st.textContent="";
    await load();alert("Música publicada! Fica online durante 7 dias.");
  }catch(err){st.textContent=err.message}
  finally{btn.disabled=false}
};

(async()=>{
  if("serviceWorker" in navigator&&location.protocol!=="file:"){try{await navigator.serviceWorker.register("./sw.js")}catch(e){}}
  await load();
  setInterval(()=>{if(!document.hidden)load()},5*60*1000);
})();
