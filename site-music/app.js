/* ============================================================
   Music — app de música (clone YouTube Music)
   ============================================================ */
const APP_VERSION = '1.0.0';
const SOUNDFLIX = (n) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

// ---------- Dados ----------
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

const TRACKS = [
  {id:1,title:'Amanhecer',artist:'Luna Vega',album:'Horizonte',dur:214,url:SOUNDFLIX(1)},
  {id:2,title:'Noite de Verão',artist:'Maré Alta',album:'Ondas',dur:198,url:SOUNDFLIX(2)},
  {id:3,title:'Caminho Livre',artist:'Tiago Rocha',album:'Estrada',dur:231,url:SOUNDFLIX(3)},
  {id:4,title:'Pulso',artist:'DJ Neon',album:'Eletrônico',dur:187,url:SOUNDFLIX(4)},
  {id:5,title:'Raízes',artist:'Corda & Voz',album:'Sertão',dur:245,url:SOUNDFLIX(5)},
  {id:6,title:'Correnteza',artist:'Maré Alta',album:'Ondas',dur:203,url:SOUNDFLIX(6)},
  {id:7,title:'Foco Total',artist:'Beat Lab',album:'Concentração',dur:176,url:SOUNDFLIX(7)},
  {id:8,title:'Romance de Outono',artist:'Luna Vega',album:'Horizonte',dur:222,url:SOUNDFLIX(8)},
  {id:9,title:'Festa na Praia',artist:'Sol & Sal',album:'Verão',dur:195,url:SOUNDFLIX(9)},
  {id:10,title:'Relax & Chill',artist:'Ambient One',album:'Calma',dur:260,url:SOUNDFLIX(10)},
  {id:11,title:'Energia Pura',artist:'DJ Neon',album:'Eletrônico',dur:188,url:SOUNDFLIX(11)},
  {id:12,title:'Saudade',artist:'Tiago Rocha',album:'Estrada',dur:210,url:SOUNDFLIX(12)},
  {id:13,title:'Gospel Hits',artist:'Voz Celeste',album:'Fé',dur:238,url:SOUNDFLIX(13)},
  {id:14,title:'Pop Nacional',artist:'Skank Cover',album:'Hits',dur:205,url:SOUNDFLIX(14)},
  {id:15,title:'Topnejo',artist:'Panda',album:'Sertanejo',dur:219,url:SOUNDFLIX(15)},
  {id:16,title:'Gospel Vibes',artist:'Voz Celeste',album:'Fé',dur:227,url:SOUNDFLIX(16)},
];
TRACKS.forEach((t,i)=>{ t.cover = cover(i); });

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
  {id:'pl1',name:'Topnejo',artist:'Panda',tracks:[5,12,15],grad:'linear-gradient(135deg,#e17055,#fdcb6e)'},
  {id:'pl2',name:'Hits do pop nacional',artist:'Skank',tracks:[14,1,8,2],grad:'linear-gradient(135deg,#74b9ff,#a29bfe)'},
  {id:'pl3',name:'Hits Gospel',artist:'P...',tracks:[13,16,5],grad:'linear-gradient(135deg,#a29bfe,#fd79a8)'},
  {id:'pl4',name:'Descobertas da semana',artist:'Para você',tracks:[3,7,11,4,9],grad:'linear-gradient(135deg,#1dd1a1,#48dbfb)'},
  {id:'pl5',name:'Músicas marcadas com "Gostei"',artist:'Automática',tracks:[1,6,8],grad:'linear-gradient(135deg,#ff6b6b,#feca57)'},
];

const CHIPS = ['Podcasts','Romance','Festa','Relax','Em alta','Pop','Sertanejo','Funk','Gospel'];

// ---------- Estado ----------
const state = {
  route:'inicio',
  prevRoute:null,
  detail:null,        // {type, id}
  searchQuery:'',
  searchFilter:'Tudo',
  libTab:'playlists',
  settingsSection:null,
  playerOpen:false,
  queue:[...TRACKS.map(t=>t.id)],
  queueIndex:0,
  shuffle:false,
  repeat:'off',       // off | one | all
  liked:new Set(),
  downloaded:new Set(), // track ids baixados
  downloadProgress:{},
  appearance:'escuro',
  audioQuality:'alta',
  crossfade:false,
  autoplay:true,
  offlineMode:false,
  currentTrack:null,
};
let audio = null;
let isPlaying = false;
let progressTimer = null;

// ---------- Utils ----------
const $ = (s,ctx=document)=>ctx.querySelector(s);
const $$ = (s,ctx=document)=>[...ctx.querySelectorAll(s)];
function toast(msg,ms=2200){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),ms);}
function fmt(s){s=Math.floor(s||0);const m=Math.floor(s/60);const sec=s%60;return m+':'+(sec<10?'0':'')+sec;}
function trackById(id){return TRACKS.find(t=>t.id===id);}

// ---------- IndexedDB (downloads) ----------
const DB_NAME='musicdb', DB_VER=1;
let db=null;
function openDB(){
  return new Promise((res,rej)=>{
    if(db){res(db);return;}
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks',{keyPath:'id'});};
    r.onsuccess=()=>{db=r.result;res(db);};
    r.onerror=()=>rej(r.error);
  });
}
async function saveTrackBlob(id,blob){
  const d=await openDB();
  return new Promise((res,rej)=>{const tx=d.transaction('tracks','readwrite');tx.objectStore('tracks').put({id,blob});tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});
}
async function getTrackBlob(id){
  const d=await openDB();
  return new Promise((res,rej)=>{const tx=d.transaction('tracks','readonly');const q=tx.objectStore('tracks').get(id);q.onsuccess=()=>res(q.result?.blob||null);q.onerror=()=>rej(q.error);});
}
async function deleteTrackBlob(id){
  const d=await openDB();
  return new Promise((res,rej)=>{const tx=d.transaction('tracks','readwrite');tx.objectStore('tracks').delete(id);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});
}
async function listDownloaded(){
  const d=await openDB();
  return new Promise((res,rej)=>{const tx=d.transaction('tracks','readonly');const q=tx.objectStore('tracks').getAll();q.onsuccess=()=>res((q.result||[]).map(x=>x.id));q.onerror=()=>rej(q.error);});
}

// ---------- Áudio ----------
function initAudio(){
  audio = $('#audioEl');
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('loadedmetadata', ()=>{ if(state.currentTrack) $('#playerDur') && ($('#progDur').textContent=fmt(audio.duration||state.currentTrack.dur)); });
  audio.addEventListener('error', ()=>{ toast('Erro ao tocar. Verifique a conexão.'); });
  if('mediaSession' in navigator){
    navigator.mediaSession.setActionHandler('play', ()=>play());
    navigator.mediaSession.setActionHandler('pause', ()=>pause());
    navigator.mediaSession.setActionHandler('previoustrack', ()=>prev());
    navigator.mediaSession.setActionHandler('nexttrack', ()=>next());
    navigator.mediaSession.setActionHandler('seekto', (e)=>{ if(e.seekTime!=null) audio.currentTime=e.seekTime; });
  }
}
async function resolveSrc(t){
  if(state.downloaded.has(t.id)){
    const blob=await getTrackBlob(t.id);
    if(blob) return URL.createObjectURL(blob);
  }
  return t.url;
}
async function playTrack(id, queueOverride){
  const t=trackById(id); if(!t) return;
  if(queueOverride) state.queue=queueOverride;
  const idx=state.queue.indexOf(id); if(idx>=0) state.queueIndex=idx;
  state.currentTrack=t;
  const src=await resolveSrc(t);
  audio.src=src;
  audio.load();
  try{ await audio.play(); isPlaying=true; }catch(e){ isPlaying=false; }
  updateMediaSession(t);
  renderMiniPlayer();
  renderPlayer();
  startProgress();
}
function play(){ if(!audio.src && state.currentTrack){ playTrack(state.currentTrack.id); return;} audio.play().catch(()=>{}); isPlaying=true; updatePlayBtns(); updateMediaSession(state.currentTrack); }
function pause(){ audio.pause(); isPlaying=false; updatePlayBtns(); }
function togglePlay(){ isPlaying?pause():play(); }
function next(){
  if(!state.queue.length) return;
  let i=state.queueIndex;
  if(state.shuffle){
    i=Math.floor(Math.random()*state.queue.length);
  } else {
    i=(i+1)%state.queue.length;
    if(i===0 && state.repeat!=='all' && state.queueIndex===state.queue.length-1){ pause(); return; }
  }
  if(state.repeat==='one'){ playTrack(state.queue[state.queueIndex]); return; }
  state.queueIndex=i;
  playTrack(state.queue[i]);
}
function prev(){
  if(audio.currentTime>3){ audio.currentTime=0; return; }
  if(!state.queue.length) return;
  let i=state.queueIndex-1; if(i<0) i=state.queue.length-1;
  state.queueIndex=i;
  playTrack(state.queue[i]);
}
function onEnded(){
  if(state.repeat==='one'){ playTrack(state.queue[state.queueIndex]); return; }
  next();
}
function onTimeUpdate(){
  if(!audio.duration) return;
  const pct=(audio.currentTime/audio.duration)*100;
  const fill=$('#progFill'), thumb=$('#progThumb');
  if(fill) fill.style.width=pct+'%';
  if(thumb) thumb.style.left=pct+'%';
  const cur=$('#progCur'); if(cur) cur.textContent=fmt(audio.currentTime);
  const dur=$('#progDur'); if(dur && !dur.textContent.match(/^\d/)) dur.textContent=fmt(audio.duration);
}
function startProgress(){ clearInterval(progressTimer); progressTimer=setInterval(()=>{ if(isPlaying) onTimeUpdate(); },250); }
function updatePlayBtns(){
  const txt=isPlaying?'❚❚':'▶';
  const mp=$('#minipPlay'); if(mp) mp.innerHTML=isPlaying?'&#10074;&#10074;':'&#9654;';
  const pp=$('#pPlay'); if(pp) pp.innerHTML=isPlaying?'&#10074;&#10074;':'&#9654;';
}
function updateMediaSession(t){
  if(!('mediaSession' in navigator)||!t) return;
  navigator.mediaSession.metadata=new MediaMetadata({
    title:t.title, artist:t.artist, album:t.album,
    artwork:[{src:'logo.svg',sizes:'512x512',type:'image/svg+xml'}]
  });
  navigator.mediaSession.playbackState=isPlaying?'playing':'paused';
}
function renderMiniPlayer(){
  const t=state.currentTrack; if(!t){ $('#minip').style.display='none'; return;}
  $('#minip').style.display='flex';
  $('#minipCover').style.background=t.cover;
  $('#minipTitle').textContent=t.title;
  $('#minipArtist').textContent=t.artist;
  updatePlayBtns();
}
function renderPlayer(){
  const t=state.currentTrack; if(!t) return;
  $('#playerCover').style.background=t.cover;
  $('#playerTitle').textContent=t.title;
  $('#playerArtist').textContent=t.artist;
  $('#playerAlbum').textContent=t.album;
  $('#progCur').textContent=fmt(audio.currentTime);
  $('#progDur').textContent=fmt(t.dur);
  $('#pLike').classList.toggle('active',state.liked.has(t.id));
  $('#pLike').innerHTML=state.liked.has(t.id)?'&#9829;':'&#9825;';
  $('#pDownload').classList.toggle('active',state.downloaded.has(t.id));
  $('#pShuffle').classList.toggle('active',state.shuffle);
  $('#pRepeat').classList.toggle('active',state.repeat!=='off');
  updatePlayBtns();
  renderQueue();
}
function renderQueue(){
  const el=$('#queueList'); if(!el) return;
  el.innerHTML=state.queue.map((id,i)=>{
    const t=trackById(id);
    return `<div class="track ${i===state.queueIndex?'playing':''}" data-qplay="${id}">
      <div class="track-cover" style="background:${t.cover}"></div>
      <div class="track-info"><div class="track-title">${t.title}</div><div class="track-artist">${t.artist}</div></div>
    </div>`;
  }).join('');
  $$('#queueList .track').forEach(e=>e.addEventListener('click',()=>playTrack(+e.dataset.qplay)));
}

// ---------- Downloads ----------
async function downloadTrack(id){
  const t=trackById(id); if(!t) return;
  if(state.downloaded.has(id)){ toast('Já baixada'); return; }
  state.downloadProgress[id]=0;
  toast('Baixando '+t.title+'…');
  try{
    const res=await fetch(t.url);
    if(!res.ok) throw new Error('http');
    const reader=res.body.getReader();
    const chunks=[]; let received=0;
    const total=+res.headers.get('Content-Length')||t.dur*16000;
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      chunks.push(value); received+=value.length;
      state.downloadProgress[id]=Math.min(99,Math.round(received/total*100));
      renderCurrent();
    }
    const blob=new Blob(chunks,{type:'audio/mpeg'});
    await saveTrackBlob(id,blob);
    state.downloaded.add(id);
    delete state.downloadProgress[id];
    toast('Baixada: '+t.title);
    if(navigator.onLine===false) {}
  }catch(e){
    delete state.downloadProgress[id];
    toast('Falha ao baixar. Verifique a conexão.');
  }
  renderCurrent();
}
async function removeDownload(id){
  await deleteTrackBlob(id);
  state.downloaded.delete(id);
  toast('Download removido');
  renderCurrent();
}
async function loadDownloaded(){
  try{ const ids=await listDownloaded(); ids.forEach(id=>state.downloaded.add(id)); }catch(e){}
}

// ---------- Router ----------
function showScreen(name){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  const el=$('#screen-'+name); if(el) el.classList.add('active');
  state.route=name;
  $$('.bn-item').forEach(b=>b.classList.toggle('active', b.dataset.route===name));
  const titles={inicio:'Início',pesquisar:'Pesquisar',biblioteca:'Biblioteca',config:'Configurações',detalhe:''};
  $('#topTitle').textContent = name==='detalhe' ? (state.detail?.title||'') : (titles[name]||'');
  $('#btnBack').style.display = (name==='detalhe' || (name==='config' && state.settingsSection)) ? 'inline-flex' : 'none';
  renderTopRight();
  if(name==='inicio') ensureFab(); else removeFab();
  renderCurrent();
}
function navigate(name, detail){
  state.prevRoute=state.route;
  if(detail){ state.detail=detail; name='detalhe'; }
  else if(name!=='detalhe') state.detail=null;
  showScreen(name);
  window.scrollTo(0,0);
  const sc=$('.screen.active'); if(sc) sc.scrollTop=0;
}
function goBack(){
  if(state.settingsSection){ state.settingsSection=null; renderConfig(); return; }
  if(state.detail){ state.detail=null; navigate(state.prevRoute||'inicio'); return; }
  navigate('inicio');
}
function renderCurrent(){
  const name=state.route;
  if(name==='inicio') renderInicio();
  else if(name==='pesquisar') renderPesquisar();
  else if(name==='biblioteca') renderBiblioteca();
  else if(name==='config') renderConfig();
  else if(name==='detalhe') renderDetalhe();
}

// ---------- Render: Início ----------
function renderInicio(){
  const el=$('#screen-inicio');
  const recentes=TRACKS.slice(0,6);
  el.innerHTML=`
    <div class="top-right-inline" style="display:none"></div>
    <div class="chips">${CHIPS.map((c,i)=>`<div class="chip ${i===0?'active':''}">${c}</div>`).join('')}</div>
    <div class="section">
      <div class="section-head"><h2 class="section-title">Momentos e Gêneros</h2><button class="section-arrow">›</button></div>
      <div class="grid2">${MOMENTS.map(m=>`<div class="moment-card" style="background:${m.grad}"><span>${m.label}</span></div>`).join('')}</div>
    </div>
    <div class="section">
      <div class="section-head"><h2 class="section-title">Perfeitas para o fim de semana</h2><button class="section-arrow">›</button></div>
      <div class="hscroll">${PLAYLISTS.slice(0,4).map(p=>`
        <div class="hcard" data-openplaylist="${p.id}">
          <div class="hcard-cover" style="background:${p.grad}"></div>
          <div class="hcard-title">${p.name}</div>
          <div class="hcard-sub">${p.artist}</div>
        </div>`).join('')}</div>
    </div>
    <div class="section">
      <div class="section-head"><h2 class="section-title">Lançamentos</h2><button class="section-arrow">›</button></div>
      <div class="hscroll">${TRACKS.slice(0,6).map(t=>`
        <div class="hcard" data-play="${t.id}">
          <div class="hcard-cover" style="background:${t.cover}"></div>
          <div class="hcard-title">${t.title}</div>
          <div class="hcard-sub">${t.artist}</div>
        </div>`).join('')}</div>
    </div>
    <div class="section">
      <div class="section-head"><h2 class="section-title">Recomendado para você</h2></div>
      ${TRACKS.slice(6,12).map(t=>trackRow(t)).join('')}
    </div>
  `;
  // handlers
  el.querySelectorAll('[data-play]').forEach(e=>e.addEventListener('click',()=>playTrack(+e.dataset.play)));
  el.querySelectorAll('[data-openplaylist]').forEach(e=>e.addEventListener('click',()=>{
    const p=PLAYLISTS.find(x=>x.id===e.dataset.openplaylist);
    navigate('detalhe',{type:'playlist',id:p.id,title:p.name});
  }));
  el.querySelectorAll('.moment-card').forEach((c,i)=>c.addEventListener('click',()=>{
    navigate('detalhe',{type:'moment',id:MOMENTS[i].label,title:MOMENTS[i].label});
  }));
  // chips
  el.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ el.querySelectorAll('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); }));
  // floating buttons
  ensureFab();
}

function trackRow(t, opts={}){
  const dl=state.downloaded.has(t.id);
  const prog=state.downloadProgress[t.id];
  return `<div class="track" data-play="${t.id}">
    <div class="track-cover" style="background:${t.cover}"></div>
    <div class="track-info">
      <div class="track-title">${t.title}</div>
      <div class="track-artist">${t.artist}${prog!=null?' · Baixando '+prog+'%':''}</div>
    </div>
    <div class="track-dur">${fmt(t.dur)}</div>
    <button class="track-more" data-more="${t.id}">&#8942;</button>
  </div>`;
}

// ---------- Render: Pesquisar ----------
function renderPesquisar(){
  const el=$('#screen-pesquisar');
  const q=state.searchQuery.toLowerCase();
  let res=TRACKS;
  if(q) res=TRACKS.filter(t=>t.title.toLowerCase().includes(q)||t.artist.toLowerCase().includes(q)||t.album.toLowerCase().includes(q));
  el.innerHTML=`
    <div style="margin-bottom:12px">
      <input class="input" id="searchInput" placeholder="O que você quer ouvir?" value="${state.searchQuery.replace(/"/g,'&quot;')}">
    </div>
    <div class="chips">${['Tudo','Músicas','Álbuns','Artistas','Playlists'].map(c=>`<div class="chip ${state.searchFilter===c?'active':''}" data-filter="${c}">${c}</div>`).join('')}</div>
    ${q?`<div class="section"><div class="section-head"><h2 class="section-title">Resultados</h2></div>${res.length?res.map(t=>trackRow(t)).join(''):'<div class="empty">Nada encontrado</div>'}</div>`:`
    <div class="section"><div class="section-head"><h2 class="section-title">Pesquisas recentes</h2></div>
      ${TRACKS.slice(0,5).map(t=>`<div class="track" data-play="${t.id}"><div class="track-cover" style="background:${t.cover}"></div><div class="track-info"><div class="track-title">${t.title}</div><div class="track-artist">${t.artist}</div></div></div>`).join('')}
    </div>
    <div class="section"><div class="section-head"><h2 class="section-title">Navegar por gêneros</h2></div>
      <div class="grid2">${MOMENTS.map(m=>`<div class="moment-card" style="background:${m.grad};height:80px"><span>${m.label}</span></div>`).join('')}</div>
    </div>`}
  `;
  const inp=$('#searchInput');
  inp.addEventListener('input',e=>{ state.searchQuery=e.target.value; renderPesquisar(); $('#searchInput').focus(); $('#searchInput').setSelectionRange(state.searchQuery.length,state.searchQuery.length); });
  el.querySelectorAll('[data-filter]').forEach(c=>c.addEventListener('click',()=>{ state.searchFilter=c.dataset.filter; renderPesquisar(); }));
  el.querySelectorAll('[data-play]').forEach(e=>e.addEventListener('click',()=>playTrack(+e.dataset.play)));
}

// ---------- Render: Biblioteca ----------
function renderBiblioteca(){
  const el=$('#screen-biblioteca');
  const tabs=['Playlists','Álbuns','Artistas','Downloads'];
  el.innerHTML=`
    <h2 class="detail-title" style="margin-bottom:10px">Biblioteca</h2>
    <div class="lib-tabs">${tabs.map(t=>`<button class="lib-tab ${state.libTab===t.toLowerCase()?'active':''}" data-tab="${t.toLowerCase()}">${t}</button>`).join('')}</div>
    <div id="libContent"></div>
  `;
  el.querySelectorAll('.lib-tab').forEach(b=>b.addEventListener('click',()=>{ state.libTab=b.dataset.tab; renderBiblioteca(); }));
  const content=$('#libContent');
  const tab=state.libTab;
  if(tab==='playlists'){
    content.innerHTML=PLAYLISTS.map(p=>`
      <div class="track" data-openplaylist="${p.id}">
        <div class="track-cover" style="background:${p.grad}"></div>
        <div class="track-info"><div class="track-title">${p.name}</div><div class="track-artist">${p.tracks.length} músicas · ${p.artist}</div></div>
      </div>`).join('');
    content.querySelectorAll('[data-openplaylist]').forEach(e=>e.addEventListener('click',()=>{const p=PLAYLISTS.find(x=>x.id===e.dataset.openplaylist);navigate('detalhe',{type:'playlist',id:p.id,title:p.name});}));
  } else if(tab==='álbuns'){
    const albums=[...new Set(TRACKS.map(t=>t.album))];
    content.innerHTML=albums.map((a,i)=>`
      <div class="track" data-openalbum="${a}">
        <div class="track-cover" style="background:${cover(i*3)}"></div>
        <div class="track-info"><div class="track-title">${a}</div><div class="track-artist">${TRACKS.filter(t=>t.album===a).length} músicas</div></div>
      </div>`).join('');
    content.querySelectorAll('[data-openalbum]').forEach(e=>e.addEventListener('click',()=>navigate('detalhe',{type:'album',id:e.dataset.openalbum,title:e.dataset.openalbum})));
  } else if(tab==='artistas'){
    const artists=[...new Set(TRACKS.map(t=>t.artist))];
    content.innerHTML=artists.map((a,i)=>`
      <div class="track" data-openartist="${a}">
        <div class="track-cover" style="background:${cover(i*2)};border-radius:50%"></div>
        <div class="track-info"><div class="track-title">${a}</div><div class="track-artist">${TRACKS.filter(t=>t.artist===a).length} músicas</div></div>
      </div>`).join('');
    content.querySelectorAll('[data-openartist]').forEach(e=>e.addEventListener('click',()=>navigate('detalhe',{type:'artist',id:e.dataset.openartist,title:e.dataset.openartist})));
  } else if(tab==='downloads'){
    const ids=[...state.downloaded];
    if(!ids.length){ content.innerHTML='<div class="empty">Nenhuma música baixada ainda.<br>Toque em ⬇ em uma música para baixar.</div>'; return;}
    content.innerHTML=ids.map(id=>trackRow(trackById(id))).join('');
    content.querySelectorAll('[data-play]').forEach(e=>e.addEventListener('click',()=>playTrack(+e.dataset.play)));
  }
}

// ---------- Render: Detalhe ----------
function renderDetalhe(){
  const el=$('#screen-detalhe');
  const d=state.detail; if(!d){ navigate('inicio'); return;}
  let tracks=[];
  if(d.type==='playlist'){ const p=PLAYLISTS.find(x=>x.id===d.id); tracks=p.tracks.map(id=>trackById(id)); }
  else if(d.type==='album'){ tracks=TRACKS.filter(t=>t.album===d.id); }
  else if(d.type==='artist'){ tracks=TRACKS.filter(t=>t.artist===d.id); }
  else if(d.type==='moment'){ tracks=TRACKS.slice(0,8); }
  let grad = cover(0);
  if(d.type==='playlist'){ const p=PLAYLISTS.find(x=>x.id===d.id); if(p) grad=p.grad; }
  el.innerHTML=`
    <div class="hero">
      <div class="hero-cover" style="background:${grad}"></div>
      <div class="hero-title">${d.title}</div>
      <div class="hero-sub">${tracks.length} músicas</div>
      <div class="play-all">
        <button class="btn" id="playAll">▶ Tocar tudo</button>
        <button class="btn ghost" id="shuffleAll">🔀 Aleatório</button>
      </div>
    </div>
    ${tracks.map(t=>trackRow(t)).join('')}
  `;
  $('#playAll').addEventListener('click',()=>{ state.queue=tracks.map(t=>t.id); state.shuffle=false; playTrack(tracks[0].id); });
  $('#shuffleAll').addEventListener('click',()=>{ state.queue=[...tracks.map(t=>t.id)].sort(()=>Math.random()-.5); state.shuffle=true; playTrack(state.queue[0]); });
  el.querySelectorAll('[data-play]').forEach(e=>e.addEventListener('click',()=>playTrack(+e.dataset.play,tracks.map(t=>t.id))));
}

// ---------- Render: Configurações ----------
const CFG_ITEMS=[
  {id:'update',icon:'⬇',title:'Atualização do sistema',sub:'Update Available',color:'#ff9800'},
  {id:'aparencia',icon:'🎨',title:'Aparência',sub:'Tema escuro'},
  {id:'conta',icon:'👤',title:'Conta',sub:'Entrar no YouTube'},
  {id:'ouvir',icon:'👥',title:'Ouvir juntos',sub:'Sessão compartilhada'},
  {id:'tocador',icon:'🎧',title:'Tocador e áudio',sub:'Qualidade, crossfade'},
  {id:'conteudo',icon:'🎵',title:'Conteúdo',sub:'Filtros e preferências'},
  {id:'traducao',icon:'🌐',title:'Tradução de letras por IA',sub:'Traduzir letras automaticamente'},
  {id:'privacidade',icon:'🛡',title:'Privacidade',sub:'Dados e permissões'},
  {id:'armazenamento',icon:'💾',title:'Armazenamento',sub:'Downloads e cache'},
  {id:'backup',icon:'☁',title:'Backup e restauração',sub:'Restaurar seus dados'},
  {id:'sobre',icon:'ℹ',title:'Sobre',sub:'Versão '+APP_VERSION},
];
function renderConfig(){
  const el=$('#screen-config');
  if(!state.settingsSection){ $('#topTitle').textContent='Configurações'; $('#btnBack').style.display='none'; }
  if(state.settingsSection){ renderConfigDetail(el); return; }
  $('#topTitle').textContent='Configurações';
  $('#btnBack').style.display='none';
  el.innerHTML=`
    <div class="cfg-list">
      ${CFG_ITEMS.map(c=>`
        <div class="cfg-item" data-cfg="${c.id}">
          <div class="cfg-icon">${c.icon}</div>
          <div class="cfg-text">
            <div class="cfg-title">${c.title}</div>
            <div class="cfg-sub" style="${c.id==='update'?'color:#ff9800':''}">${c.sub}</div>
          </div>
          <div class="cfg-arrow">›</div>
        </div>`).join('')}
    </div>
  `;
  el.querySelectorAll('[data-cfg]').forEach(e=>e.addEventListener('click',()=>{ state.settingsSection=e.dataset.cfg; renderConfig(); }));
}
function renderConfigDetail(el){
  $('#topTitle').textContent = CFG_ITEMS.find(c=>c.id===state.settingsSection)?.title || 'Configurações';
  $('#btnBack').style.display='inline-flex';
  const id=state.settingsSection;
  let body='';
  if(id==='aparencia'){
    body=`<div class="card">
      <p style="margin:0 0 10px;font-weight:600">Tema</p>
      ${['escuro','claro','sistema'].map(t=>`<button class="btn ${state.appearance===t?'':'ghost'}" style="margin:4px" data-appearance="${t}">${t}</button>`).join('')}
    </div>`;
  } else if(id==='tocador'){
    body=`<div class="card">
      <p style="margin:0 0 10px;font-weight:600">Qualidade de áudio</p>
      ${['baixa','normal','alta','sempre alta'].map(q=>`<button class="btn ${state.audioQuality===q?'':'ghost'}" style="margin:4px" data-quality="${q}">${q}</button>`).join('')}
      <div class="linha" style="margin-top:14px">
        <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="chkCrossfade" ${state.crossfade?'checked':''}> Crossfade entre músicas</label>
      </div>
      <div class="linha" style="margin-top:8px">
        <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="chkAutoplay" ${state.autoplay?'checked':''}> Reprodução automática</label>
      </div>
    </div>`;
  } else if(id==='armazenamento'){
    const dl=[...state.downloaded];
    body=`<div class="card">
      <p style="margin:0 0 6px;font-weight:600">Músicas baixadas: ${dl.length}</p>
      <p class="cfg-sub">Espaço usado: ~${(dl.length*4).toFixed(1)} MB (estimado)</p>
      <button class="btn danger" id="clearDownloads" style="margin-top:10px">Apagar todos os downloads</button>
    </div>
    <div class="section"><div class="section-head"><h2 class="section-title">Baixadas</h2></div>
      ${dl.length? dl.map(did=>trackRow(trackById(did))).join('') : '<div class="empty">Nenhuma música baixada</div>'}
    </div>`;
  } else if(id==='sobre'){
    body=`<div class="card">
      <p style="margin:0 0 6px;font-weight:700">Music</p>
      <p class="cfg-sub">Versão ${APP_VERSION}</p>
      <p class="cfg-sub">Clone do YouTube Music para uso pessoal.</p>
      <p class="cfg-sub" style="margin-top:10px">Músicas demo: SoundHelix (royalty-free).</p>
    </div>`;
  } else if(id==='update'){
    body=`<div class="card">
      <p style="margin:0 0 6px;font-weight:700">Atualização disponível</p>
      <p class="cfg-sub">Uma nova versão do app está disponível.</p>
      <button class="btn" style="margin-top:10px">Atualizar agora</button>
    </div>`;
  } else {
    body=`<div class="card"><p class="cfg-sub">Configurações de ${CFG_ITEMS.find(c=>c.id===id)?.title}.</p>
      <p class="cfg-sub" style="margin-top:8px">Opções avançadas em breve.</p></div>`;
  }
  el.innerHTML=body;
  // handlers
  el.querySelectorAll('[data-appearance]').forEach(b=>b.addEventListener('click',()=>{ state.appearance=b.dataset.appearance; toast('Tema: '+state.appearance); renderConfig(); }));
  el.querySelectorAll('[data-quality]').forEach(b=>b.addEventListener('click',()=>{ state.audioQuality=b.dataset.quality; toast('Qualidade: '+state.audioQuality); renderConfig(); }));
  const cf=$('#chkCrossfade'); if(cf) cf.addEventListener('change',e=>{ state.crossfade=e.target.checked; });
  const ap=$('#chkAutoplay'); if(ap) ap.addEventListener('change',e=>{ state.autoplay=e.target.checked; });
  const cd=$('#clearDownloads'); if(cd) cd.addEventListener('click',async()=>{ for(const id of [...state.downloaded]) await removeDownload(id); toast('Downloads apagados'); renderConfig(); });
  el.querySelectorAll('[data-play]').forEach(e=>e.addEventListener('click',()=>playTrack(+e.dataset.play)));
}

// ---------- FAB ----------
function ensureFab(){
  if($('#fabWrap')) return;
  const w=document.createElement('div'); w.id='fabWrap'; w.className='fab-wrap';
  w.innerHTML=`
    <button class="fab mic" id="fabMic" title="Pesquisar por voz">&#127908;</button>
    <button class="fab shuffle" id="fabShuffle" title="Rádio rápido">&#128256;</button>
  `;
  document.body.appendChild(w);
  $('#fabMic').addEventListener('click',()=>navigate('pesquisar'));
  $('#fabShuffle').addEventListener('click',()=>{
    const shuffled=[...TRACKS.map(t=>t.id)].sort(()=>Math.random()-.5);
    state.queue=shuffled; state.shuffle=true;
    playTrack(shuffled[0]);
    toast('Rádio rápido iniciado');
  });
}
function removeFab(){ const w=$('#fabWrap'); if(w) w.remove(); }

// ---------- Topbar right icons (Início) ----------
function renderTopRight(){
  const el=$('#topRight');
  if(state.route==='inicio'){
    el.innerHTML=`
      <button class="ico-btn" title="Histórico">&#128340;</button>
      <button class="ico-btn" title="Compartilhar">&#8599;</button>
      <button class="ico-btn" title="Ouvir juntos">&#128101;</button>
      <button class="ico-btn" id="btnCfgTop" title="Configurações">&#9881;</button>
    `;
    $('#btnCfgTop').addEventListener('click',()=>navigate('config'));
  } else if(state.route==='pesquisar'){
    el.innerHTML=`<button class="ico-btn">&#9881;</button>`;
  } else if(state.route==='biblioteca'){
    el.innerHTML=`<button class="ico-btn">&#9881;</button>`;
  } else if(state.route==='config'){
    el.innerHTML='';
  } else {
    el.innerHTML='';
  }
}

// ---------- Init ----------
async function init(){
  await loadDownloaded();
  initAudio();
  // bottomnav
  $$('.bn-item').forEach(b=>b.addEventListener('click',()=>{ removeFab(); navigate(b.dataset.route); }));
  $('#btnBack').addEventListener('click',goBack);
  // minip
  $('#minip').addEventListener('click',(e)=>{ if(e.target.closest('.minip-btn')) return; openPlayer(); });
  $('#minipPlay').addEventListener('click',(e)=>{ e.stopPropagation(); togglePlay(); });
  $('#minipPrev').addEventListener('click',(e)=>{ e.stopPropagation(); prev(); });
  $('#minipNext').addEventListener('click',(e)=>{ e.stopPropagation(); next(); });
  // player
  $('#playerClose').addEventListener('click',closePlayer);
  $('#pPlay').addEventListener('click',togglePlay);
  $('#pPrev').addEventListener('click',prev);
  $('#pNext').addEventListener('click',next);
  $('#pShuffle').addEventListener('click',()=>{ state.shuffle=!state.shuffle; $('#pShuffle').classList.toggle('active',state.shuffle); toast(state.shuffle?'Aleatório ativado':'Aleatório desativado'); });
  $('#pRepeat').addEventListener('click',()=>{ const order=['off','all','one']; state.repeat=order[(order.indexOf(state.repeat)+1)%order.length]; $('#pRepeat').classList.toggle('active',state.repeat!=='off'); toast('Repetir: '+state.repeat); });
  $('#pLike').addEventListener('click',()=>{ const t=state.currentTrack; if(!t) return; if(state.liked.has(t.id)) state.liked.delete(t.id); else state.liked.add(t.id); renderPlayer(); });
  $('#pDownload').addEventListener('click',()=>{ const t=state.currentTrack; if(!t) return; if(state.downloaded.has(t.id)) removeDownload(t.id); else downloadTrack(t.id); });
  $('#pQueue').addEventListener('click',()=>{ const q=$('#playerQueue'); q.style.display=q.style.display==='none'?'block':'none'; });
  // progress seek
  $('#progBar').addEventListener('click',(e)=>{ const r=e.currentTarget.getBoundingClientRect(); const pct=(e.clientX-r.left)/r.width; if(audio.duration) audio.currentTime=pct*audio.duration; });
  // topbar title update on route
  showScreen('inicio');
  renderTopRight();
  // re-render top right on navigate
  const origNavigate=navigate;
  // wrap navigate to update top right + fab
  const navProxy=(name,detail)=>{
    removeFab();
    origNavigate(name,detail);
    renderTopRight();
    if(state.route==='inicio') ensureFab();
  };
  window.navigate=navProxy;
  // override internal navigate calls by replacing global? We used navigate() internally; rebind
  // (already defined as function; wrap via reassign not possible for hoisted fn easily) -> instead call renderTopRight in showScreen
  // patch showScreen
  const origShow=showScreen;
  // monkey: redefine showScreen to also update top right
  window._showScreen=origShow;
}

// We need top-right update inside showScreen; redefine showScreen wrapper:
const _origShowScreen = showScreen;
function showScreenWrapped(name){
  _origShowScreen(name);
  renderTopRight();
  if(name==='inicio') ensureFab(); else removeFab();
}
// replace showScreen reference used by navigate? navigate calls showScreen global. Redefine global showScreen:
window.showScreen = showScreenWrapped;

// Re-bind navigate to use wrapped showScreen is not needed since navigate calls showScreen by name (global). Good.

function openPlayer(){ state.playerOpen=true; $('#player').style.display='flex'; renderPlayer(); }
function closePlayer(){ state.playerOpen=false; $('#player').style.display='none'; }

// Override navigate global
function navigateWrapped(name,detail){
  state.prevRoute=state.route;
  if(detail){ state.detail=detail; name='detalhe'; }
  else if(name!=='detalhe') state.detail=null;
  showScreenWrapped(name);
  window.scrollTo(0,0);
  const sc=$('.screen.active'); if(sc) sc.scrollTop=0;
}
// replace navigate
window.navigate=navigateWrapped;

// patch internal calls: many code calls navigate(...). Since navigate is function declaration (hoisted), reassign the global won't change internal calls unless we redefine. Instead, redefine by overwriting the function via eval? Simpler: keep original navigate but make it call showScreenWrapped.
// Redefine navigate function globally (this shadows the declared one for future calls? The declared function is hoisted; reassigning the binding works since it's a function declaration -> mutable binding in non-strict? In strict mode modules no, but here script mode, function declarations are mutable-ish). 
navigate = navigateWrapped;

init().then(()=>{ /* ready */ });

// Expose for debugging
window.state=state; window.playTrack=playTrack;
