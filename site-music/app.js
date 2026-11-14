/* ============================================================
   Music — clone YouTube Music + player local (suas musicas)
   ============================================================ */
const APP_VERSION = '1.0.0';
const SOUNDFLIX = (n) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

const GRADS = [
  'linear-gradient(135deg,#ff6b6b,#feca57)',
  'linear-gradient(135deg,#48dbfb,#1dd1a1)',
  'linear-gradient(135deg,#a29bfe,#fd79a8)',
  'linear-gradient(135deg,#fdcb6e,#e17055)',
  'linear-gradient(135deg,#00b894,#00cec9)',
  'linear-gradient(135deg,#6c5ce7,#a29bfe)',
  'linear-gradient(135deg,#fab1a0,#ff7675)',
  'linear-gradient(135deg,#81ecec,#74b9ff)',
];
const cover = (i) => GRADS[i % GRADS.length];

// Musicas demo (online, royalty-free) para a interface ficar igual ao YouTube Music
const TRACKS = [
  {id:1,title:'Amanhecer',artist:'Luna Vega',album:'Horizonte',dur:214,url:SOUNDFLIX(1),online:true},
  {id:2,title:'Noite de Verão',artist:'Maré Alta',album:'Ondas',dur:198,url:SOUNDFLIX(2),online:true},
  {id:3,title:'Caminho Livre',artist:'Tiago Rocha',album:'Estrada',dur:231,url:SOUNDFLIX(3),online:true},
  {id:4,title:'Pulso',artist:'DJ Neon',album:'Eletrônico',dur:187,url:SOUNDFLIX(4),online:true},
  {id:5,title:'Raízes',artist:'Corda & Voz',album:'Sertão',dur:245,url:SOUNDFLIX(5),online:true},
  {id:6,title:'Correnteza',artist:'Maré Alta',album:'Ondas',dur:203,url:SOUNDFLIX(6),online:true},
  {id:7,title:'Foco Total',artist:'Beat Lab',album:'Concentração',dur:176,url:SOUNDFLIX(7),online:true},
  {id:8,title:'Romance de Outono',artist:'Luna Vega',album:'Horizonte',dur:222,url:SOUNDFLIX(8),online:true},
  {id:9,title:'Festa na Praia',artist:'Sol & Sal',album:'Verão',dur:195,url:SOUNDFLIX(9),online:true},
  {id:10,title:'Relax & Chill',artist:'Ambient One',album:'Calma',dur:260,url:SOUNDFLIX(10),online:true},
];
TRACKS.forEach((t,i)=>{ t.cover=cover(i); });

const MOMENTS = [
  {label:'Clima alegre',grad:'linear-gradient(135deg,#feca57,#ff6b6b)'},
  {label:'Foco',grad:'linear-gradient(135deg,#74b9ff,#a29bfe)'},
  {label:'Em trânsito',grad:'linear-gradient(135deg,#1dd1a1,#48dbfb)'},
  {label:'Games',grad:'linear-gradient(135deg,#6c5ce7,#fd79a8)'},
  {label:'Energia',grad:'linear-gradient(135deg,#fdcb6e,#e17055)'},
  {label:'Músicas para relaxar',grad:'linear-gradient(135deg,#00cec9,#00b894)'},
  {label:'Festa',grad:'linear-gradient(135deg,#ff7675,#fab1a0)'},
  {label:'Romance',grad:'linear-gradient(135deg,#fd79a8,#a29bfe)'},
];
const PLAYLISTS = [
  {id:'pl1',name:'Topnejo',artist:'Panda',tracks:[5],grad:'linear-gradient(135deg,#e17055,#fdcb6e)'},
  {id:'pl2',name:'Hits do pop nacional',artist:'Skank',tracks:[1,8,2],grad:'linear-gradient(135deg,#74b9ff,#a29bfe)'},
  {id:'pl3',name:'Hits Gospel',artist:'P...',tracks:[],grad:'linear-gradient(135deg,#a29bfe,#fd79a8)'},
  {id:'pl4',name:'Descobertas da semana',artist:'Para você',tracks:[3,7,4,9],grad:'linear-gradient(135deg,#1dd1a1,#48dbfb)'},
];
const CHIPS = ['Podcasts','Romance','Festa','Relax','Em alta','Pop','Sertanejo','Funk','Gospel'];

// ---------- Estado ----------
const state = {
  route:'inicio',
  prevRoute:null,
  detail:null,
  searchQuery:'',
  libTab:'playlists',
  settingsSection:null,
  localTracks:[],     // {id,name,artist,blob,url,dur}
  liked:new Set(),
  downloaded:new Set(),
  downloadProgress:{},
  queue:[],
  queueIndex:0,
  shuffle:false,
  repeat:'off',
  currentTrack:null,
  isPlaying:false,
  appearance:'escuro',
};
let audio=null;
let progressTimer=null;

// ---------- Utils ----------
const $=(s,ctx=document)=>ctx.querySelector(s);
const $$=(s,ctx=document)=>[...ctx.querySelectorAll(s)];
function toast(msg,ms=2200){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),ms);}
function fmt(s){s=Math.floor(s||0);const m=Math.floor(s/60);const sec=s%60;return m+':'+(sec<10?'0':'')+sec;}
function uid(){return 'l'+Date.now()+Math.random().toString(36).slice(2,7);}
function allTracks(){ return [...state.localTracks, ...TRACKS]; }
function trackById(id){ return state.localTracks.find(t=>t.id===id) || TRACKS.find(t=>t.id===id); }

// ---------- IndexedDB ----------
const DB_NAME='musiclib2', DB_VER=1;
let db=null;
function openDB(){
  return new Promise((res,rej)=>{
    if(db){res(db);return;}
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('tracks'))d.createObjectStore('tracks',{keyPath:'id'});};
    r.onsuccess=()=>{db=r.result;res(db);};
    r.onerror=()=>rej(r.error);
  });
}
async function saveTrack(t){const d=await openDB();return new Promise((res,rej)=>{const tx=d.transaction('tracks','readwrite');tx.objectStore('tracks').put(t);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
async function deleteTrack(id){const d=await openDB();return new Promise((res,rej)=>{const tx=d.transaction('tracks','readwrite');tx.objectStore('tracks').delete(id);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
async function loadTracks(){const d=await openDB();return new Promise((res,rej)=>{const tx=d.transaction('tracks','readonly');const q=tx.objectStore('tracks').getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});}

// ---------- Áudio ----------
function initAudio(){
  audio=$('#audioEl');
  audio.addEventListener('timeupdate',onTimeUpdate);
  audio.addEventListener('ended',onEnded);
  audio.addEventListener('loadedmetadata',()=>{ if(state.currentTrack){ const dur=$('#progDur'); if(dur) dur.textContent=fmt(audio.duration||state.currentTrack.dur); state.currentTrack.dur=Math.floor(audio.duration||state.currentTrack.dur);}});
  audio.addEventListener('error',()=>toast('Erro ao tocar. Verifique a conexão.'));
  if('mediaSession' in navigator){
    navigator.mediaSession.setActionHandler('play',()=>play());
    navigator.mediaSession.setActionHandler('pause',()=>pause());
    navigator.mediaSession.setActionHandler('previoustrack',()=>prev());
    navigator.mediaSession.setActionHandler('nexttrack',()=>next());
    navigator.mediaSession.setActionHandler('seekto',(e)=>{if(e.seekTime!=null)audio.currentTime=e.seekTime;});
  }
}
async function resolveSrc(t){
  if(t.blob){ if(!t.url) t.url=URL.createObjectURL(t.blob); return t.url; }
  if(state.downloaded.has(t.id)){ /* cached blob not stored for online tracks in this version */ }
  return t.url;
}
async function playTrack(id, queueOverride){
  const t=trackById(id); if(!t) return;
  if(queueOverride) state.queue=queueOverride;
  const idx=state.queue.indexOf(id); if(idx>=0) state.queueIndex=idx;
  state.currentTrack=t;
  const src=await resolveSrc(t);
  audio.src=src; audio.load();
  try{ await audio.play(); state.isPlaying=true;}catch(e){state.isPlaying=false;}
  updateMediaSession(t);
  renderMiniPlayer(); renderPlayer(); startProgress();
}
function play(){ if(!audio.src && state.currentTrack){ playTrack(state.currentTrack.id); return;} audio.play().catch(()=>{}); state.isPlaying=true; updatePlayBtns(); updateMediaSession(state.currentTrack);}
function pause(){ audio.pause(); state.isPlaying=false; updatePlayBtns(); if('mediaSession' in navigator) navigator.mediaSession.playbackState='paused';}
function togglePlay(){ state.isPlaying?pause():play();}
function next(){
  if(!state.queue.length) return;
  let i=state.queueIndex;
  if(state.shuffle) i=Math.floor(Math.random()*state.queue.length);
  else { i=(i+1)%state.queue.length; if(i===0 && state.repeat!=='all' && state.queueIndex===state.queue.length-1){ pause(); return;} }
  if(state.repeat==='one'){ playTrack(state.queue[state.queueIndex]); return;}
  state.queueIndex=i; playTrack(state.queue[i]);
}
function prev(){
  if(audio.currentTime>3){ audio.currentTime=0; return;}
  if(!state.queue.length) return;
  let i=state.queueIndex-1; if(i<0) i=state.queue.length-1;
  state.queueIndex=i; playTrack(state.queue[i]);
}
function onEnded(){ if(state.repeat==='one'){ playTrack(state.queue[state.queueIndex]); return;} next();}
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
  navigator.mediaSession.metadata=new MediaMetadata({title:t.title||t.name,artist:t.artist,album:t.album||'Músicas',artwork:[{src:'logo.svg',sizes:'512x512',type:'image/svg+xml'}]});
  navigator.mediaSession.playbackState=state.isPlaying?'playing':'paused';
}
function renderMiniPlayer(){
  const t=state.currentTrack; const mp=$('#minip');
  if(!t){ mp.style.display='none'; return;}
  mp.style.display='flex';
  $('#minipCover').style.background=t.cover||'linear-gradient(135deg,#a8c7fa,#3ea6ff)';
  $('#minipTitle').textContent=t.title||t.name;
  $('#minipArtist').textContent=t.artist;
  updatePlayBtns();
}
function renderPlayer(){
  const t=state.currentTrack; if(!t) return;
  const cov=$('#playerCover'); cov.style.background=t.cover||'linear-gradient(135deg,#a8c7fa,#3ea6ff)';
  $('#playerTitle').textContent=t.title||t.name;
  $('#playerArtist').textContent=t.artist;
  $('#playerAlbum').textContent=t.album||'Músicas';
  $('#progCur').textContent=fmt(audio.currentTime);
  $('#progDur').textContent=fmt(t.dur||0);
  $('#pShuffle').classList.toggle('active',state.shuffle);
  $('#pRepeat').classList.toggle('active',state.repeat!=='off');
  $('#pLike').classList.toggle('active',state.liked.has(t.id));
  $('#pLike').innerHTML=state.liked.has(t.id)?'&#9829;':'&#9825;';
  updatePlayBtns();
  renderQueue();
}
function renderQueue(){
  const el=$('#queueList'); if(!el) return;
  el.innerHTML=state.queue.map((id,i)=>{
    const t=trackById(id); if(!t) return '';
    return `<div class="track ${i===state.queueIndex?'playing':''}" data-qplay="${id}">
      <div class="track-cover" style="background:${t.cover||'linear-gradient(135deg,#a8c7fa,#3ea6ff)'}"></div>
      <div class="track-info"><div class="track-title">${t.title||t.name}</div><div class="track-artist">${t.artist}</div></div>
    </div>`;
  }).join('');
  $$('#queueList .track').forEach(e=>e.addEventListener('click',()=>playTrack(e.dataset.qplay)));
}

// ---------- Adicionar musicas locais ----------
async function addFiles(fileList){
  let added=0;
  for(const f of fileList){
    if(!f.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)) continue;
    const blob=new Blob([await f.arrayBuffer()],{type:f.type||'audio/mpeg'});
    const t={id:'l'+uid(),title:f.name.replace(/\.[^.]+$/,''),artist:'Música local',album:'Minhas músicas',dur:0,blob,cover:cover(Math.floor(Math.random()*GRADS.length)),local:true};
    try{
      const url=URL.createObjectURL(blob);
      const a=new Audio(); a.src=url;
      await new Promise((res)=>{ a.addEventListener('loadedmetadata',()=>{ t.dur=Math.floor(a.duration||0); res();}, {once:true}); a.addEventListener('error',()=>res(),{once:true});});
      URL.revokeObjectURL(url);
    }catch(e){}
    await saveTrack(t); state.localTracks.push(t); added++;
  }
  if(added){ toast(added+' música(s) adicionada(s)'); renderCurrent();}
  else toast('Nenhum arquivo de áudio válido.');
}
async function removeTrack(id){
  const t=state.localTracks.find(x=>x.id===id);
  if(t?.url) URL.revokeObjectURL(t.url);
  await deleteTrack(id);
  state.localTracks=state.localTracks.filter(x=>x.id!==id);
  if(state.currentTrack?.id===id){ pause(); state.currentTrack=null; $('#minip').style.display='none';}
  toast('Música removida'); renderCurrent();
}

// ---------- Downloads (online tracks) ----------
async function downloadTrack(t){
  if(state.downloaded.has(t.id)){ toast('Já baixada'); return;}
  toast('Baixando '+t.title+'…');
  try{
    const res=await fetch(t.url);
    if(!res.ok) throw new Error('http');
    const reader=res.body.getReader(); const chunks=[]; let received=0;
    const total=+res.headers.get('Content-Length')||t.dur*16000;
    while(true){ const {done,value}=await reader.read(); if(done) break; chunks.push(value); received+=value.length; state.downloadProgress[t.id]=Math.min(99,Math.round(received/total*100)); renderCurrent();}
    const blob=new Blob(chunks,{type:'audio/mpeg'});
    const lt={id:'d'+t.id,title:t.title,artist:t.artist,album:t.album,dur:t.dur,blob,cover:t.cover,local:true};
    await saveTrack(lt); state.localTracks.push(lt);
    state.downloaded.add(t.id); delete state.downloadProgress[t.id];
    toast('Baixada: '+t.title);
  }catch(e){ delete state.downloadProgress[t.id]; toast('Falha ao baixar. Verifique a conexão.');}
  renderCurrent();
}

// ---------- Router ----------
function showScreen(name){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  const el=$('#screen-'+name); if(el) el.classList.add('active');
  state.route=name;
  $$('.bn-item').forEach(b=>b.classList.toggle('active', b.dataset.route===name));
  const titles={inicio:'Início',config:'Configurações'};
  $('#topTitle').textContent=titles[name]||'';
  $('#btnBack').style.display='none';
  renderTopRight();
  renderCurrent();
}
function navigate(name,detail){ state.prevRoute=state.route; showScreen(name);}
function renderCurrent(){ if(state.route==='inicio') renderInicio(); else if(state.route==='config') renderConfig();}

// ---------- Render: Início ----------
function trackRow(t){
  return `<div class="track" data-play="${t.id}">
    <div class="track-cover" style="background:${t.cover||'linear-gradient(135deg,#a8c7fa,#3ea6ff)'}"></div>
    <div class="track-info">
      <div class="track-title">${t.title||t.name}</div>
      <div class="track-artist">${t.artist}${state.downloadProgress[t.id]!=null?' · Baixando '+state.downloadProgress[t.id]+'%':''}</div>
    </div>
    <div class="track-dur">${fmt(t.dur)}</div>
  </div>`;
}
function renderInicio(){
  const el=$('#screen-inicio');
  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin:6px 0 10px">
      <span style="color:var(--muted);font-size:13px">${state.localTracks.length} música(s) no aparelho</span>
      <label class="btn" style="cursor:pointer;padding:8px 14px;font-size:13px">
        + Adicionar músicas
        <input type="file" id="fileInput" accept="audio/*" multiple style="display:none">
      </label>
    </div>
    ${state.localTracks.length?`<div class="section"><div class="section-head"><h2 class="section-title">Minhas músicas</h2></div>${state.localTracks.map(t=>trackRow(t)).join('')}</div>`:''}
    <div class="chips">${CHIPS.map((c,i)=>`<div class="chip ${i===0?'active':''}">${c}</div>`).join('')}</div>
    <div class="section">
      <div class="section-head"><h2 class="section-title">Momentos e Gêneros</h2><button class="section-arrow">›</button></div>
      <div class="grid2">${MOMENTS.map(m=>`<div class="moment-card" style="background:${m.grad}"><span>${m.label}</span></div>`).join('')}</div>
    </div>
    <div class="section">
      <div class="section-head"><h2 class="section-title">Perfeitas para o fim de semana</h2><button class="section-arrow">›</button></div>
      <div class="hscroll">${PLAYLISTS.map(p=>`<div class="hcard" data-playlist="${p.id}"><div class="hcard-cover" style="background:${p.grad}"></div><div class="hcard-title">${p.name}</div><div class="hcard-sub">${p.artist}</div></div>`).join('')}</div>
    </div>
    <div class="section">
      <div class="section-head"><h2 class="section-title">Lançamentos</h2><button class="section-arrow">›</button></div>
      <div class="hscroll">${TRACKS.slice(0,6).map(t=>`<div class="hcard" data-play="${t.id}"><div class="hcard-cover" style="background:${t.cover}"></div><div class="hcard-title">${t.title}</div><div class="hcard-sub">${t.artist}</div></div>`).join('')}</div>
    </div>
    <div class="section">
      <div class="section-head"><h2 class="section-title">Recomendado para você</h2></div>
      ${TRACKS.map(t=>`<div class="track" data-play="${t.id}"><div class="track-cover" style="background:${t.cover}"></div><div class="track-info"><div class="track-title">${t.title}</div><div class="track-artist">${t.artist}</div></div><div class="track-dur">${fmt(t.dur)}</div><button class="track-more" data-dl="${t.id}" title="Baixar">⬇</button></div>`).join('')}
    </div>
  `;
  const fi=$('#fileInput'); if(fi) fi.addEventListener('change',e=>{ if(e.target.files.length) addFiles(e.target.files); e.target.value='';});
  el.querySelectorAll('[data-play]').forEach(e=>e.addEventListener('click',()=>playTrack(e.dataset.play, allTracks().map(t=>t.id))));
  el.querySelectorAll('[data-dl]').forEach(e=>e.addEventListener('click',ev=>{ ev.stopPropagation(); const t=TRACKS.find(x=>x.id==e.dataset.dl); if(t) downloadTrack(t);}));
  el.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ el.querySelectorAll('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active');}));
  el.querySelectorAll('.moment-card').forEach((c,i)=>c.addEventListener('click',()=>toast(MOMENTS[i].label)));
}

// ---------- Render: Configurações ----------
function renderConfig(){
  const el=$('#screen-config');
  $('#topTitle').textContent='Configurações';
  el.innerHTML=`
    <div class="cfg-list">
      <div class="cfg-item" data-cfg="sobre"><div class="cfg-icon">ℹ</div><div class="cfg-text"><div class="cfg-title">Sobre</div><div class="cfg-sub">Versão ${APP_VERSION}</div></div><div class="cfg-arrow">›</div></div>
      <div class="cfg-item" data-cfg="limpar"><div class="cfg-icon">🗑</div><div class="cfg-text"><div class="cfg-title">Limpar biblioteca</div><div class="cfg-sub">${state.localTracks.length} música(s) salva(s)</div></div><div class="cfg-arrow">›</div></div>
    </div>
  `;
  el.querySelectorAll('[data-cfg]').forEach(e=>e.addEventListener('click',()=>{
    if(e.dataset.cfg==='sobre') toast('Music v'+APP_VERSION);
    if(e.dataset.cfg==='limpar'){
      if(confirm('Remover todas as músicas da biblioteca?')){
        state.localTracks.forEach(t=>{ if(t.url) URL.revokeObjectURL(t.url); deleteTrack(t.id);});
        state.localTracks=[]; state.currentTrack=null; state.queue=[];
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
  } else { el.innerHTML=''; }
}

// ---------- Player open/close ----------
function openPlayer(){ state.playerOpen=true; $('#player').style.display='flex'; renderPlayer();}
function closePlayer(){ state.playerOpen=false; $('#player').style.display='none';}

// ---------- Init ----------
async function init(){
  await openDB();
  const stored=await loadTracks();
  state.localTracks=stored.map(t=>({...t,url:null}));
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
  $('#pLike').addEventListener('click',()=>{const t=state.currentTrack;if(!t)return;if(state.liked.has(t.id))state.liked.delete(t.id);else state.liked.add(t.id);renderPlayer();});
  $('#pDownload').addEventListener('click',()=>{const t=state.currentTrack;if(!t||t.local)return;if(state.downloaded.has(t.id))toast('Já baixada');else downloadTrack(t);});
  $('#pQueue').addEventListener('click',()=>{const q=$('#playerQueue');q.style.display=q.style.display==='none'?'block':'none';});
  $('#progBar').addEventListener('click',(e)=>{const r=e.currentTarget.getBoundingClientRect();const pct=(e.clientX-r.left)/r.width;if(audio.duration)audio.currentTime=pct*audio.duration;});
  showScreen('inicio');
}
init();
window.state=state; window.playTrack=playTrack; window.addFiles=addFiles;
