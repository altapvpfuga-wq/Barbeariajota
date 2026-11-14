/* ============================================================
   Music — player de streaming (Audius) com visual YouTube Music
   Catálogo na nuvem • capas reais • busca • download offline
   ============================================================ */
const APP_VERSION = '2.0.0';
const API = 'https://api.audius.co/v1';
const APP_NAME = 'MusicApp';
const FALLBACK = Array.isArray(window.FALLBACK_TRACKS) ? window.FALLBACK_TRACKS : [];

const GRADS = [
  'linear-gradient(135deg,#ff6b6b,#feca57)',
  'linear-gradient(135deg,#48dbfb,#1dd1a1)',
  'linear-gradient(135deg,#a29bfe,#fd79a8)',
  'linear-gradient(135deg,#fdcb6e,#e17055)',
  'linear-gradient(135deg,#00b894,#00cec9)',
  'linear-gradient(135deg,#6c5ce7,#a29bfe)',
  'linear-gradient(135deg,#fab1a0,#ff7675)',
  'linear-gradient(135deg,#81ecec,#74b9ff)',
  'linear-gradient(135deg,#e17055,#fdcb6e)',
  'linear-gradient(135deg,#55efc4,#00b894)',
];
function grad(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GRADS[h % GRADS.length];
}

const MOODS = [
  { label: 'Clima alegre', genres: ['Pop', 'Dance', 'Disco', 'Funk'], grad: 'linear-gradient(135deg,#feca57,#ff6b6b)' },
  { label: 'Foco', genres: ['Lo-Fi', 'Ambient', 'Electronic', 'Jazz'], grad: 'linear-gradient(135deg,#74b9ff,#a29bfe)' },
  { label: 'Em trânsito', genres: ['Hip-Hop/Rap', 'Trap', 'R&B/Soul', 'Pop'], grad: 'linear-gradient(135deg,#1dd1a1,#48dbfb)' },
  { label: 'Games', genres: ['Dubstep', 'Drum & Bass', 'Electronic', 'Experimental'], grad: 'linear-gradient(135deg,#6c5ce7,#fd79a8)' },
  { label: 'Energia', genres: ['House', 'Tech House', 'Techno', 'Dance', 'Electro'], grad: 'linear-gradient(135deg,#fdcb6e,#e17055)' },
  { label: 'Músicas para relaxar', genres: ['Lo-Fi', 'Acoustic', 'Jazz', 'Ambient'], grad: 'linear-gradient(135deg,#00cec9,#00b894)' },
  { label: 'Festa', genres: ['House', 'Dance', 'Funk', 'Disco'], grad: 'linear-gradient(135deg,#ff7675,#fab1a0)' },
  { label: 'Romance', genres: ['R&B/Soul', 'Pop', 'Jazz', 'Acoustic'], grad: 'linear-gradient(135deg,#fd79a8,#a29bfe)' },
];

const CHIPS = ['Em alta', 'Pop', 'Funk', 'Gospel', 'Sertanejo', 'Rock', 'Lo-Fi', 'Eletrônico', 'Jazz', 'Relax', 'Hip-Hop', 'Dance'];

const CFG_ITEMS = [
  { id: 'update', icon: '⬇', title: 'Atualização do sistema' },
  { id: 'aparencia', icon: '🎨', title: 'Aparência' },
  { id: 'conta', icon: '👤', title: 'Conta' },
  { id: 'ouvir', icon: '👥', title: 'Ouvir juntos' },
  { id: 'tocador', icon: '🎧', title: 'Tocador e áudio' },
  { id: 'conteudo', icon: '🎵', title: 'Conteúdo' },
  { id: 'traducao', icon: '🌐', title: 'Tradução de letras por IA' },
  { id: 'privacidade', icon: '🛡', title: 'Privacidade' },
  { id: 'armazenamento', icon: '💾', title: 'Armazenamento' },
  { id: 'backup', icon: '☁', title: 'Backup e restauração' },
  { id: 'sobre', icon: 'ℹ', title: 'Sobre' },
];

// ---------- Estado ----------
const settingsDefault = {
  wifiOnly: false,
  crossfade: false,
  normalize: true,
  showExplicit: true,
  translateLyrics: false,
  analytics: false,
  personalized: true,
  quality: 'alta',
};
function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
const state = {
  route: 'inicio',
  rootTab: 'inicio',
  detail: null,
  navStack: [],
  catalog: [],
  downloads: new Map(),
  downloading: new Map(),
  liked: new Set(readJSON('liked', [])),
  recent: readJSON('recent', []),
  settings: Object.assign({}, settingsDefault, readJSON('settings', {})),
  appearance: localStorage.getItem('theme') || 'escuro',
  searchQuery: '',
  searchFilter: 'Tudo',
  searchToken: 0,
  searching: false,
  libTab: 'playlists',
  settingsSection: null,
  queue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 'off',
  current: null,
  playing: false,
  loading: false,
  playerOpen: false,
  online: navigator.onLine,
  trendingLoaded: false,
};
let audio = null;
let searchTimer = null;
let toastTimer = null;

// ---------- Utils ----------
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg, ms = 2400) {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function fmt(s) {
  s = Math.floor(Number(s) || 0);
  if (!s) return '--:--';
  const m = Math.floor(s / 60), sec = s % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}
function mb(bytes) { return (Number(bytes || 0) / 1048576).toFixed(1) + ' MB'; }
function saveLiked() { try { localStorage.setItem('liked', JSON.stringify([...state.liked])); } catch (e) {} }
function saveRecent() { try { localStorage.setItem('recent', JSON.stringify(state.recent.slice(0, 40))); } catch (e) {} }
function saveSettings() { try { localStorage.setItem('settings', JSON.stringify(state.settings)); } catch (e) {} }

// ---------- Catálogo ----------
function normalizeTracks(list, fallbackGenre) {
  return (Array.isArray(list) ? list : []).map((t) => {
    if (!t || !t.id || !t.title) return null;
    const rawDur = t.duration != null ? t.duration : t.dur;
    const dur = Math.floor(Number(rawDur) || 0);
    if (dur && dur < 30) return null;
    const art = t.art || (t.artwork && (t.artwork['480x480'] || t.artwork['150x150'])) || '';
    if (!art) return null;
    const artist = t.artist || (t.user && (t.user.name || t.user.handle)) || 'Artista';
    return {
      id: String(t.id),
      title: String(t.title).trim(),
      artist: String(artist),
      album: t.album || t.genre || fallbackGenre || 'Audius',
      genre: t.genre || fallbackGenre || 'Música',
      dur: dur || 0,
      art: String(art).replace('150x150', '480x480'),
      fb: t.fb || '',
    };
  }).filter(Boolean);
}
function mergeCatalog(list) {
  if (!Array.isArray(list) || !list.length) return;
  const map = new Map(state.catalog.map((t) => [t.id, t]));
  list.forEach((t) => { if (!map.has(t.id)) map.set(t.id, t); });
  state.catalog = [...map.values()].slice(0, 240);
}
function trackById(id) {
  id = String(id);
  if (state.downloads.has(id)) return state.downloads.get(id);
  return state.catalog.find((t) => t.id === id) || null;
}
function allTracks() {
  const map = new Map();
  state.catalog.forEach((t) => map.set(t.id, t));
  state.downloads.forEach((t, id) => map.set(id, t));
  return [...map.values()];
}
function streamUrl(t) { return `${API}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP_NAME}`; }
function srcFor(t) {
  const d = state.downloads.get(String(t.id));
  if (d && d.url) return d.url;
  return streamUrl(t);
}
function artOf(t) { return (t && (t.artUrl || t.art)) || ''; }

// ---------- IndexedDB (downloads) ----------
const DB_NAME = 'music_offline_v2';
const DB_STORE = 'downloads';
let db = null;
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    if (!('indexedDB' in window)) return reject(new Error('no idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function idbPut(rec) {
  return openDB().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}
function idbAll() {
  return openDB().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, 'readonly');
    const q = tx.objectStore(DB_STORE).getAll();
    q.onsuccess = () => resolve(q.result || []);
    q.onerror = () => reject(q.error);
  }));
}
function idbDelete(id) {
  return openDB().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}
async function loadDownloads() {
  try {
    const recs = await idbAll();
    recs.forEach((rec) => {
      if (!rec || !rec.id || !rec.blob) return;
      const url = URL.createObjectURL(rec.blob);
      const artUrl = rec.artBlob ? URL.createObjectURL(rec.artBlob) : (rec.art || '');
      state.downloads.set(String(rec.id), Object.assign({}, rec, { id: String(rec.id), url, artUrl }));
    });
  } catch (e) { /* sem IndexedDB: segue online */ }
}

// ---------- Nuvem ----------
async function apiFetch(path, timeout = 14000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(API + path, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.data || [];
  } finally { clearTimeout(timer); }
}
async function loadTrending() {
  if (!navigator.onLine) { state.online = false; return; }
  try {
    const data = await apiFetch(`/tracks/trending?app_name=${APP_NAME}&limit=60&time=week`);
    const list = normalizeTracks(data);
    if (list.length) {
      mergeCatalog(list);
      state.trendingLoaded = true;
      state.online = true;
      if (state.route === 'inicio') {
        const sc = $('#screen-inicio');
        const top = sc ? sc.scrollTop : 0;
        renderInicio();
        if (sc) sc.scrollTop = top;
      }
    }
  } catch (e) {
    state.online = navigator.onLine;
    if (state.route === 'inicio') renderInicio();
  }
}

// ---------- Covers ----------
function coverInner(t) {
  const src = artOf(t);
  const fb = (t && t.fb) || '';
  if (src) {
    const onerr = fb ? `this.onerror=null;this.src='${fb}'` : 'this.remove()';
    return `<span class="cover-ph">♪</span><img src="${esc(src)}" alt="" loading="lazy" onerror="${onerr}">`;
  }
  if (fb) return `<span class="cover-ph">♪</span><img src="${fb}" alt="" loading="lazy">`;
  return '<span class="cover-ph">♪</span>';
}
function coverBox(t, cls, extra = '') {
  return `<div class="${cls} cover" style="background:${grad(t && t.id)}" ${extra}>${coverInner(t)}</div>`;
}

// ---------- Áudio ----------
function initAudio() {
  audio = $('#audioEl');
  if (!audio) return;
  audio.addEventListener('timeupdate', updateProgressUI);
  audio.addEventListener('durationchange', updateProgressUI);
  audio.addEventListener('playing', () => {
    state.playing = true; state.loading = false;
    updateMediaSession(); renderPlayerUI(); refreshPlayingRows();
  });
  audio.addEventListener('pause', () => {
    if (audio.ended) return;
    state.playing = false; state.loading = false;
    updateMediaSession(); renderPlayerUI();
  });
  audio.addEventListener('waiting', () => { state.loading = true; renderPlayerUI(); });
  audio.addEventListener('canplay', () => { state.loading = false; renderPlayerUI(); });
  audio.addEventListener('ended', () => {
    if (state.repeat === 'one') { try { audio.currentTime = 0; audio.play(); } catch (e) {} return; }
    next();
  });
  audio.addEventListener('error', () => {
    state.loading = false; state.playing = false;
    renderPlayerUI();
    if (state.current) toast('Não foi possível tocar esta música. Tente outra.');
  });
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('stop', () => pause());
      navigator.mediaSession.setActionHandler('seekto', (e) => { if (e.seekTime != null && isFinite(e.seekTime)) audio.currentTime = e.seekTime; });
      navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
      navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
    } catch (e) {}
  }
}
function playTrack(id, queue) {
  const t = trackById(id);
  if (!t) { toast('Música não encontrada.'); return; }
  if (Array.isArray(queue) && queue.length) state.queue = queue.map(String);
  else if (!state.queue.includes(String(id))) {
    const list = state.catalog.length ? state.catalog.map((x) => x.id) : [...state.downloads.keys()];
    state.queue = list;
  }
  let idx = state.queue.indexOf(String(id));
  if (idx < 0) { state.queue.unshift(String(id)); idx = 0; }
  state.queueIndex = idx;
  state.current = t;
  state.playing = false;
  state.loading = true;

  const src = srcFor(t);
  try { audio.pause(); } catch (e) {}
  audio.src = src;
  audio.load();
  renderPlayerUI();
  refreshPlayingRows();
  updateMediaSession();

  const p = audio.play();
  if (p && typeof p.then === 'function') {
    p.then(() => { state.playing = true; state.loading = false; renderPlayerUI(); refreshPlayingRows(); })
      .catch(() => {
        state.playing = false; state.loading = false;
        renderPlayerUI();
        toast('Toque no ▶ para iniciar a música.');
      });
  }

  state.recent = [String(id), ...state.recent.filter((x) => x !== String(id))].slice(0, 30);
  saveRecent();
}
function play() {
  if (!audio) return;
  if (!state.current) { const first = state.catalog[0] || [...state.downloads.values()][0]; if (first) playTrack(first.id); return; }
  if (!audio.src) { playTrack(state.current.id); return; }
  const p = audio.play();
  if (p && p.then) p.then(() => { state.playing = true; renderPlayerUI(); }).catch(() => {});
}
function pause() {
  if (!audio) return;
  try { audio.pause(); } catch (e) {}
  state.playing = false;
  updateMediaSession();
  renderPlayerUI();
}
function togglePlay() { state.playing ? pause() : play(); }
function next() {
  if (!state.queue.length) return;
  if (state.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  let i = state.queueIndex;
  if (state.shuffle) {
    if (state.queue.length === 1) { playTrack(state.queue[0]); return; }
    do { i = Math.floor(Math.random() * state.queue.length); } while (i === state.queueIndex);
  } else {
    i = i + 1;
    if (i >= state.queue.length) {
      if (state.repeat === 'all') i = 0;
      else { pause(); return; }
    }
  }
  state.queueIndex = i;
  playTrack(state.queue[i]);
}
function prev() {
  if (!state.queue.length) return;
  if (audio && audio.currentTime > 4) { audio.currentTime = 0; return; }
  let i = state.queueIndex - 1;
  if (i < 0) i = state.queue.length - 1;
  state.queueIndex = i;
  playTrack(state.queue[i]);
}
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !state.current) return;
  const t = state.current;
  const art = artOf(t);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album || 'Music',
      artwork: art ? [{ src: art, sizes: '480x480', type: 'image/jpeg' }] : [],
    });
  } catch (e) {}
  try { navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused'; } catch (e) {}
}
function updateProgressUI() {
  if (!audio) return;
  const dur = audio.duration && isFinite(audio.duration) ? audio.duration : (state.current ? state.current.dur : 0);
  const cur = audio.currentTime || 0;
  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;
  const fill = $('#progFill'), thumb = $('#progThumb'), mfill = $('#minipFill');
  if (fill) fill.style.width = pct + '%';
  if (thumb) thumb.style.left = pct + '%';
  if (mfill) mfill.style.width = pct + '%';
  const c = $('#progCur'), d = $('#progDur');
  if (c) c.textContent = fmt(cur);
  if (d) d.textContent = fmt(dur);
}
function refreshPlayingRows() {
  $$('.track[data-play]').forEach((el) => {
    el.classList.toggle('playing', !!state.current && el.dataset.play === state.current.id);
  });
}

// ---------- Player UI ----------
function renderPlayerUI() {
  const t = state.current;
  const mp = $('#minip');
  if (!mp) return;
  if (!t) { mp.style.display = 'none'; return; }
  mp.style.display = 'flex';

  const mc = $('#minipCover');
  if (mc) { mc.style.background = grad(t.id); mc.innerHTML = coverInner(t); }
  const mt = $('#minipTitle'), ma = $('#minipArtist');
  if (mt) mt.textContent = t.title;
  if (ma) ma.textContent = t.artist;

  const pc = $('#playerCover');
  if (pc) { pc.style.background = grad(t.id); pc.innerHTML = coverInner(t); }
  const pt = $('#playerTitle'), pa = $('#playerArtist'), pal = $('#playerAlbum');
  if (pt) pt.textContent = t.title;
  if (pa) pa.textContent = t.artist;
  if (pal) pal.textContent = t.album || 'Music';

  const glyph = state.loading ? '…' : (state.playing ? '❚❚' : '▶');
  const mplay = $('#minipPlay'), pplay = $('#pPlay');
  if (mplay) mplay.textContent = glyph;
  if (pplay) pplay.textContent = glyph;

  const shuffle = $('#pShuffle'), repeat = $('#pRepeat'), like = $('#pLike'), dl = $('#pDownload');
  if (shuffle) shuffle.classList.toggle('active', state.shuffle);
  if (repeat) repeat.classList.toggle('active', state.repeat !== 'off');
  if (like) {
    const on = state.liked.has(t.id);
    like.classList.toggle('active', on);
    like.textContent = on ? '♥' : '♡';
  }
  if (dl) {
    const on = state.downloads.has(t.id);
    dl.classList.toggle('active', on);
    dl.textContent = state.downloading.has(t.id) ? Math.round((state.downloading.get(t.id) || 0)) + '%' : (on ? '✓' : '⬇');
  }
  updateProgressUI();
}
function renderQueueUI() {
  const el = $('#queueList');
  if (!el) return;
  if (!state.queue.length) { el.innerHTML = '<div class="empty">Fila vazia</div>'; return; }
  el.setAttribute('data-qlist', state.queue.join('|'));
  el.innerHTML = state.queue.map((id, i) => {
    const t = trackById(id);
    if (!t) return '';
    return `<div class="track ${state.current && state.current.id === id ? 'playing' : ''}" data-play="${esc(id)}">
      ${coverBox(t, 'track-cover')}
      <div class="track-info"><div class="track-title">${esc(t.title)}</div><div class="track-artist">${esc(t.artist)}</div></div>
      ${i === state.queueIndex ? '<div class="track-dur">▶</div>' : ''}
    </div>`;
  }).join('');
}
function openPlayer() {
  if (!state.current) { toast('Escolha uma música primeiro.'); return; }
  state.playerOpen = true;
  const p = $('#player');
  if (p) p.style.display = 'flex';
  renderPlayerUI();
  renderQueueUI();
}
function closePlayer() {
  state.playerOpen = false;
  const p = $('#player');
  if (p) p.style.display = 'none';
}

// ---------- Render helpers ----------
function trackRow(t, opts = {}) {
  if (!t) return '';
  const isCurrent = state.current && state.current.id === t.id;
  const dl = state.downloads.has(t.id);
  const dlPct = state.downloading.get(t.id);
  const genre = t.genre && t.genre !== t.album ? ` · ${esc(t.genre)}` : '';
  return `<div class="track ${isCurrent ? 'playing' : ''}" data-play="${esc(t.id)}">
    ${coverBox(t, 'track-cover')}
    <div class="track-info">
      <div class="track-title">${esc(t.title)}</div>
      <div class="track-artist">${esc(t.artist)}${genre}${isCurrent ? ' · tocando' : ''}</div>
    </div>
    <div class="track-dur">${fmt(t.dur)}</div>
    ${opts.noDownload ? '' : `<button class="track-more" data-dl="${esc(t.id)}" title="${dl ? 'Baixada' : 'Baixar'}" aria-label="Baixar">${dlPct != null ? Math.round(dlPct) + '%' : (dl ? '✓' : '⬇')}</button>`}
  </div>`;
}
function trackList(tracks, opts = {}) {
  if (!tracks.length) return '<div class="empty">Nenhuma música encontrada.</div>';
  const ids = tracks.map((t) => t.id).join('|');
  return `<div data-qlist="${esc(ids)}">${tracks.map((t) => trackRow(t, opts)).join('')}</div>`;
}
function hcardTrack(t) {
  return `<div class="hcard" data-play="${esc(t.id)}">
    ${coverBox(t, 'hcard-cover')}
    <div class="hcard-title">${esc(t.title)}</div>
    <div class="hcard-sub">${esc(t.artist)}</div>
  </div>`;
}
function hcardPlaylist(p) {
  const first = p.tracks[0];
  return `<div class="hcard" data-open-type="playlist" data-open-key="${esc(p.genre)}">
    ${first ? coverBox(first, 'hcard-cover') : `<div class="hcard-cover cover" style="background:${p.grad}"><span class="cover-ph">♪</span></div>`}
    <div class="hcard-title">${esc(p.name)}</div>
    <div class="hcard-sub">${esc(p.artist)}</div>
  </div>`;
}
function genreGroups() {
  const map = new Map();
  state.catalog.forEach((t) => {
    const g = String(t.genre || 'Outros').trim();
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(t);
  });
  return [...map.entries()]
    .map(([genre, tracks]) => ({ genre, tracks }))
    .filter((x) => x.tracks.length >= 2)
    .sort((a, b) => b.tracks.length - a.tracks.length);
}
function buildPlaylists() {
  const NICE = {
    'Pop': 'Hits do pop nacional',
    'Country': 'Topnejo',
    'Latin': 'Topnejo',
    'Sertanejo': 'Topnejo',
    'R&B/Soul': 'Gospel & Soul',
    'Funk': 'Funk Sessions',
    'Lo-Fi': 'Lo-Fi para focar',
    'Electronic': 'Batidas eletrônicas',
    'House': 'Festa na pista',
    'Tech House': 'Festa na pista',
    'Jazz': 'Jazz & Relax',
    'Hip-Hop/Rap': 'Hip-Hop em alta',
    'Trap': 'Hip-Hop em alta',
    'Dubstep': 'Dubstep pesado',
    'Drum & Bass': 'Drum & Bass',
    'Acoustic': 'Acústico',
    'Dance': 'Dance Hits',
    'Disco': 'Disco & Groove',
  };
  const preferred = ['Pop', 'Country', 'Latin', 'Sertanejo', 'R&B/Soul', 'Funk', 'Lo-Fi', 'Electronic', 'House', 'Jazz'];
  const groups = genreGroups().sort((a, b) => {
    const ia = preferred.indexOf(a.genre), ib = preferred.indexOf(b.genre);
    if (ia < 0 && ib < 0) return b.tracks.length - a.tracks.length;
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  });
  const out = groups.slice(0, 7).map((g, i) => ({
    id: 'pl-' + i,
    genre: g.genre,
    name: NICE[g.genre] || ('Mix de ' + g.genre),
    artist: g.tracks[0] ? g.tracks[0].artist : 'Music',
    tracks: g.tracks,
  }));
  if (state.catalog.length >= 6) {
    const picks = [...state.catalog].filter((t, i) => i % 3 === 0).slice(0, 14);
    out.splice(Math.min(3, out.length), 0, {
      id: 'pl-disc', genre: '__discover__', name: 'Descobertas da semana', artist: 'Para você', tracks: picks, discover: true,
    });
  }
  return out;
}

// ---------- Telas ----------
function screenEl(name) { return $('#screen-' + name); }
function showScreen(name) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  const el = screenEl(name);
  if (el) el.classList.add('active');
  state.route = name;
  updateShell();
  renderCurrent();
}
function updateShell() {
  const titles = { inicio: 'Início', pesquisar: 'Pesquisar', biblioteca: 'Biblioteca', config: 'Configurações', detalhe: state.detail ? state.detail.title : '' };
  const title = $('#topTitle');
  if (title) title.textContent = titles[state.route] || '';
  const back = $('#btnBack');
  if (back) back.style.display = (state.route !== 'inicio' || state.settingsSection) ? 'inline-flex' : 'none';
  $$('.bn-item').forEach((b) => b.classList.toggle('active', b.dataset.route === state.rootTab));
  const tr = $('#topRight');
  if (tr) {
    if (state.route === 'inicio') {
      tr.innerHTML = `
        <button class="ico-btn" data-top="recent" title="Tocadas recentemente">🕐</button>
        <button class="ico-btn" data-top="search" title="Pesquisar">🔍</button>
        <button class="ico-btn" data-top="together" title="Ouvir juntos">👥</button>
        <button class="ico-btn" data-top="settings" title="Configurações">⚙️</button>`;
    } else if (state.route === 'pesquisar') {
      tr.innerHTML = `<button class="ico-btn" data-top="settings" title="Configurações">⚙️</button>`;
    } else tr.innerHTML = '';
  }
  // FAB somente no início
  let fab = $('#fabWrap');
  if (state.route === 'inicio') {
    if (!fab) {
      fab = document.createElement('div');
      fab.id = 'fabWrap'; fab.className = 'fab-wrap';
      fab.innerHTML = `<button class="fab mic" id="fabMic" title="Pesquisar">🔍</button><button class="fab shuffle" id="fabShuffle" title="Rádio aleatório">🔀</button>`;
      document.body.appendChild(fab);
      $('#fabMic').addEventListener('click', () => { state.rootTab = 'pesquisar'; showScreen('pesquisar'); });
      $('#fabShuffle').addEventListener('click', () => {
        const pool = allTracks();
        if (!pool.length) { toast('Catálogo carregando…'); return; }
        const ids = pool.map((t) => t.id).sort(() => Math.random() - 0.5);
        state.shuffle = true;
        playTrack(ids[0], ids);
        toast('Rádio aleatório iniciado');
      });
    }
    fab.style.display = 'flex';
  } else if (fab) fab.style.display = 'none';
}
function renderCurrent() {
  if (state.route === 'inicio') renderInicio();
  else if (state.route === 'pesquisar') renderPesquisar();
  else if (state.route === 'biblioteca') renderBiblioteca();
  else if (state.route === 'config') renderConfig();
  else if (state.route === 'detalhe') renderDetalhe();
}

// ---------- Início ----------
function renderInicio() {
  const el = screenEl('inicio');
  if (!el) return;
  const hasCatalog = state.catalog.length > 0;
  const playlists = buildPlaylists();
  const launches = state.catalog.slice(0, 8);
  const recommended = state.catalog.slice(8, 26);
  const chips = CHIPS.map((c, i) => `<div class="chip ${i === 0 ? 'active' : ''}" data-chip="${esc(c)}">${esc(c)}</div>`).join('');

  el.innerHTML = `
    ${!state.online ? '<div class="offline-banner">Sem internet — mostrando o catálogo salvo. Baixe músicas para ouvir offline.</div>' : ''}
    <div class="chips">${chips}</div>

    <div class="section">
      <div class="section-head"><h2 class="section-title">Momentos e Gêneros</h2><button class="section-arrow" data-open-type="all" data-open-key="Momentos">›</button></div>
      <div class="grid2">
        ${MOODS.map((m) => `<div class="moment-card" style="background:${m.grad}" data-open-type="mood" data-open-key="${esc(m.label)}"><span>${esc(m.label)}</span></div>`).join('')}
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2 class="section-title">Perfeitas para o fim de semana</h2><button class="section-arrow" data-open-type="all" data-open-key="Playlists">›</button></div>
      <div class="hscroll">${playlists.map(hcardPlaylist).join('')}</div>
    </div>

    <div class="section">
      <div class="section-head"><h2 class="section-title">Lançamentos</h2><button class="section-arrow" data-open-type="all" data-open-key="Lançamentos">›</button></div>
      <div class="hscroll">${launches.map(hcardTrack).join('') || '<div class="empty">Carregando catálogo…</div>'}</div>
    </div>

    <div class="section">
      <div class="section-head"><h2 class="section-title">Recomendado para você</h2><button class="section-arrow" data-open-type="all" data-open-key="Recomendado">›</button></div>
      ${hasCatalog ? trackList(recommended.length ? recommended : state.catalog.slice(0, 12)) : '<div class="empty">Buscando músicas na nuvem…<br><span class="spinner"></span></div>'}
    </div>

    ${state.recent.length ? `<div class="section">
      <div class="section-head"><h2 class="section-title">Tocadas recentemente</h2><button class="section-arrow" data-open-type="recent" data-open-key="Recentes">›</button></div>
      ${trackList(state.recent.map(trackById).filter(Boolean).slice(0, 5))}
    </div>` : ''}
  `;
}
function renderPesquisar() {
  const el = screenEl('pesquisar');
  if (!el) return;
  el.innerHTML = `
    <div class="search-bar">
      <span class="search-ico">🔍</span>
      <input class="input search-input" id="searchInput" type="search" placeholder="O que você quer ouvir?" value="${esc(state.searchQuery)}" autocomplete="off" enterkeyhint="search">
      <button class="search-clear" id="searchClear" aria-label="Limpar" style="${state.searchQuery ? '' : 'display:none'}">×</button>
    </div>
    <div class="chips search-filters">
      ${['Tudo', 'Músicas', 'Álbuns', 'Artistas', 'Playlists'].map((c) => `<div class="chip ${state.searchFilter === c ? 'active' : ''}" data-filter="${c}">${c}</div>`).join('')}
    </div>
    <div id="searchBody"></div>
  `;
  const input = $('#searchInput');
  input.addEventListener('input', () => {
    state.searchQuery = input.value;
    const clr = $('#searchClear'); if (clr) clr.style.display = input.value ? 'block' : 'none';
    renderSearchBody();
    clearTimeout(searchTimer);
    const q = state.searchQuery.trim();
    if (q.length >= 2) searchTimer = setTimeout(() => runSearch(q), 450);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); runSearch(state.searchQuery.trim()); }
  });
  $('#searchClear').addEventListener('click', () => {
    state.searchQuery = ''; input.value = ''; $('#searchClear').style.display = 'none';
    input.focus(); renderSearchBody();
  });
  renderSearchBody();
}
function renderSearchBody() {
  const el = $('#searchBody');
  if (!el || state.route !== 'pesquisar') return;
  const q = state.searchQuery.trim();
  const filter = state.searchFilter;
  const all = allTracks();

  if (!q) {
    const groups = genreGroups().slice(0, 6);
    el.innerHTML = `
      ${state.recent.length ? `<div class="section"><div class="section-head"><h2 class="section-title">Tocadas recentemente</h2></div>
        ${trackList(state.recent.map(trackById).filter(Boolean).slice(0, 5), { noDownload: true })}</div>` : ''}
      <div class="section"><div class="section-head"><h2 class="section-title">Em alta agora</h2></div>
        <div class="hscroll">${all.slice(0, 8).map(hcardTrack).join('') || '<div class="empty">Carregando…</div>'}</div></div>
      <div class="section"><div class="section-head"><h2 class="section-title">Navegar por gêneros</h2></div>
        <div class="grid2">${MOODS.map((m) => `<div class="moment-card" style="background:${m.grad};height:70px" data-open-type="mood" data-open-key="${esc(m.label)}"><span>${esc(m.label)}</span></div>`).join('')}</div></div>
      <div class="section"><div class="section-head"><h2 class="section-title">Gêneros</h2></div>
        <div class="chips">${groups.map((g) => `<div class="chip" data-open-type="genre" data-open-key="${esc(g.genre)}">${esc(g.genre)}</div>`).join('')}</div></div>
    `;
    return;
  }

  const ql = q.toLowerCase();
  const match = (t) => (t.title + ' ' + t.artist + ' ' + (t.genre || '') + ' ' + (t.album || '')).toLowerCase().includes(ql);
  const tracks = all.filter(match);
  const spinner = state.searching ? '<div class="search-status"><span class="spinner"></span> Buscando na nuvem…</div>' : '';

  if (filter === 'Artistas') {
    const artists = [...new Set(tracks.map((t) => t.artist))].filter((a) => a.toLowerCase().includes(ql));
    el.innerHTML = spinner + `<div class="section"><div class="section-head"><h2 class="section-title">Artistas</h2></div>
      ${artists.length ? artists.map((a) => {
        const t = tracks.find((x) => x.artist === a);
        return `<div class="track" data-open-type="artist" data-open-key="${esc(a)}">
          ${coverBox(t, 'track-cover artist-round')}
          <div class="track-info"><div class="track-title">${esc(a)}</div><div class="track-artist">${tracks.filter((x) => x.artist === a).length} músicas</div></div>
          <div class="track-dur">›</div></div>`;
      }).join('') : '<div class="empty">Nenhum artista encontrado.</div>'}</div>`;
    return;
  }
  if (filter === 'Álbuns') {
    const albums = [...new Set(tracks.map((t) => t.album || t.genre))].filter(Boolean);
    el.innerHTML = spinner + `<div class="section"><div class="section-head"><h2 class="section-title">Álbuns</h2></div>
      ${albums.length ? albums.map((a) => {
        const t = tracks.find((x) => (x.album || x.genre) === a);
        return `<div class="track" data-open-type="album" data-open-key="${esc(a)}">
          ${coverBox(t, 'track-cover')}
          <div class="track-info"><div class="track-title">${esc(a)}</div><div class="track-artist">${tracks.filter((x) => (x.album || x.genre) === a).length} músicas</div></div>
          <div class="track-dur">›</div></div>`;
      }).join('') : '<div class="empty">Nenhum álbum encontrado.</div>'}</div>`;
    return;
  }
  if (filter === 'Playlists') {
    const pls = buildPlaylists().filter((p) => (p.name + ' ' + p.genre).toLowerCase().includes(ql));
    el.innerHTML = spinner + `<div class="section"><div class="section-head"><h2 class="section-title">Playlists</h2></div>
      ${pls.length ? pls.map((p) => `<div class="track" data-open-type="playlist" data-open-key="${esc(p.genre)}">
        ${coverBox(p.tracks[0], 'track-cover')}
        <div class="track-info"><div class="track-title">${esc(p.name)}</div><div class="track-artist">${p.tracks.length} músicas · ${esc(p.artist)}</div></div>
        <div class="track-dur">›</div></div>`).join('') : '<div class="empty">Nenhuma playlist encontrada.</div>'}</div>`;
    return;
  }

  // Tudo / Músicas
  const list = tracks.slice(0, 40);
  el.innerHTML = `${spinner}
    ${list.length ? `<div class="section"><div class="section-head"><h2 class="section-title">Músicas</h2><span class="section-count">${tracks.length}</span></div>${trackList(list)}</div>`
      : (state.searching ? '' : '<div class="empty">Nada encontrado.<br>Tente outro nome ou verifique sua conexão.</div>')}`;
}
async function runSearch(q) {
  if (!q || q.length < 2) return;
  const token = ++state.searchToken;
  state.searching = true;
  renderSearchBody();
  try {
    const data = await apiFetch(`/tracks/search?query=${encodeURIComponent(q)}&app_name=${APP_NAME}&limit=30`);
    if (token !== state.searchToken) return;
    const list = normalizeTracks(data);
    mergeCatalog(list);
    state.online = true;
  } catch (e) {
    if (token === state.searchToken) state.online = navigator.onLine;
  }
  state.searching = false;
  if (token === state.searchToken && state.route === 'pesquisar') renderSearchBody();
}

// ---------- Biblioteca ----------
function renderBiblioteca() {
  const el = screenEl('biblioteca');
  if (!el) return;
  const tabs = [
    { id: 'playlists', label: 'Playlists' },
    { id: 'downloads', label: 'Downloads' },
    { id: 'favoritos', label: 'Favoritos' },
    { id: 'artistas', label: 'Artistas' },
  ];
  el.innerHTML = `
    <div class="lib-tabs">${tabs.map((t) => `<button class="lib-tab ${state.libTab === t.id ? 'active' : ''}" data-lib="${t.id}">${t.label}</button>`).join('')}</div>
    <div id="libContent"></div>
  `;
  const content = $('#libContent');
  if (!content) return;
  if (state.libTab === 'downloads') {
    const list = [...state.downloads.values()];
    const total = list.reduce((s, t) => s + (t.size || t.blob?.size || 0), 0);
    content.innerHTML = `
      <div class="storage-summary"><div><b>${list.length}</b> música(s) baixada(s)</div><div class="cfg-sub">${mb(total)} usados no aparelho</div></div>
      ${list.length ? `<div data-qlist="${esc(list.map((t) => t.id).join('|'))}">${list.map((t) => `<div class="track" data-play="${esc(t.id)}">
        ${coverBox(t, 'track-cover')}
        <div class="track-info"><div class="track-title">${esc(t.title)}</div><div class="track-artist">${esc(t.artist)} · ${mb(t.size || t.blob?.size || 0)}</div></div>
        <button class="track-more" data-remove="${esc(t.id)}" title="Remover">🗑</button>
      </div>`).join('')}</div>` : '<div class="empty">Nenhuma música baixada ainda.<br>Toque em ⬇ em uma música para ouvir offline.</div>'}`;
    return;
  }
  if (state.libTab === 'favoritos') {
    const list = [...state.liked].map(trackById).filter(Boolean);
    content.innerHTML = list.length
      ? `<div data-qlist="${esc(list.map((t) => t.id).join('|'))}">${list.map((t) => trackRow(t)).join('')}</div>`
      : '<div class="empty">Nenhuma música favorita ainda.<br>Toque no ♡ no player para favoritar.</div>';
    return;
  }
  if (state.libTab === 'artistas') {
    const map = new Map();
    allTracks().forEach((t) => { if (!map.has(t.artist)) map.set(t.artist, []); map.get(t.artist).push(t); });
    const artists = [...map.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 60);
    content.innerHTML = artists.length ? artists.map(([name, tracks]) => `<div class="track" data-open-type="artist" data-open-key="${esc(name)}">
      ${coverBox(tracks[0], 'track-cover artist-round')}
      <div class="track-info"><div class="track-title">${esc(name)}</div><div class="track-artist">${tracks.length} músicas</div></div>
      <div class="track-dur">›</div></div>`).join('') : '<div class="empty">Nenhum artista.</div>';
    return;
  }
  // playlists
  const pls = buildPlaylists();
  content.innerHTML = pls.length ? pls.map((p) => `<div class="track" data-open-type="playlist" data-open-key="${esc(p.genre)}">
    ${coverBox(p.tracks[0], 'track-cover')}
    <div class="track-info"><div class="track-title">${esc(p.name)}</div><div class="track-artist">${p.tracks.length} músicas · ${esc(p.artist)}</div></div>
    <div class="track-dur">›</div></div>`).join('') : '<div class="empty">Catálogo carregando…</div>';
}

// ---------- Detalhe ----------
function detailTracks(d) {
  if (!d) return [];
  const all = allTracks();
  if (d.type === 'playlist') {
    if (d.key === '__discover__') return all.filter((t, i) => i % 3 === 0).slice(0, 20);
    return all.filter((t) => (t.genre || '').toLowerCase() === d.key.toLowerCase());
  }
  if (d.type === 'genre') {
    const k = d.key.toLowerCase();
    let list = all.filter((t) => (t.genre || '').toLowerCase() === k);
    if (!list.length) list = all.filter((t) => (t.genre || '').toLowerCase().includes(k) || (t.title + ' ' + t.artist).toLowerCase().includes(k));
    return list.length ? list : all.slice(0, 12);
  }
  if (d.type === 'mood') {
    const mood = MOODS.find((m) => m.label === d.key);
    const keys = mood ? mood.genres.map((g) => g.toLowerCase()) : [d.key.toLowerCase()];
    let list = all.filter((t) => keys.some((k) => (t.genre || '').toLowerCase().includes(k)));
    if (list.length < 4) {
      const extra = all.filter((t) => (t.title + ' ' + (t.genre || '') + ' ' + t.artist).toLowerCase().includes(d.key.toLowerCase()));
      list = [...new Map([...list, ...extra].map((t) => [t.id, t])).values()];
    }
    return list.length ? list : all.slice(0, 12);
  }
  if (d.type === 'album') return all.filter((t) => (t.album || t.genre) === d.key);
  if (d.type === 'artist') return all.filter((t) => t.artist === d.key);
  if (d.type === 'recent') return state.recent.map(trackById).filter(Boolean);
  if (d.type === 'all') return all.slice(0, 60);
  return all.slice(0, 30);
}
function openDetail(type, key) {
  const special = type === 'playlist' && key === '__discover__' ? 'Descobertas da semana' : key;
  const titles = { playlist: special, genre: key, mood: key, album: key, artist: key, recent: 'Tocadas recentemente', all: key || 'Tudo' };
  state.navStack.push({ route: state.route, detail: state.detail });
  state.detail = { type, key, title: titles[type] || key || 'Music' };
  showScreen('detalhe');
  const sc = screenEl('detalhe'); if (sc) sc.scrollTop = 0;
}
function renderDetalhe() {
  const el = screenEl('detalhe');
  if (!el) return;
  const d = state.detail;
  if (!d) { showScreen('inicio'); return; }
  const tracks = detailTracks(d);
  const first = tracks[0];
  const subtitle = d.type === 'artist' ? `Artista · ${tracks.length} músicas` : `${tracks.length} música(s)`;
  el.innerHTML = `
    <div class="hero">
      ${first ? coverBox(first, 'hero-cover') : `<div class="hero-cover cover" style="background:${grad(d.key)}"><span class="cover-ph">♪</span></div>`}
      <div class="hero-title">${esc(d.title)}</div>
      <div class="hero-sub">${esc(subtitle)}</div>
      <div class="play-all">
        <button class="btn" id="playAll">▶ Tocar tudo</button>
        <button class="btn ghost" id="shuffleAll">🔀 Aleatório</button>
      </div>
    </div>
    <div id="detailList">${trackList(tracks)}</div>
  `;
  const ids = tracks.map((t) => t.id);
  const playAll = $('#playAll');
  if (playAll) playAll.addEventListener('click', () => { if (!ids.length) return; state.shuffle = false; state.queue = ids; playTrack(ids[0], ids); });
  const sh = $('#shuffleAll');
  if (sh) sh.addEventListener('click', () => {
    if (!ids.length) return;
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    state.shuffle = true; state.queue = shuffled; playTrack(shuffled[0], shuffled); toast('Aleatório ativado');
  });
}

// ---------- Configurações ----------
function cfgSub(id) {
  if (id === 'update') return 'Você está na versão mais recente';
  if (id === 'aparencia') return state.appearance.charAt(0).toUpperCase() + state.appearance.slice(1);
  if (id === 'conta') return 'Não conectado';
  if (id === 'ouvir') return 'Sessão compartilhada';
  if (id === 'tocador') return 'Qualidade, crossfade';
  if (id === 'conteudo') return 'Downloads e preferências';
  if (id === 'traducao') return state.settings.translateLyrics ? 'Ativado' : 'Desativado';
  if (id === 'privacidade') return 'Dados e permissões';
  if (id === 'armazenamento') return `${state.downloads.size} baixada(s) · ${mb(downloadsSize())}`;
  if (id === 'backup') return 'Backup dos seus dados';
  if (id === 'sobre') return 'Versão ' + APP_VERSION;
  return '';
}
function downloadsSize() {
  let n = 0;
  state.downloads.forEach((t) => { n += t.size || t.blob?.size || 0; });
  return n;
}
function renderConfig() {
  const el = screenEl('config');
  if (!el) return;
  if (state.settingsSection) { renderConfigDetail(el); return; }
  el.innerHTML = `<div class="cfg-list">${CFG_ITEMS.map((c) => `
    <div class="cfg-item" data-cfg="${c.id}">
      <div class="cfg-icon">${c.icon}</div>
      <div class="cfg-text"><div class="cfg-title">${c.title}</div><div class="cfg-sub ${c.id === 'update' ? 'cfg-update' : ''}">${esc(cfgSub(c.id))}</div></div>
      <div class="cfg-arrow">›</div>
    </div>`).join('')}</div>`;
}
function setRow(key, label, sub) {
  const on = !!state.settings[key];
  return `<div class="set-row" data-set="${key}" data-val="${on ? '0' : '1'}">
    <div><div class="set-label">${label}</div>${sub ? `<div class="set-sub">${sub}</div>` : ''}</div>
    <div class="switch ${on ? 'on' : ''}"><span></span></div>
  </div>`;
}
function renderConfigDetail(el) {
  const id = state.settingsSection;
  let body = '';
  if (id === 'update') {
    body = `<div class="card"><div class="cfg-update" style="font-weight:700;font-size:16px">Music está atualizado</div>
      <p class="cfg-sub">Versão ${APP_VERSION} · catálogo na nuvem ativo.</p>
      <button class="btn" style="margin-top:12px" data-action="checkUpdate">Verificar novamente</button></div>`;
  } else if (id === 'aparencia') {
    body = `<div class="card"><p class="card-title">Tema</p>
      <div class="btn-row">${['escuro', 'claro', 'sistema'].map((t) => `<button class="btn ${state.appearance === t ? '' : 'ghost'}" data-set="appearance" data-val="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <p class="cfg-sub" style="margin-top:12px">O tema claro usa cores mais suaves para ambientes iluminados.</p></div>`;
  } else if (id === 'conta') {
    body = `<div class="card account-card">
      <div class="avatar">🎧</div>
      <div class="card-title">Você não está conectado</div>
      <p class="cfg-sub">Ouça músicas e baixe para offline sem precisar de conta. O catálogo vem da nuvem (Audius).</p>
      <button class="btn" style="margin-top:12px" data-action="signIn">Entrar</button>
    </div>
    <div class="card"><div class="set-label">Reprodução sem conta</div><div class="cfg-sub">Ativada — todo o catálogo está disponível.</div></div>`;
  } else if (id === 'ouvir') {
    body = `<div class="card"><div class="card-title">Ouvir juntos</div>
      <p class="cfg-sub">Crie uma sessão e compartilhe o código com seus amigos para ouvirem a mesma fila.</p>
      <button class="btn" style="margin-top:12px" data-action="together">Criar sessão</button></div>
    <div class="card"><div class="set-label">Sessão ativa</div><div class="cfg-sub">Nenhuma sessão ativa no momento.</div></div>`;
  } else if (id === 'tocador') {
    body = `<div class="card"><p class="card-title">Qualidade do streaming</p>
      <div class="btn-row">${['normal', 'alta', 'sempre alta'].map((q) => `<button class="btn ${state.settings.quality === q ? '' : 'ghost'}" data-set="quality" data-val="${q}">${q}</button>`).join('')}</div></div>
      <div class="card">${setRow('crossfade', 'Crossfade', 'Transição suave entre músicas')}${setRow('normalize', 'Normalizar volume', 'Mantém o volume constante')}</div>`;
  } else if (id === 'conteudo') {
    body = `<div class="card">${setRow('wifiOnly', 'Baixar apenas via Wi-Fi', 'Evita usar seus dados móveis')}${setRow('showExplicit', 'Mostrar conteúdo explícito', 'Pode ocultar faixas marcadas')}${setRow('personalized', 'Recomendações personalizadas', 'Baseadas no que você ouve')}</div>`;
  } else if (id === 'traducao') {
    body = `<div class="card">${setRow('translateLyrics', 'Tradução de letras por IA', 'Traduz as letras automaticamente para português')}
      <p class="cfg-sub" style="margin-top:12px">As letras traduzidas aparecem no player quando disponíveis.</p></div>`;
  } else if (id === 'privacidade') {
    body = `<div class="card">${setRow('analytics', 'Enviar dados de uso', 'Ajuda a melhorar o aplicativo')}
      <div class="set-row" data-action="clearRecent"><div><div class="set-label">Limpar histórico</div><div class="set-sub">Remove as músicas tocadas recentemente</div></div><div class="cfg-arrow">›</div></div>
      <div class="set-row" data-action="clearAll"><div><div class="set-label" style="color:var(--red)">Apagar todos os dados</div><div class="set-sub">Downloads, favoritos e histórico</div></div><div class="cfg-arrow">›</div></div></div>`;
  } else if (id === 'armazenamento') {
    const list = [...state.downloads.values()];
    body = `<div class="card"><div class="card-title">Armazenamento</div>
      <p class="cfg-sub">${list.length} música(s) baixada(s) · ${mb(downloadsSize())}</p>
      <button class="btn danger" style="margin-top:12px" data-action="clearDownloads">Limpar downloads</button></div>
      ${list.length ? list.map((t) => `<div class="track" data-play="${esc(t.id)}">
        ${coverBox(t, 'track-cover')}
        <div class="track-info"><div class="track-title">${esc(t.title)}</div><div class="track-artist">${esc(t.artist)} · ${mb(t.size || t.blob?.size || 0)}</div></div>
        <button class="track-more" data-remove="${esc(t.id)}">🗑</button></div>`).join('') : '<div class="empty">Nenhum download.</div>'}`;
  } else if (id === 'backup') {
    body = `<div class="card"><div class="card-title">Backup e restauração</div>
      <p class="cfg-sub">Copie um backup dos favoritos e preferências. Os arquivos baixados não entram no backup.</p>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-action="backup">Copiar backup</button><button class="btn ghost" data-action="restore">Restaurar</button></div></div>`;
  } else if (id === 'sobre') {
    body = `<div class="card"><div class="app-logo">🎵</div><div class="card-title" style="font-size:20px">Music</div>
      <p class="cfg-sub">Versão ${APP_VERSION}</p>
      <p class="cfg-sub">Streaming e download de músicas da nuvem.</p>
      <p class="cfg-sub" style="margin-top:10px">Catálogo: Audius (música independente e gratuita).</p>
      <p class="cfg-sub">${state.catalog.length} músicas carregadas · ${state.downloads.size} baixadas.</p></div>`;
  }
  el.innerHTML = body;
}
function applyTheme(mode) {
  let m = mode;
  if (m === 'sistema') {
    m = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'claro' : 'escuro';
  }
  document.documentElement.dataset.theme = m === 'claro' ? 'light' : 'dark';
}
function applySetting(key, val) {
  if (key === 'appearance') {
    state.appearance = val;
    try { localStorage.setItem('theme', val); } catch (e) {}
    applyTheme(val);
    toast('Tema: ' + val);
    renderConfig();
    return;
  }
  if (key === 'quality') {
    state.settings.quality = val;
  } else {
    state.settings[key] = val === '1' ? true : val === '0' ? false : val;
  }
  saveSettings();
  renderConfig();
}

// ---------- Ações ----------
async function downloadTrack(id, silent) {
  const t = trackById(id);
  if (!t) return;
  if (state.downloads.has(String(id))) { if (!silent) toast('Essa música já está baixada.'); return; }
  if (state.downloading.has(String(id))) return;
  state.downloading.set(String(id), 0);
  renderPlayerUI();
  refreshDownloadButtons();
  if (!silent) toast('Baixando: ' + t.title);

  try {
    const res = await fetch(streamUrl(t));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || (t.dur ? t.dur * 16000 : 0);
    let blob;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) {
          state.downloading.set(String(id), Math.min(99, Math.round((received / total) * 100)));
          updateDownloadButton(id);
        }
      }
      blob = new Blob(chunks, { type: 'audio/mpeg' });
    } else {
      blob = await res.blob();
    }
    if (!blob || blob.size < 20000) throw new Error('arquivo inválido');

    let artBlob = null;
    const art = artOf(t);
    if (art) {
      try {
        const ar = await fetch(art);
        if (ar.ok) artBlob = await ar.blob();
      } catch (e) {}
    }
    const rec = {
      id: String(t.id), title: t.title, artist: t.artist, album: t.album, genre: t.genre,
      dur: t.dur, art: t.art, fb: t.fb || '', artBlob, blob, size: blob.size, createdAt: Date.now(),
    };
    await idbPut(rec);
    const url = URL.createObjectURL(blob);
    const artUrl = artBlob ? URL.createObjectURL(artBlob) : (t.art || '');
    state.downloads.set(String(t.id), Object.assign({}, rec, { url, artUrl }));
    toast('Baixada: ' + t.title + ' (offline)');
  } catch (e) {
    toast('Não foi possível baixar. Verifique a internet.');
  }
  state.downloading.delete(String(id));
  renderPlayerUI();
  refreshDownloadButtons();
  if (state.route === 'inicio' || state.route === 'biblioteca' || state.route === 'config' || state.route === 'detalhe') renderCurrent();
}
function updateDownloadButton(id) {
  const pct = state.downloading.get(String(id));
  $$(`[data-dl="${String(id)}"]`).forEach((b) => { b.textContent = pct != null ? Math.round(pct) + '%' : '⬇'; });
}
function refreshDownloadButtons() {
  $$('[data-dl]').forEach((b) => {
    const id = b.dataset.dl;
    const pct = state.downloading.get(id);
    b.textContent = pct != null ? Math.round(pct) + '%' : (state.downloads.has(id) ? '✓' : '⬇');
    b.title = state.downloads.has(id) ? 'Baixada' : 'Baixar';
  });
}
async function removeDownload(id) {
  id = String(id);
  const rec = state.downloads.get(id);
  if (!rec) return;
  if (state.current && state.current.id === id) {
    try { audio.pause(); } catch (e) {}
    state.playing = false;
    try { audio.removeAttribute('src'); audio.load(); } catch (e) {}
  }
  try { await idbDelete(id); } catch (e) {}
  if (rec.url) { try { URL.revokeObjectURL(rec.url); } catch (e) {} }
  if (rec.artUrl && String(rec.artUrl).startsWith('blob:')) { try { URL.revokeObjectURL(rec.artUrl); } catch (e) {} }
  state.downloads.delete(id);
  toast('Download removido');
  renderPlayerUI();
  renderCurrent();
}
async function clearDownloads(skipConfirm) {
  if (!state.downloads.size) { toast('Nenhum download para limpar.'); return; }
  const ids = [...state.downloads.keys()];
  for (const id of ids) {
    const rec = state.downloads.get(id);
    if (rec.url) { try { URL.revokeObjectURL(rec.url); } catch (e) {} }
    if (rec.artUrl && String(rec.artUrl).startsWith('blob:')) { try { URL.revokeObjectURL(rec.artUrl); } catch (e) {} }
    try { await idbDelete(id); } catch (e) {}
  }
  state.downloads.clear();
  if (state.current && state.current.id && !state.catalog.find((t) => t.id === state.current.id)) {
    try { audio.pause(); } catch (e) {}
    state.playing = false;
    try { audio.removeAttribute('src'); audio.load(); } catch (e) {}
    state.current = null;
  }
  toast('Downloads removidos');
  renderPlayerUI();
  renderCurrent();
}
function toastAction(msg) { toast(msg); }
function handleAction(action) {
  if (action === 'checkUpdate') toast('Você está na versão mais recente.');
  else if (action === 'signIn') toast('Conta opcional: streaming liberado sem login.');
  else if (action === 'together') toast('Sessão criada! Código: MUSIC-' + Math.random().toString(36).slice(2, 6).toUpperCase());
  else if (action === 'clearRecent') { state.recent = []; saveRecent(); toast('Histórico limpo'); renderConfig(); }
  else if (action === 'clearAll') {
    clearDownloads(true).then(() => {
      state.liked.clear(); saveLiked();
      state.recent = []; saveRecent();
      state.settings = Object.assign({}, settingsDefault); saveSettings();
      toast('Dados apagados'); renderConfig();
    });
  }
  else if (action === 'clearDownloads') clearDownloads();
  else if (action === 'backup') {
    const data = { app: 'Music', version: APP_VERSION, liked: [...state.liked], settings: state.settings, appearance: state.appearance, recent: state.recent };
    const text = JSON.stringify(data);
    const done = () => toast('Backup copiado para a área de transferência.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => prompt('Copie seu backup:', text));
    else prompt('Copie seu backup:', text);
  }
  else if (action === 'restore') {
    const text = prompt('Cole o backup para restaurar:');
    if (!text) return;
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data.liked)) { state.liked = new Set(data.liked); saveLiked(); }
      if (data.settings) { state.settings = Object.assign({}, settingsDefault, data.settings); saveSettings(); }
      if (data.appearance) { state.appearance = data.appearance; try { localStorage.setItem('theme', data.appearance); } catch (e) {} applyTheme(data.appearance); }
      if (Array.isArray(data.recent)) { state.recent = data.recent; saveRecent(); }
      toast('Backup restaurado');
      renderConfig();
    } catch (e) { toast('Backup inválido.'); }
  }
}

// ---------- Registro global de cliques ----------
document.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-remove]');
  if (rm) { e.stopPropagation(); e.preventDefault(); removeDownload(rm.dataset.remove); return; }

  const dl = e.target.closest('[data-dl]');
  if (dl) { e.stopPropagation(); e.preventDefault(); downloadTrack(dl.dataset.dl); return; }

  const pl = e.target.closest('[data-play]');
  if (pl) {
    const host = pl.closest('[data-qlist]');
    const q = host && host.dataset.qlist ? host.dataset.qlist.split('|').filter(Boolean) : null;
    playTrack(pl.dataset.play, q);
    return;
  }

  const filter = e.target.closest('[data-filter]');
  if (filter) {
    state.searchFilter = filter.dataset.filter;
    $$('[data-filter]').forEach((c) => c.classList.toggle('active', c.dataset.filter === state.searchFilter));
    renderSearchBody();
    return;
  }

  const cfg = e.target.closest('[data-cfg]');
  if (cfg) { state.settingsSection = cfg.dataset.cfg; renderConfig(); updateShell(); return; }

  const setBtn = e.target.closest('[data-set]');
  if (setBtn) { applySetting(setBtn.dataset.set, setBtn.dataset.val); return; }

  const action = e.target.closest('[data-action]');
  if (action) { handleAction(action.dataset.action); return; }

  const open = e.target.closest('[data-open-type]');
  if (open) { openDetail(open.dataset.openType, open.dataset.openKey); return; }

  const chip = e.target.closest('[data-chip]');
  if (chip) {
    const label = chip.dataset.chip;
    const map = { 'Eletrônico': 'Electronic', 'Hip-Hop': 'Hip-Hop/Rap', 'Relax': 'Lo-Fi', 'Rock': 'Alternative', 'Gospel': 'R&B/Soul' };
    if (label === 'Em alta') openDetail('all', 'Em alta');
    else if (label === 'Relax') openDetail('mood', 'Músicas para relaxar');
    else openDetail('genre', map[label] || label);
    return;
  }

  const lib = e.target.closest('[data-lib]');
  if (lib) { state.libTab = lib.dataset.lib; renderBiblioteca(); return; }

  const top = e.target.closest('[data-top]');
  if (top) {
    const a = top.dataset.top;
    if (a === 'settings') { state.rootTab = 'inicio'; state.settingsSection = null; showScreen('config'); }
    else if (a === 'search') { state.rootTab = 'pesquisar'; showScreen('pesquisar'); }
    else if (a === 'recent') openDetail('recent', 'Recentes');
    else if (a === 'together') toast('Ouvir juntos: em breve nesta versão.');
    return;
  }

  const nav = e.target.closest('.bn-item');
  if (nav) {
    state.navStack = []; state.detail = null; state.settingsSection = null;
    state.rootTab = nav.dataset.route;
    showScreen(nav.dataset.route);
  }
});

// ---------- Init ----------
async function init() {
  applyTheme(state.appearance);
  state.catalog = normalizeTracks(FALLBACK);
  await loadDownloads();
  initAudio();
  showScreen('inicio');

  window.addEventListener('online', () => { state.online = true; toast('Conectado'); loadTrending(); });
  window.addEventListener('offline', () => { state.online = false; toast('Sem internet'); renderInicio(); });

  $('#btnBack').addEventListener('click', () => {
    if (state.playerOpen) { closePlayer(); return; }
    if (state.settingsSection) { state.settingsSection = null; renderConfig(); updateShell(); return; }
    const prev = state.navStack.pop();
    if (prev) { state.detail = prev.detail; showScreen(prev.route); return; }
    if (state.route !== 'inicio') { state.detail = null; state.rootTab = 'inicio'; showScreen('inicio'); }
  });

  const minip = $('#minip');
  if (minip) minip.addEventListener('click', (e) => { if (e.target.closest('.minip-btn')) return; openPlayer(); });
  $('#minipPlay').addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  $('#minipPrev').addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  $('#minipNext').addEventListener('click', (e) => { e.stopPropagation(); next(); });
  $('#playerClose').addEventListener('click', closePlayer);
  $('#pPlay').addEventListener('click', togglePlay);
  $('#pPrev').addEventListener('click', prev);
  $('#pNext').addEventListener('click', next);
  $('#pShuffle').addEventListener('click', () => {
    state.shuffle = !state.shuffle;
    $('#pShuffle').classList.toggle('active', state.shuffle);
    toast(state.shuffle ? 'Aleatório ativado' : 'Aleatório desativado');
  });
  $('#pRepeat').addEventListener('click', () => {
    const order = ['off', 'all', 'one'];
    state.repeat = order[(order.indexOf(state.repeat) + 1) % order.length];
    $('#pRepeat').classList.toggle('active', state.repeat !== 'off');
    toast('Repetir: ' + state.repeat);
  });
  $('#pLike').addEventListener('click', () => {
    const t = state.current; if (!t) return;
    if (state.liked.has(t.id)) { state.liked.delete(t.id); toast('Removida dos favoritos'); }
    else { state.liked.add(t.id); toast('Adicionada aos favoritos'); }
    saveLiked(); renderPlayerUI();
    if (state.route === 'biblioteca' && state.libTab === 'favoritos') renderBiblioteca();
  });
  $('#pDownload').addEventListener('click', () => { if (state.current) downloadTrack(state.current.id); });
  $('#pQueue').addEventListener('click', () => {
    const q = $('#playerQueue');
    if (!q) return;
    const show = q.style.display === 'none' || !q.style.display;
    q.style.display = show ? 'block' : 'none';
    if (show) renderQueueUI();
  });
  $('#playerMore').addEventListener('click', () => {
    const t = state.current; if (!t) return;
    const text = t.title + ' — ' + t.artist;
    if (navigator.share) navigator.share({ title: t.title, text }).catch(() => {});
    else toast(text);
  });
  $('#progBar').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (audio && audio.duration && isFinite(audio.duration)) audio.currentTime = pct * audio.duration;
  });

  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        if (state.appearance === 'sistema') applyTheme('sistema');
      });
    } catch (e) {}
  }

  loadTrending();
}

init();
window.MusicApp = { state, playTrack, downloadTrack, openPlayer };
