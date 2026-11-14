/* ============================================================
   Music — player de músicas local (suas próprias músicas)
   ============================================================ */
const APP_VERSION = '1.0.0';

// ---------- Estado ----------
const state = {
  route:'inicio',
  prevRoute:null,
  tracks:[],          // {id, name, artist, blob, url, dur}
  queue:[],
  queueIndex:0,
  currentTrack:null,
  isPlaying:false,
  shuffle:false,
  repeat:'off',
  appearance:'escuro',
};
let audio=null;
let progressTimer=null;

// ---------- Utils ----------
const $=(s,ctx=document)=>ctx.querySelector(s);
const $$=(s,ctx=document)=>[...ctx.querySelectorAll(s)];
function toast(msg,ms=2200){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),ms);}
function fmt(s){s=Math.floor(s||0);const m=Math.floor(s/60);const sec=s%60;return m+':'+(sec<10?'0':'')+sec;}
function uid(){return 't'+Date.now()+Math.random().toString(36).slice(2,7);}

// ---------- IndexedDB ----------
const DB_NAME='musiclib', DB_VER=2;
let db=null;
function openDB(){
  return new Promise((res,rej)=>{
    if(db){res(db);return;}
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=()=>{
      const d=r.result;
      if(!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks',{keyPath:'id'});
    };
    r.onsuccess=()=>{db=r.result;res(db);};
    r.onerror=()=>rej(r.error);
  });
}
async function saveTrack(t){const d=await openDB();return new Promise((res,rej)=>{const tx=d.transaction('tracks','readwrite');tx.objectStore('tracks').put(t);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
async function deleteTrack(id){const d=await openDB();return new Promise((res,rej)=>{const tx=d.transaction('tracks','readwrite');tx.objectStore('tracks').delete(id);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
async function loadTracks(){
  const d=await openDB();
  return new Promise((res,rej)=>{const tx=d.transaction('tracks','readonly');const q=tx.objectStore('tracks').getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});
}

// ---------- Áudio ----------
function initAudio(){
  audio=$('#audioEl');
  audio.addEventListener('timeupdate',onTimeUpdate);
  audio.addEventListener('ended',onEnded);
  audio.addEventListener('loadedmetadata',()=>{ if(state.currentTrack){ const dur=$('#progDur'); if(dur) dur.textContent=fmt(audio.duration||state.currentTrack.dur); state.currentTrack.dur=Math.floor(audio.duration||state.currentTrack.dur); }});
  audio.addEventListener('error',()=>toast('Erro ao tocar a música.'));
  if('mediaSession' in navigator){
    navigator.mediaSession.setActionHandler('play',()=>play());
    navigator.mediaSession.setActionHandler('pause',()=>pause());
    navigator.mediaSession.setActionHandler('previoustrack',()=>prev());
    navigator.mediaSession.setActionHandler('nexttrack',()=>next());
    navigator.mediaSession.setActionHandler('seekto',(e)=>{if(e.seekTime!=null)audio.currentTime=e.seekTime;});
  }
}
async function playTrack(id, queueOverride){
  const t=state.tracks.find(x=>x.id===id); if(!t) return;
  if(queueOverride) state.queue=queueOverride;
  const idx=state.queue.indexOf(id); if(idx>=0) state.queueIndex=idx;
  state.currentTrack=t;
  if(!t.url) t.url=URL.createObjectURL(t.blob);
  audio.src=t.url;
  audio.load();
  try{ await audio.play(); state.isPlaying=true;}catch(e){state.isPlaying=false;}
  updateMediaSession(t);
  renderMiniPlayer();
  renderPlayer();
  startProgress();
}
function play(){ if(!audio.src && state.currentTrack){ playTrack(state.currentTrack.id); return;} audio.play().catch(()=>{}); state.isPlaying=true; updatePlayBtns(); updateMediaSession(state.currentTrack);}
function pause(){ audio.pause(); state.isPlaying=false; updatePlayBtns(); if('mediaSession' in navigator) navigator.mediaSession.playbackState='paused';}
function togglePlay(){ state.isPlaying?pause():play();}
function next(){
  if(!state.queue.length) return;
  let i=state.queueIndex;
  if(state.shuffle){ i=Math.floor(Math.random()*state.queue.length);}
  else { i=(i+1)%state.queue.length; if(i===0 && state.repeat!=='all' && state.queueIndex===state.queue.length-1){ pause(); return;} }
  if(state.repeat==='one'){ playTrack(state.queue[state.queueIndex]); return;}
  state.queueIndex=i;
  playTrack(state.queue[i]);
}
function prev(){
  if(audio.currentTime>3){ audio.currentTime=0; return;}
  if(!state.queue.length) return;
  let i=state.queueIndex-1; if(i<0) i=state.queue.length-1;
  state.queueIndex=i;
  playTrack(state.queue[i]);
}
function onEnded(){
  if(state.repeat==='one'){ playTrack(state.queue[state.queueIndex]); return;}
  next();
}
function onTimeUpdate(){
  if(!audio.duration) return;
  const pct=(audio.currentTime/audio.duration)*100;
  const fill=$('#progFill'), thumb=$('#progThumb');
  if(fill) fill.style.width=pct+'%';
  if(thumb) thumb.style.left=pct+'%';
  const cur=$('#progCur'); if(cur) cur.textContent=fmt(audio.currentTime);
  const dur=$('#progDur'); if(dur) dur.textContent=fmt(audio.duration);
}
function startProgress(){ clearInterval(progressTimer); progressTimer=setInterval(()=>{ if(state.isPlaying) onTimeUpdate();},250);}
function updatePlayBtns(){
  const mp=$('#minipPlay'); if(mp) mp.innerHTML=state.isPlaying?'&#10074;&#10074;':'&#9654;';
  const pp=$('#pPlay'); if(pp) pp.innerHTML=state.isPlaying?'&#10074;&#10074;':'&#9654;';
}
function updateMediaSession(t){
  if(!('mediaSession' in navigator)||!t) return;
  navigator.mediaSession.metadata=new MediaMetadata({title:t.name,artist:t.artist||'Desconhecido',album:'Músicas locais',artwork:[{src:'logo.svg',sizes:'512x512',type:'image/svg+xml'}]});
  navigator.mediaSession.playbackState=state.isPlaying?'playing':'paused';
}
function renderMiniPlayer(){
  const t=state.currentTrack;
  const mp=$('#minip');
  if(!t){ mp.style.display='none'; return;}
  mp.style.display='flex';
  $('#minipTitle').textContent=t.name;
  $('#minipArtist').textContent=t.artist||'Desconhecido';
  updatePlayBtns();
}
function renderPlayer(){
  const t=state.currentTrack; if(!t) return;
  $('#playerTitle').textContent=t.name;
  $('#playerArtist').textContent=t.artist||'Desconhecido';
  $('#playerAlbum').textContent='Músicas locais';
  $('#progCur').textContent=fmt(audio.currentTime);
  $('#progDur').textContent=fmt(t.dur||0);
  $('#pShuffle').classList.toggle('active',state.shuffle);
  $('#pRepeat').classList.toggle('active',state.repeat!=='off');
  updatePlayBtns();
  renderQueue();
}
function renderQueue(){
  const el=$('#queueList'); if(!el) return;
  el.innerHTML=state.queue.map((id,i)=>{
    const t=state.tracks.find(x=>x.id===id); if(!t) return '';
    return `<div class="track ${i===state.queueIndex?'playing':''}" data-qplay="${id}">
      <div class="track-cover" style="background:linear-gradient(135deg,#a8c7fa,#3ea6ff)"></div>
      <div class="track-info"><div class="track-title">${t.name}</div><div class="track-artist">${t.artist||'Desconhecido'}</div></div>
    </div>`;
  }).join('');
  $$('#queueList .track').forEach(e=>e.addEventListener('click',()=>playTrack(e.dataset.qplay)));
}

// ---------- Adicionar músicas ----------
async function addFiles(fileList){
  let added=0;
  for(const f of fileList){
    if(!f.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)) continue;
    const blob=new Blob([await f.arrayBuffer()],{type:f.type||'audio/mpeg'});
    const t={id:uid(),name:f.name.replace(/\.[^.]+$/,''),artist:'Desconhecido',blob,dur:0};
    // tenta obter duração
    try{
      const url=URL.createObjectURL(blob);
      const a=new Audio(); a.src=url;
      await new Promise((res)=>{ a.addEventListener('loadedmetadata',()=>{ t.dur=Math.floor(a.duration||0); res();}, {once:true}); a.addEventListener('error',()=>res(),{once:true});});
      URL.revokeObjectURL(url);
    }catch(e){}
    await saveTrack(t);
    state.tracks.push(t);
    added++;
  }
  if(added){ toast(added+' música(s) adicionada(s)'); renderCurrent(); }
  else toast('Nenhum arquivo de áudio válido selecionado.');
}
async function removeTrack(id){
  const t=state.tracks.find(x=>x.id===id);
  if(t?.url) URL.revokeObjectURL(t.url);
  await deleteTrack(id);
  state.tracks=state.tracks.filter(x=>x.id!==id);
  if(state.currentTrack?.id===id){ pause(); state.currentTrack=null; $('#minip').style.display='none'; }
  toast('Música removida');
  renderCurrent();
}

// ---------- Router ----------
function showScreen(name){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  const el=$('#screen-'+name); if(el) el.classList.add('active');
  state.route=name;
  $$('.bn-item').forEach(b=>b.classList.toggle('active', b.dataset.route===name));
  const titles={inicio:'Minhas Músicas',config:'Configurações'};
  $('#topTitle').textContent=titles[name]||'';
  $('#btnBack').style.display='none';
  renderTopRight();
  renderCurrent();
}
function navigate(name,detail){ state.prevRoute=state.route; showScreen(name); }
function renderCurrent(){
  if(state.route==='inicio') renderInicio();
  else if(state.route==='config') renderConfig();
}

// ---------- Render: Início ----------
function renderInicio(){
  const el=$('#screen-inicio');
  if(!state.tracks.length){
    el.innerHTML=`
      <div style="text-align:center;padding:60px 16px">
        <div style="font-size:64px;margin-bottom:12px">🎵</div>
        <h2 style="margin:0 0 8px">Nenhuma música ainda</h2>
        <p style="color:var(--muted);margin:0 0 20px">Adicione suas músicas (MP3, WAV, etc.) do aparelho.</p>
        <label class="btn" style="cursor:pointer;display:inline-block">
          + Adicionar músicas
          <input type="file" id="fileInput" accept="audio/*" multiple style="display:none">
        </label>
      </div>`;
  } else {
    el.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="color:var(--muted);font-size:13px">${state.tracks.length} música(s)</span>
        <label class="btn" style="cursor:pointer;padding:8px 14px;font-size:13px">
          + Adicionar
          <input type="file" id="fileInput" accept="audio/*" multiple style="display:none">
        </label>
      </div>
      <div>${state.tracks.map(t=>`
        <div class="track" data-play="${t.id}">
          <div class="track-cover" style="background:linear-gradient(135deg,#a8c7fa,#3ea6ff);display:flex;align-items:center;justify-content:center;font-size:20px">🎵</div>
          <div class="track-info">
            <div class="track-title">${t.name}</div>
            <div class="track-artist">${t.artist||'Desconhecido'} · ${fmt(t.dur)}</div>
          </div>
          <button class="track-more" data-remove="${t.id}" title="Remover">✕</button>
        </div>`).join('')}</div>
      <div style="height:20px"></div>
    `;
  }
  const fi=$('#fileInput');
  if(fi) fi.addEventListener('change',e=>{ if(e.target.files.length) addFiles(e.target.files); e.target.value='';});
  el.querySelectorAll('[data-play]').forEach(e=>e.addEventListener('click',(ev)=>{ if(ev.target.closest('[data-remove]')) return; playTrack(e.dataset.play, state.tracks.map(t=>t.id));}));
  el.querySelectorAll('[data-remove]').forEach(e=>e.addEventListener('click',ev=>{ ev.stopPropagation(); removeTrack(e.dataset.remove);}));
}

// ---------- Render: Configurações ----------
function renderConfig(){
  const el=$('#screen-config');
  $('#topTitle').textContent='Configurações';
  el.innerHTML=`
    <div class="cfg-list">
      <div class="cfg-item" data-cfg="sobre"><div class="cfg-icon">ℹ</div><div class="cfg-text"><div class="cfg-title">Sobre</div><div class="cfg-sub">Versão ${APP_VERSION}</div></div><div class="cfg-arrow">›</div></div>
      <div class="cfg-item" data-cfg="limpar"><div class="cfg-icon">🗑</div><div class="cfg-text"><div class="cfg-title">Limpar biblioteca</div><div class="cfg-sub">Remover todas as músicas</div></div><div class="cfg-arrow">›</div></div>
    </div>
  `;
  el.querySelectorAll('[data-cfg]').forEach(e=>e.addEventListener('click',()=>{
    if(e.dataset.cfg==='sobre') toast('Music v'+APP_VERSION+' — player de músicas local');
    if(e.dataset.cfg==='limpar'){
      if(confirm('Remover todas as músicas da biblioteca?')){
        state.tracks.forEach(t=>{ if(t.url) URL.revokeObjectURL(t.url); deleteTrack(t.id);});
        state.tracks=[]; state.currentTrack=null; state.queue=[];
        $('#minip').style.display='none';
        toast('Biblioteca limpa'); renderCurrent();
      }
    }
  }));
}

// ---------- Topbar right ----------
function renderTopRight(){
  const el=$('#topRight');
  if(state.route==='inicio'){
    el.innerHTML=`<button class="ico-btn" id="btnCfgTop">⚙️</button>`;
    $('#btnCfgTop').addEventListener('click',()=>navigate('config'));
  } else {
    el.innerHTML='';
  }
}

// ---------- Player open/close ----------
function openPlayer(){ state.playerOpen=true; $('#player').style.display='flex'; renderPlayer();}
function closePlayer(){ state.playerOpen=false; $('#player').style.display='none';}

// ---------- Init ----------
async function init(){
  await openDB();
  const stored=await loadTracks();
  state.tracks=stored.map(t=>({...t,url:null}));
  initAudio();
  $$('.bn-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.route)));
  $('#btnBack').addEventListener('click',()=>navigate('inicio'));
  $('#minip').addEventListener('click',(e)=>{ if(e.target.closest('.minip-btn')) return; openPlayer();});
  $('#minipPlay').addEventListener('click',(e)=>{e.stopPropagation();togglePlay();});
  $('#minipPrev').addEventListener('click',(e)=>{e.stopPropagation();prev();});
  $('#minipNext').addEventListener('click',(e)=>{e.stopPropagation();next();});
  $('#playerClose').addEventListener('click',closePlayer);
  $('#pPlay').addEventListener('click',togglePlay);
  $('#pPrev').addEventListener('click',prev);
  $('#pNext').addEventListener('click',next);
  $('#pShuffle').addEventListener('click',()=>{state.shuffle=!state.shuffle;$('#pShuffle').classList.toggle('active',state.shuffle);toast(state.shuffle?'Aleatório ativado':'Aleatório desativado');});
  $('#pRepeat').addEventListener('click',()=>{const o=['off','all','one'];state.repeat=o[(o.indexOf(state.repeat)+1)%o.length];$('#pRepeat').classList.toggle('active',state.repeat!=='off');toast('Repetir: '+state.repeat);});
  $('#pQueue').addEventListener('click',()=>{const q=$('#playerQueue');q.style.display=q.style.display==='none'?'block':'none';});
  $('#progBar').addEventListener('click',(e)=>{const r=e.currentTarget.getBoundingClientRect();const pct=(e.clientX-r.left)/r.width;if(audio.duration)audio.currentTime=pct*audio.duration;});
  // esconde bottomnav? mantém
  showScreen('inicio');
}
init();
window.state=state; window.playTrack=playTrack;
