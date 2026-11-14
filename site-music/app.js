/* ============================================================
   Music — player de streaming (Audius) com visual YouTube Music
   Catálogo na nuvem • capas reais • busca • download offline
   ============================================================ */
const APP_VERSION = '2.4.0';
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

const AUDIUS_GENRES = [
  'Electronic', 'Hip-Hop/Rap', 'Pop', 'Rock', 'Country', 'Jazz', 'Funk', 'House',
  'Techno', 'Latin', 'World', 'Folk', 'R&B/Soul', 'Ambient', 'Experimental',
  'Drum & Bass', 'Dubstep', 'Trap', 'Disco', 'Acoustic', 'Alternative', 'Blues',
  'Classical', 'Reggae', 'Metal', 'Punk',
];
const CHIPS = ['Em alta', 'Sertanejo', 'Pagode', 'Samba', 'Forró', 'Piseiro', 'MPB', 'Rap nacional', 'Funk', 'Gospel', 'Pop', 'Rock', 'Lo-Fi', 'Eletrônico', 'Jazz', 'Relax', 'Hip-Hop', 'Dance'];

const CFG_ITEMS = [
  { id: 'update', icon: 'update', title: 'Atualização do sistema' },
  { id: 'aparencia', icon: 'palette', title: 'Aparência' },
  { id: 'conta', icon: 'account', title: 'Conta' },
  { id: 'ouvir', icon: 'people', title: 'Ouvir juntos' },
  { id: 'tocador', icon: 'headset', title: 'Tocador e áudio' },
  { id: 'conteudo', icon: 'music', title: 'Conteúdo' },
  { id: 'traducao', icon: 'translate', title: 'Tradução de letras por IA' },
  { id: 'permissoes', icon: 'lock', title: 'Permissões do aplicativo' },
  { id: 'privacidade', icon: 'shield', title: 'Privacidade' },
  { id: 'armazenamento', icon: 'storage', title: 'Armazenamento' },
  { id: 'backup', icon: 'cloud', title: 'Backup e restauração' },
  { id: 'sobre', icon: 'info', title: 'Sobre' },
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
  searchShown: 60,
  mbResults: [],
  mbLoading: false,
  mbToken: 0,
  mbQuery: '',
  libTab: 'playlists',
  settingsSection: null,
  queue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 'off',
  current: null,
  playing: false,
  loading: false,
  wantPlay: false,
  playerOpen: false,
  online: navigator.onLine,
  trendingLoaded: false,
  discoverLoaded: false,
  brazilLoaded: false,
  brazilTried: false,
  brazilLoading: null,
  searchError: '',
  playbackError: false,
  autoSkips: 0,
  needsGesture: false,
  permissions: null,
};
let audio = null;
let searchTimer = null;
let toastTimer = null;
let playToken = 0;
let retryCount = new Map();

// ---------- Ponte nativa (segundo plano / permissões) ----------
const Native = (() => {
  let plugin = null;
  try {
    plugin = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.MusicBackground) || null;
  } catch (e) { plugin = null; }
  const fire = (fn) => {
    try { const p = fn(); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch (e) {}
  };
  return {
    get available() { return !!plugin; },
    start(payload) { if (plugin) fire(() => plugin.start(payload)); },
    update(payload) { if (plugin) fire(() => plugin.update(payload)); },
    stop() { if (plugin) fire(() => plugin.stop()); },
    check() { return plugin ? plugin.checkStatus().catch(() => null) : Promise.resolve(null); },
    request(kind) { if (plugin) fire(() => plugin.askPermissions({ kind })); },
    openUnknown() { if (plugin) fire(() => plugin.openUnknownSources()); },
    battery() { if (plugin) fire(() => plugin.requestIgnoreBatteryOptimization()); },
    appSettings() { if (plugin) fire(() => plugin.openAppSettings()); },
    onAction(cb) {
      if (!plugin || !plugin.addListener) return;
      try { plugin.addListener('mediaAction', (data) => cb(data && data.action)); } catch (e) {}
    },
  };
})();
const WEB_MEDIA_SESSION = !Native.available;

// ---------- Utils ----------
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Catálogo brasileiro ----------
// O Audius tem pouco conteúdo marcado como "Brasil", então combinamos buscas por
// gêneros/artistas brasileiros com uma lista de uploaders que publicam música BR.
const CATALOG_CAP = 20000;
function fold(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const BR_GENRE_QUERIES = [
  { q: 'sertanejo', genre: 'Sertanejo' },
  { q: 'modão sertanejo', genre: 'Sertanejo' },
  { q: 'sertanejo sofrência', genre: 'Sertanejo' },
  { q: 'arrocha', genre: 'Sertanejo' },
  { q: 'pagode', genre: 'Pagode' },
  { q: 'pagode baiano', genre: 'Pagode' },
  { q: 'samba', genre: 'Samba' },
  { q: 'samba de raiz', genre: 'Samba' },
  { q: 'forró', genre: 'Forró' },
  { q: 'forró pé de serra', genre: 'Forró' },
  { q: 'piseiro', genre: 'Piseiro' },
  { q: 'pisadinha', genre: 'Piseiro' },
  { q: 'mpb', genre: 'MPB' },
  { q: 'bossa nova', genre: 'Bossa Nova' },
  { q: 'brega funk', genre: 'Brega' },
  { q: 'brega romântico', genre: 'Brega' },
  { q: 'rap nacional', genre: 'Rap nacional' },
  { q: 'trap brasileiro', genre: 'Trap brasileiro' },
  { q: 'gospel brasileiro', genre: 'Gospel brasileiro' },
  { q: 'louvor brasileiro', genre: 'Gospel brasileiro' },
  { q: 'música brasileira', genre: 'MPB' },
];
const BR_ARTIST_QUERIES = [
  { q: 'Jorge e Mateus', genre: 'Sertanejo' },
  { q: 'Henrique e Juliano', genre: 'Sertanejo' },
  { q: 'Marília Mendonça', genre: 'Sertanejo' },
  { q: 'Zé Neto e Cristiano', genre: 'Sertanejo' },
  { q: 'Gusttavo Lima', genre: 'Sertanejo' },
  { q: 'Luan Santana', genre: 'Sertanejo' },
  { q: 'Maiara e Maraisa', genre: 'Sertanejo' },
  { q: 'Chitãozinho e Xororó', genre: 'Sertanejo' },
  { q: 'Michel Teló', genre: 'Sertanejo' },
  { q: 'Wesley Safadão', genre: 'Forró' },
  { q: 'Xand Avião', genre: 'Forró' },
  { q: 'João Gomes', genre: 'Piseiro' },
  { q: 'Ana Castela', genre: 'Piseiro' },
  { q: 'Péricles', genre: 'Pagode' },
  { q: 'Thiaguinho', genre: 'Pagode' },
  { q: 'Ferrugem', genre: 'Pagode' },
  { q: 'Dilsinho', genre: 'Pagode' },
  { q: 'Grupo Menos é Mais', genre: 'Pagode' },
  { q: 'Sorriso Maroto', genre: 'Pagode' },
  { q: 'Turma do Pagode', genre: 'Pagode' },
  { q: 'Exaltasamba', genre: 'Pagode' },
  { q: 'Zeca Pagodinho', genre: 'Samba' },
  { q: 'Raça Negra', genre: 'Samba' },
  { q: 'Alcione', genre: 'Samba' },
  { q: 'Fundo de Quintal', genre: 'Samba' },
  { q: 'Djavan', genre: 'MPB' },
  { q: 'Caetano Veloso', genre: 'MPB' },
  { q: 'Gilberto Gil', genre: 'MPB' },
  { q: 'Chico Buarque', genre: 'MPB' },
  { q: 'Gal Costa', genre: 'MPB' },
  { q: 'Milton Nascimento', genre: 'MPB' },
  { q: 'Marisa Monte', genre: 'MPB' },
  { q: 'Elis Regina', genre: 'MPB' },
  { q: 'MC Hariel', genre: 'Funk brasileiro' },
  { q: 'MC Ryan SP', genre: 'Funk brasileiro' },
  { q: 'MC Kevin o Chris', genre: 'Funk brasileiro' },
  { q: 'MC Cabelinho', genre: 'Funk brasileiro' },
  { q: 'Racionais MC', genre: 'Rap nacional' },
  { q: 'Emicida', genre: 'Rap nacional' },
  { q: 'Djonga', genre: 'Rap nacional' },
  { q: 'Criolo', genre: 'Rap nacional' },
  { q: 'Anitta', genre: 'Pop brasileiro' },
  { q: 'Ludmilla', genre: 'Funk brasileiro' },
  { q: 'Pabllo Vittar', genre: 'Pop brasileiro' },
  { q: 'Luísa Sonza', genre: 'Pop brasileiro' },
  { q: 'Ivete Sangalo', genre: 'Axé' },
  { q: 'Cláudia Leitte', genre: 'Axé' },
  { q: 'Charlie Brown Jr', genre: 'Rock nacional' },
  { q: 'Legião Urbana', genre: 'Rock nacional' },
  { q: 'Skank', genre: 'Rock nacional' },
  { q: 'Jota Quest', genre: 'Rock nacional' },
  { q: 'Titãs', genre: 'Rock nacional' },
  { q: 'Paralamas do Sucesso', genre: 'Rock nacional' },
  { q: 'Aline Barros', genre: 'Gospel brasileiro' },
  { q: 'Fernandinho', genre: 'Gospel brasileiro' },
  { q: 'Gabriela Rocha', genre: 'Gospel brasileiro' },
  { q: 'Diante do Trono', genre: 'Gospel brasileiro' },
];
BR_ARTIST_QUERIES.push(
  { q: 'Israel e Rodolffo', genre: 'Sertanejo' },
  { q: 'Bruno e Marrone', genre: 'Sertanejo' },
  { q: 'Zezé di Camargo e Luciano', genre: 'Sertanejo' },
  { q: 'Leonardo', genre: 'Sertanejo' },
  { q: 'Daniel', genre: 'Sertanejo' },
  { q: 'Eduardo Costa', genre: 'Sertanejo' },
  { q: 'César Menotti e Fabiano', genre: 'Sertanejo' },
  { q: 'Marcos e Belutti', genre: 'Sertanejo' },
  { q: 'Matheus e Kauan', genre: 'Sertanejo' },
  { q: 'Zé Felipe', genre: 'Sertanejo' },
  { q: 'Felipe Araújo', genre: 'Sertanejo' },
  { q: 'Hugo e Guilherme', genre: 'Sertanejo' },
  { q: 'Lauana Prado', genre: 'Sertanejo' },
  { q: 'Naiara Azevedo', genre: 'Sertanejo' },
  { q: 'Simone e Simaria', genre: 'Sertanejo' },
  { q: 'Maraisa', genre: 'Sertanejo' },
  { q: 'Maiara', genre: 'Sertanejo' },
  { q: 'Diego e Victor Hugo', genre: 'Sertanejo' },
  { q: 'Guilherme e Benuto', genre: 'Sertanejo' },
  { q: 'Clayton e Romário', genre: 'Sertanejo' },
  { q: 'Fernando e Sorocaba', genre: 'Sertanejo' },
  { q: 'João Neto e Frederico', genre: 'Sertanejo' },
  { q: 'João Bosco e Vinícius', genre: 'Sertanejo' },
  { q: 'Rick e Renner', genre: 'Sertanejo' },
  { q: 'Gian e Giovani', genre: 'Sertanejo' },
  { q: 'Teodoro e Sampaio', genre: 'Sertanejo' },
  { q: 'Milionário e José Rico', genre: 'Sertanejo' },
  { q: 'Chrystian e Ralf', genre: 'Sertanejo' },
  { q: 'Revelação', genre: 'Pagode' },
  { q: 'Pixote', genre: 'Pagode' },
  { q: 'Só Pra Contrariar', genre: 'Pagode' },
  { q: 'Art Popular', genre: 'Pagode' },
  { q: 'Molejo', genre: 'Pagode' },
  { q: 'Negritude Jr', genre: 'Pagode' },
  { q: 'Katinguelê', genre: 'Pagode' },
  { q: 'Jeito Moleque', genre: 'Pagode' },
  { q: 'Imaginasamba', genre: 'Pagode' },
  { q: 'Bom Gosto', genre: 'Pagode' },
  { q: 'Tá na Mente', genre: 'Pagode' },
  { q: 'Grupo Revelação', genre: 'Pagode' },
  { q: 'Beth Carvalho', genre: 'Samba' },
  { q: 'Martinho da Vila', genre: 'Samba' },
  { q: 'Paulinho da Viola', genre: 'Samba' },
  { q: 'Cartola', genre: 'Samba' },
  { q: 'Nelson Cavaquinho', genre: 'Samba' },
  { q: 'Maria Bethânia', genre: 'MPB' },
  { q: 'Tom Jobim', genre: 'MPB' },
  { q: 'João Gilberto', genre: 'MPB' },
  { q: 'Toquinho', genre: 'MPB' },
  { q: 'Vinicius de Moraes', genre: 'MPB' },
  { q: 'Jorge Ben Jor', genre: 'MPB' },
  { q: 'Tim Maia', genre: 'MPB' },
  { q: 'Seu Jorge', genre: 'MPB' },
  { q: 'Maria Rita', genre: 'MPB' },
  { q: 'Vanessa da Mata', genre: 'MPB' },
  { q: 'Ana Carolina', genre: 'MPB' },
  { q: 'Zélia Duncan', genre: 'MPB' },
  { q: 'Lenine', genre: 'MPB' },
  { q: 'Lô Borges', genre: 'MPB' },
  { q: 'Beto Guedes', genre: 'MPB' },
  { q: 'Flávio Venturini', genre: 'MPB' },
  { q: 'MC Livinho', genre: 'Funk brasileiro' },
  { q: 'MC WM', genre: 'Funk brasileiro' },
  { q: 'MC G15', genre: 'Funk brasileiro' },
  { q: 'MC Kekel', genre: 'Funk brasileiro' },
  { q: 'MC Don Juan', genre: 'Funk brasileiro' },
  { q: 'MC Davi', genre: 'Funk brasileiro' },
  { q: 'MC Pedrinho', genre: 'Funk brasileiro' },
  { q: 'MC Zaac', genre: 'Funk brasileiro' },
  { q: 'Jerry Smith', genre: 'Funk brasileiro' },
  { q: 'Vitão', genre: 'Pop brasileiro' },
  { q: 'Matuê', genre: 'Trap brasileiro' },
  { q: 'Teto', genre: 'Trap brasileiro' },
  { q: 'Wiu', genre: 'Trap brasileiro' },
  { q: 'Orochi', genre: 'Trap brasileiro' },
  { q: 'Veigh', genre: 'Trap brasileiro' },
  { q: 'KayBlack', genre: 'Trap brasileiro' },
  { q: 'L7NNON', genre: 'Rap nacional' },
  { q: 'Cazuza', genre: 'Rock nacional' },
  { q: 'Barão Vermelho', genre: 'Rock nacional' },
  { q: 'Engenheiros do Hawaii', genre: 'Rock nacional' },
  { q: 'Raimundos', genre: 'Rock nacional' },
  { q: 'Pitty', genre: 'Rock nacional' },
  { q: 'NX Zero', genre: 'Rock nacional' },
  { q: 'Fresno', genre: 'Rock nacional' },
  { q: 'Capital Inicial', genre: 'Rock nacional' },
  { q: 'O Rappa', genre: 'Rock nacional' },
  { q: 'Natiruts', genre: 'Reggae brasileiro' },
  { q: 'Aline Barros', genre: 'Gospel brasileiro' },
  { q: 'Fernandinho', genre: 'Gospel brasileiro' },
  { q: 'Gabriela Rocha', genre: 'Gospel brasileiro' },
  { q: 'Diante do Trono', genre: 'Gospel brasileiro' },
  { q: 'Cassiane', genre: 'Gospel brasileiro' },
  { q: 'Bruna Karla', genre: 'Gospel brasileiro' },
  { q: 'Eyshila', genre: 'Gospel brasileiro' },
  { q: 'André Valadão', genre: 'Gospel brasileiro' },
  { q: 'Ana Paula Valadão', genre: 'Gospel brasileiro' },
  { q: 'Ludmila Ferber', genre: 'Gospel brasileiro' },
  { q: 'Fernanda Brum', genre: 'Gospel brasileiro' },
  { q: 'Thalles Roberto', genre: 'Gospel brasileiro' },
  { q: 'Kleber Lucas', genre: 'Gospel brasileiro' },
  { q: 'Aviões do Forró', genre: 'Forró' },
  { q: 'Mastruz com Leite', genre: 'Forró' },
  { q: 'Calcinha Preta', genre: 'Forró' },
  { q: 'Banda Calypso', genre: 'Forró' },
  { q: 'Limão com Mel', genre: 'Forró' },
  { q: 'Cavaleiros do Forró', genre: 'Forró' },
  { q: 'Saia Rodada', genre: 'Forró' },
  { q: 'Solange Almeida', genre: 'Forró' },
  { q: 'Os Barões da Pisadinha', genre: 'Piseiro' },
  { q: 'Vitor Fernandes', genre: 'Piseiro' },
  { q: 'Tarcísio do Acordeon', genre: 'Piseiro' },
  { q: 'Marcynho Sensação', genre: 'Piseiro' },
  { q: 'Felipe Amorim', genre: 'Piseiro' },
  { q: 'Daniela Mercury', genre: 'Axé' },
  { q: 'Carlinhos Brown', genre: 'Axé' },
  { q: 'Olodum', genre: 'Axé' },
  { q: 'Timbalada', genre: 'Axé' },
  { q: 'Chiclete com Banana', genre: 'Axé' },
  { q: 'Asa de Águia', genre: 'Axé' },
  { q: 'Netinho', genre: 'Axé' }
);
BR_ARTIST_QUERIES.push(
  { q: 'MC Poze do Rodo', genre: 'Funk brasileiro' },
  { q: 'Lobo da Madrugada', genre: 'Funk brasileiro' },
  { q: 'mc poze lobo da madrugada', genre: 'Funk brasileiro' },
  { q: 'Orochi', genre: 'Trap brasileiro' }
);
const BR_UPLOADERS = new Set([
  'mrunknown', 'gravaerecords', '1000hits', 'boibrasil', 'danixd39', 'danixd42',
  'danixd43', 'danixd47', 'danixd48', 'danixd51', 'paulorpsa', 'noedi',
  'hugollobo', 'jhonytorres', 'periclessilva04', 'cyberthebaby', 'vittor louis',
  'vittor.louis', 'marcosjapasamba', 'sambo', 'lexdj', 'nynno', 'ronnyzinho',
  'lucasmauricio', 'andrekrun', 'osbardos', '2t da serra', 'vinnyrd7', 'r2gang',
  'jaum', 'dj bdf', 'dj_bdf', 'ortirodrigo', 'akirathedon', 'eduardokreca',
  'promubiestudio', 'br4sil', 'eulucke', 'dodecagon music', 'konnoduo',
  'heziryder', 'eversonespfio', 'zadedouglas', 'rodrigofreitas', 'orafao',
  'jorgeguberte', 'rggomes', 'djelninolmp', 'dakell4forma', 'jordan',
  'ribeiro nancy', 'anderson brasil',
].map(fold).filter(Boolean));
const BR_MARKERS = [
  'sertanejo', 'sertaneja', 'modao', 'arrocha', 'sofrimento', 'caipira', 'rodeio',
  'peao', 'boiadeiro', 'pagode', 'samba', 'forro', 'piseiro', 'pisadinha',
  'bossa nova', 'brega', 'rap nacional', 'trap brasileiro', 'gospel brasileiro',
  'mpb', 'baile funk', 'funk carioca', 'favela', 'quebrada', 'baiano',
  'nordestino', 'vaquejada', 'musica brasileira', 'brasileira', 'brasileiro',
];
const BR_PT_WORDS = [
  'voce', 'nao', 'coracao', 'saudade', 'beijo', 'cerveja', 'boteco', 'paixao',
  'oracao', 'saudade', 'amor', 'amorzinho', 'mulher', 'homem', 'noite', 'dia',
  'vida', 'mundo', 'tempo', 'festanca', 'danca', 'crianca', 'rua', 'cidade',
  'interior', 'roca', 'deus', 'fe', 'alegria', 'tristeza', 'verdade', 'saudades',
  'modao', 'peao', 'boiadeiro', 'vaqueiro', 'baile', 'quebrada', 'favela',
];
function looksBrazilian(t, query) {
  const hay = fold([t.title, t.artist, t.album, t.genre].join(' '));
  const handle = fold(t.handle || '');
  let score = 0;
  if (handle && BR_UPLOADERS.has(handle)) score += 30;
  for (const w of BR_MARKERS) if (hay.includes(w)) { score += 12; break; }
  if (BR_ARTIST_KEYS.some((a) => hay.includes(a))) score += 16;
  if (/[ãõçâêô]/i.test([t.title, t.artist, t.album].join(' '))) score += 8;
  const padded = ' ' + hay + ' ';
  let ptHits = 0;
  for (const w of BR_PT_WORDS) {
    if (padded.includes(' ' + w + ' ')) { ptHits++; if (ptHits >= 2) break; }
  }
  score += ptHits * 6;
  const qn = fold(query);
  if (qn && hay.includes(qn)) score += 6;
  return score >= 20;
}
function brGenreFor(t, curated) {
  const hay = fold([t.title, t.artist, t.album].join(' '));
  // Artista conhecido manda mais que a busca que trouxe a faixa.
  for (const [name, genre] of BR_ARTIST_GENRE) {
    if (hay.includes(name)) return genre;
  }
  if (/sertanejo|sertaneja|modao|arrocha|sofrimento|caipira|rodeio|peao|boiadeiro/.test(hay)) return 'Sertanejo';
  if (/pagode/.test(hay)) return 'Pagode';
  if (/samba/.test(hay)) return 'Samba';
  if (/piseiro|pisadinha/.test(hay)) return 'Piseiro';
  if (/forro/.test(hay)) return 'Forró';
  if (/bossa/.test(hay)) return 'Bossa Nova';
  if (/gospel|louvor|adoracao|oracao/.test(hay)) return 'Gospel brasileiro';
  if (/trap/.test(hay)) return 'Trap brasileiro';
  if (/rap|hip hop/.test(hay)) return 'Rap nacional';
  if (/brega/.test(hay)) return 'Brega';
  if (/axe/.test(hay)) return 'Axé';
  if (/funk|baile|favela|quebrada/.test(hay)) return 'Funk brasileiro';
  return curated || 'Música brasileira';
}


// Ícones Material (mesmos traços usados pelo YouTube Music).
const ICON_PATHS = {
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  down: 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  prev: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
  next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  shuffle: 'M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  heartOutline: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
  lyrics: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  download: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  queue: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  search: 'M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  update: 'M21 10.12h-6.78l2.74-2.75c-2.14-2.13-5.61-2.13-7.74 0-2.14 2.13-2.14 5.59 0 7.72 2.13 2.13 5.6 2.13 7.73 0l1.42 1.41c-2.92 2.91-7.65 2.91-10.57 0-2.92-2.91-2.92-7.64 0-10.55 2.92-2.92 7.63-2.93 10.56-.02L21 3.6v6.52z',
  palette: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  account: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  headset: 'M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z',
  music: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  translate: 'M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  storage: 'M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z',
  cloud: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  package: 'M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-.9-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
  battery: 'M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z',
};
function icon(name, size = 24) {
  const d = ICON_PATHS[name] || ICON_PATHS.play;
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}
function toast(msg, ms = 2400) {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function toSeconds(v) {
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return 0;
    if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(s)) {
      const p = s.split(':').map(Number).reverse();
      return (p[0] || 0) + (p[1] || 0) * 60 + (p[2] || 0) * 3600;
    }
    v = s.replace(',', '.');
  }
  let n = Number(v);
  if (!isFinite(n) || n <= 0) return 0;
  if (n > 36000) n = n / 1000; // alguns servidores enviam milissegundos
  return n;
}
function fmt(v) {
  const total = Math.round(toSeconds(v));
  if (!total) return '0:00';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
function fmtDur(v) { return toSeconds(v) > 0 ? fmt(v) : '--:--'; }
function mb(bytes) { return (Number(bytes || 0) / 1048576).toFixed(1) + ' MB'; }
function saveLiked() { try { localStorage.setItem('liked', JSON.stringify([...state.liked])); } catch (e) {} }
function saveRecent() { try { localStorage.setItem('recent', JSON.stringify(state.recent.slice(0, 40))); } catch (e) {} }
function saveSettings() { try { localStorage.setItem('settings', JSON.stringify(state.settings)); } catch (e) {} }

// ---------- Catálogo ----------
function normalizeTracks(list, fallbackGenre) {
  return (Array.isArray(list) ? list : []).map((t) => {
    if (!t || !t.id || !t.title) return null;
    if (t.is_delete === true) return null;
    if (t.is_streamable === false) return null;
    if (t.access && t.access.stream === false) return null;
    if (t.is_stream_gated === true && !(t.access && t.access.stream)) return null;
    const rawDur = t.duration != null ? t.duration : t.dur;
    const dur = Math.round(toSeconds(rawDur));
    if (dur && dur < 20) return null;
    const art = t.art || (t.artwork && (t.artwork['480x480'] || t.artwork['150x150'])) || '';
    const artist = t.artist || (t.user && (t.user.name || t.user.handle)) || 'Artista';
    const released = Date.parse(t.release_date || t.created_at || '') || 0;
    const created = Date.parse(t.created_at || t.release_date || '') || released;
    // Alguns uploads vêm com títulos/artistas só de pontinhos ("..."): troca por texto legível.
    const clean = (v, def) => {
      const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
      return !s || /^[.\u2026\-–—]+$/.test(s) ? def : s;
    };
    return {
      id: String(t.id),
      title: clean(t.title, 'Faixa sem nome'),
      artist: clean(artist, 'Artista'),
      album: clean(t.album || t.genre || fallbackGenre || 'Audius', 'Audius'),
      genre: clean(t.genre || fallbackGenre || 'Música', 'Música'),
      handle: String((t.user && (t.user.handle || t.user.name)) || t.handle || ''),
      dur: dur || 0,
      art: String(art).replace('150x150', '480x480'),
      fb: t.fb || '',
      released,
      created,
      plays: Number(t.play_count || t.favorite_count || 0) || 0,
    };
  }).filter(Boolean);
}
function mergeCatalog(list) {
  if (!Array.isArray(list) || !list.length) return;
  const map = new Map(state.catalog.map((t) => [t.id, t]));
  list.forEach((t) => { if (!map.has(t.id)) map.set(t.id, t); });
  // Mantém o catálogo grande o bastante para trazer músicas antigas, novas e brasileiras.
  state.catalog = [...map.values()].slice(0, CATALOG_CAP);
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
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function apiFetch(path, timeout = 16000) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(API + path, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      return json.data || [];
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await wait(500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('network');
}
async function loadDiscover() {
  if (!navigator.onLine) { state.online = false; return; }
  const endpoints = [
    `/tracks/trending?app_name=${APP_NAME}&limit=100&time=week`,
    `/tracks/trending?app_name=${APP_NAME}&limit=100&time=month`,
  ];
  for (let off = 0; off < 10000; off += 100) {
    endpoints.push(`/tracks/search?query=&app_name=${APP_NAME}&limit=100&offset=${off}&sort_method=recent`);
  }
  for (let off = 0; off < 10000; off += 100) {
    endpoints.push(`/tracks/search?query=&app_name=${APP_NAME}&limit=100&offset=${off}&sort_method=popular`);
  }
  const BATCH = 6;
  try {
    for (let i = 0; i < endpoints.length; i += BATCH) {
      const batch = endpoints.slice(i, i + BATCH);
      const settled = await Promise.allSettled(batch.map((p) => apiFetch(p)));
      let list = [];
      settled.forEach((r) => { if (r.status === 'fulfilled') list = list.concat(normalizeTracks(r.value)); });
      if (list.length) {
        mergeCatalog(list);
        state.trendingLoaded = true;
        state.discoverLoaded = true;
        state.online = true;
        if (state.route === 'inicio' && (i % (BATCH * 2) === 0 || i + BATCH >= endpoints.length)) {
          const sc = $('#screen-inicio');
          const top = sc ? sc.scrollTop : 0;
          renderInicio();
          if (sc) sc.scrollTop = top;
        }
      }
      await wait(90);
    }
    state.online = navigator.onLine;
    if (state.route === 'inicio') {
      const sc = $('#screen-inicio');
      const top = sc ? sc.scrollTop : 0;
      renderInicio();
      if (sc) sc.scrollTop = top;
    }
  } catch (e) {
    state.online = navigator.onLine;
    if (state.route === 'inicio') renderInicio();
  }
}
async function loadBrazil() {
  if (state.brazilLoaded) return;
  if (!navigator.onLine) { state.online = false; return; }
  if (state.brazilLoading) return state.brazilLoading;
  state.brazilLoading = (async () => {
    // Intercala gêneros e artistas para que a variedade sobreviva ao limite do catálogo.
    const tasks = [];
    const total = Math.max(BR_GENRE_QUERIES.length, BR_ARTIST_QUERIES.length);
    for (let i = 0; i < total; i++) {
      if (BR_GENRE_QUERIES[i]) tasks.push(Object.assign({ limit: 30 }, BR_GENRE_QUERIES[i]));
      if (BR_ARTIST_QUERIES[i]) tasks.push(Object.assign({ limit: 15 }, BR_ARTIST_QUERIES[i]));
    }
    const found = new Map();
    const BATCH = 5;
    for (let i = 0; i < tasks.length; i += BATCH) {
      const batch = tasks.slice(i, i + BATCH);
      const settled = await Promise.allSettled(batch.map((task) => apiFetch(
        `/tracks/search?query=${encodeURIComponent(task.q)}&app_name=${APP_NAME}&limit=${task.limit}&sort_method=popular`
      )));
      settled.forEach((res, j) => {
        if (res.status !== 'fulfilled') return;
        const task = batch[j];
        normalizeTracks(res.value).forEach((t) => {
          if (found.has(t.id) || !looksBrazilian(t, task.q)) return;
          t.genre = brGenreFor(t, task.genre);
          t.br = true;
          found.set(t.id, t);
        });
      });
      if (i + BATCH < tasks.length) await wait(120);
    }
    // Varredura completa dos uploaders brasileiros confiáveis (todas as faixas).
    for (const handle of BR_UPLOADERS) {
      let offset = 0;
      while (offset < 1000) {
        try {
          const raw = await apiFetch(
            `/users/handle/${encodeURIComponent(handle)}/tracks?app_name=${APP_NAME}&limit=100&offset=${offset}`
          );
          if (!Array.isArray(raw) || !raw.length) break;
          normalizeTracks(raw).forEach((t) => {
            if (found.has(t.id) || !looksBrazilian(t, '')) return;
            t.genre = brGenreFor(t, 'Música brasileira');
            t.br = true;
            found.set(t.id, t);
          });
          if (raw.length < 100) break;
          offset += 100;
          await wait(80);
        } catch (e) { break; }
      }
      await wait(80);
    }
    if (!found.size) return;
    // Faixas brasileiras entram na frente para não serem cortadas pelo limite do catálogo.
    const merged = new Map(found);
    state.catalog.forEach((t) => { if (!merged.has(t.id)) merged.set(t.id, t); });
    state.catalog = [...merged.values()].slice(0, CATALOG_CAP);
    state.brazilLoaded = true;
    state.online = true;
    if (state.route === 'inicio') {
      const sc = screenEl('inicio');
      const top = sc ? sc.scrollTop : 0;
      renderInicio();
      if (sc) sc.scrollTop = top;
    } else if (state.route === 'detalhe' && state.detail && (state.detail.type === 'brazil' || state.detail.key === '__brazil__')) {
      renderDetalhe();
    }
  })();
  try { await state.brazilLoading; }
  finally { state.brazilTried = true; state.brazilLoading = null; }
}

async function loadGenreCatalog() {
  if (!navigator.onLine) return;
  const endpoints = [];
  for (const genre of AUDIUS_GENRES) {
    for (let off = 0; off < 5000; off += 100) {
      endpoints.push(`/tracks/search?app_name=${APP_NAME}&limit=100&offset=${off}&sort_method=popular&genre=${encodeURIComponent(genre)}`);
    }
  }
  const BATCH = 8;
  for (let i = 0; i < endpoints.length; i += BATCH) {
    const batch = endpoints.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map((p) => apiFetch(p)));
    let list = [];
    settled.forEach((r) => { if (r.status === 'fulfilled') list = list.concat(normalizeTracks(r.value)); });
    if (list.length) {
      mergeCatalog(list);
      if (state.route === 'inicio' && i % (BATCH * 4) === 0) {
        const sc = $('#screen-inicio');
        const top = sc ? sc.scrollTop : 0;
        renderInicio();
        if (sc) sc.scrollTop = top;
      }
    }
    await wait(80);
  }
  if (state.route === 'inicio') {
    const sc = $('#screen-inicio');
    const top = sc ? sc.scrollTop : 0;
    renderInicio();
    if (sc) sc.scrollTop = top;
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
function nativePayload(t, isPlaying) {
  return {
    title: t.title || 'Music',
    artist: t.artist || '',
    album: t.album || 'Music',
    duration: Math.max(0, Math.round(toSeconds(t.dur) * 1000)),
    isPlaying: !!isPlaying,
    artwork: artOf(t) || '',
  };
}
let nativeRunning = false;
function syncNative(isPlaying, forceStart) {
  if (!Native.available) return;
  const t = state.current;
  if (!t) {
    if (nativeRunning) { Native.stop(); nativeRunning = false; }
    return;
  }
  const payload = nativePayload(t, isPlaying);
  if (forceStart || !nativeRunning) { Native.start(payload); nativeRunning = true; }
  else Native.update(payload);
}
function initAudio() {
  audio = $('#audioEl');
  if (!audio) return;
  audio.addEventListener('timeupdate', () => { updateProgressUI(); updatePositionState(); });
  audio.addEventListener('durationchange', () => { updateProgressUI(); updateMediaSession(); });
  audio.addEventListener('loadedmetadata', () => { updateProgressUI(); updateMediaSession(); });
  audio.addEventListener('playing', () => {
    if (!state.current) return;
    state.playing = true; state.loading = false; state.playbackError = false; state.needsGesture = false;
    state.wantPlay = false;
    state.autoSkips = 0;
    retryCount.delete(state.current.id);
    updateMediaSession(); renderPlayerUI(); refreshPlayingRows(); syncNative(true, false);
  });
  audio.addEventListener('pause', () => {
    if (audio.ended) return;
    state.playing = false; state.loading = false;
    updateMediaSession(); renderPlayerUI();
    if (state.current) syncNative(false, false);
  });
  audio.addEventListener('waiting', () => { state.loading = true; renderPlayerUI(); });
  audio.addEventListener('stalled', () => { state.loading = true; renderPlayerUI(); });
  audio.addEventListener('canplay', () => {
    state.loading = false;
    renderPlayerUI();
    // Se o primeiro play() foi interrompido pelo WebView, retoma assim que o áudio fica pronto.
    if (state.wantPlay && audio.paused && !state.playbackError) audio.play().catch(() => {});
  });
  audio.addEventListener('ended', () => {
    if (state.repeat === 'one') { try { audio.currentTime = 0; audio.play(); } catch (e) {} return; }
    next();
  });
  audio.addEventListener('error', onAudioError);
  if (WEB_MEDIA_SESSION && 'mediaSession' in navigator) {
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
function onAudioError() {
  if (!state.current || !audio) return;
  const t = state.current;
  const code = audio.error ? audio.error.code : 0;
  state.loading = false;
  state.playing = false;
  const tries = retryCount.get(t.id) || 0;
  // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED. Ainda tentamos uma vez com cache novo.
  if (tries < 2) {
    retryCount.set(t.id, tries + 1);
    renderPlayerUI();
    setTimeout(() => {
      if (!state.current || state.current.id !== t.id) return;
      const base = srcFor(t);
      const sep = base.includes('?') ? '&' : '?';
      audio.src = base + sep + 'retry=' + (tries + 1);
      try { audio.load(); } catch (e) {}
      audio.play().catch(() => {});
    }, 700 * (tries + 1));
    return;
  }
  state.playbackError = true;
  state.wantPlay = false;
  renderPlayerUI();
  updateMediaSession();
  if (state.autoSkips < 2 && state.queue.length > 1) {
    state.autoSkips++;
    toast('Não foi possível tocar "' + t.title + '". Pulando…');
    setTimeout(() => { if (state.current && state.current.id === t.id) next(); }, 1400);
  } else {
    toast(code === 4 ? 'Formato não suportado nesta música.' : 'Falha de conexão ao tocar. Toque em tentar de novo.');
  }
}
function loadTrack(t, fromUser) {
  if (!audio || !t) return;
  const token = ++playToken;
  state.current = t;
  state.loading = true;
  state.playing = false;
  state.playbackError = false;
  state.needsGesture = false;
  state.wantPlay = true;

  try { audio.pause(); } catch (e) {}
  audio.src = srcFor(t);
  try { audio.load(); } catch (e) {}

  renderPlayerUI();
  refreshPlayingRows();
  updateMediaSession();
  syncNative(false, true);

  const sheet = document.getElementById('lyricsSheet');
  if (sheet && sheet.style.display !== 'none' && window.LyricsUI) window.LyricsUI.open(t);

  const p = audio.play();
  if (p && typeof p.then === 'function') {
    p.then(() => {
      if (token !== playToken) return;
      state.playing = true; state.loading = false; state.wantPlay = false;
      renderPlayerUI(); refreshPlayingRows(); updateMediaSession(); syncNative(true, true);
    }).catch((err) => {
      if (token !== playToken) return;
      state.loading = false;
      state.playing = false;
      if (err && err.name === 'NotAllowedError') {
        state.wantPlay = false;
        state.needsGesture = true;
        toast('Toque em Reproduzir para iniciar a música.');
      }
      // Em alguns aparelhos o primeiro play() falha enquanto o WebView aquece.
      // Uma segunda tentativa curta resolve na maioria dos casos.
      setTimeout(() => {
        if (token !== playToken || !state.current || state.current.id !== t.id) return;
        if (audio.paused && !state.playbackError) audio.play().catch(() => {});
      }, 120);
      renderPlayerUI();
    });
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
  state.autoSkips = 0;
  loadTrack(t, true);

  state.recent = [String(id), ...state.recent.filter((x) => x !== String(id))].slice(0, 30);
  saveRecent();
}
function play() {
  if (!audio) return;
  if (!state.current) { const first = state.catalog[0] || [...state.downloads.values()][0]; if (first) playTrack(first.id); return; }
  if (!audio.src) { loadTrack(state.current, true); return; }
  if (state.playbackError) { retryCount.delete(state.current.id); loadTrack(state.current, true); return; }
  state.wantPlay = true;
  const p = audio.play();
  if (p && p.then) {
    p.then(() => { state.playing = true; state.loading = false; state.wantPlay = false; renderPlayerUI(); updateMediaSession(); syncNative(true, false); })
      .catch(() => { state.playing = false; state.wantPlay = false; renderPlayerUI(); toast('Não foi possível retomar. Toque em Reproduzir novamente.'); });
  }
}
function pause() {
  if (!audio) return;
  state.wantPlay = false;
  try { audio.pause(); } catch (e) {}
  state.playing = false;
  updateMediaSession();
  renderPlayerUI();
  if (state.current) syncNative(false, false);
}
function togglePlay() { state.playing ? pause() : play(); }
function next(force) {
  if (!state.queue.length) return;
  // "Repetir uma" vale apenas quando a música termina sozinha.
  // Botão/swipe sempre avança para a próxima.
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
function prev(force) {
  if (!state.queue.length) return;
  // Swipe/botão de anterior não reinicia a música: vai direto para a anterior.
  if (force !== true && audio && audio.currentTime > 4) { audio.currentTime = 0; return; }
  let i = state.queueIndex - 1;
  if (i < 0) i = state.queue.length - 1;
  state.queueIndex = i;
  playTrack(state.queue[i]);
}
function updateMediaSession() {
  if (!WEB_MEDIA_SESSION || !('mediaSession' in navigator) || !state.current) return;
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
  updatePositionState();
}
let posThrottle = 0;
function updatePositionState() {
  if (!WEB_MEDIA_SESSION || !audio || !('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;
  const now = Date.now();
  if (now - posThrottle < 3000) return;
  posThrottle = now;
  const d = audio.duration;
  if (!isFinite(d) || d <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: d,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(Math.max(0, audio.currentTime || 0), d),
    });
  } catch (e) {}
}
function updateProgressUI() {
  if (!audio) return;
  const live = isFinite(audio.duration) && audio.duration > 0;
  const dur = live ? audio.duration : (state.current ? toSeconds(state.current.dur) : 0);
  const cur = audio.currentTime || 0;
  const pct = dur ? Math.min(100, Math.max(0, (cur / dur) * 100)) : 0;
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
  const bg = $('#playerBg');
  if (bg) {
    const art = artOf(t);
    bg.style.backgroundImage = art ? `url("${String(art).replace(/"/g, '%22')}")` : grad(t.id);
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'center';
  }
  const pt = $('#playerTitle'), pa = $('#playerArtist'), pal = $('#playerAlbum');
  if (pt) pt.textContent = t.title;
  if (pa) pa.textContent = t.artist;
  if (pal) pal.textContent = t.album || 'Music';

  const mplay = $('#minipPlay'), pplay = $('#pPlay');
  const isLoading = state.loading && !state.playing;
  if (mplay) mplay.innerHTML = isLoading ? '<span class="spinner mini-spin"></span>' : icon(state.playing ? 'pause' : 'play', 22);
  if (pplay) {
    pplay.innerHTML = isLoading ? '<span class="spinner p-spin"></span>' : icon(state.playing ? 'pause' : 'play', 30);
    pplay.classList.toggle('loading', isLoading);
  }

  const errEl = $('#playerError');
  if (errEl) {
    if (state.playbackError && t) {
      errEl.style.display = 'flex';
      errEl.innerHTML = '<span>Não foi possível carregar esta música.</span><button type="button" data-action="retryTrack">Tentar de novo</button>';
    } else {
      errEl.style.display = 'none';
    }
  }
  const lyricsBtn = $('#pLyrics');
  if (lyricsBtn) {
    const sheet = $('#lyricsSheet');
    lyricsBtn.classList.toggle('active', !!(sheet && sheet.style.display !== 'none'));
  }

  const shuffle = $('#pShuffle'), repeat = $('#pRepeat'), like = $('#pLike'), dl = $('#pDownload');
  if (shuffle) shuffle.classList.toggle('active', state.shuffle);
  if (repeat) repeat.classList.toggle('active', state.repeat !== 'off');
  if (repeat) repeat.classList.toggle('one', state.repeat === 'one');
  if (like) {
    const on = state.liked.has(t.id);
    like.classList.toggle('active', on);
    like.innerHTML = icon(on ? 'heart' : 'heartOutline', 24);
    like.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (dl) {
    const on = state.downloads.has(t.id);
    const pct = state.downloading.get(t.id);
    dl.classList.toggle('active', on);
    dl.innerHTML = pct != null ? `<span class="dl-pct">${Math.round(pct)}%</span>` : icon(on ? 'check' : 'download', 24);
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
      ${i === state.queueIndex ? `<div class="track-dur">${icon('play', 16)}</div>` : ''}
    </div>`;
  }).join('');
}
function openPlayer() {
  if (!state.current) { toast('Escolha uma música primeiro.'); return; }
  if (state.playerOpen) return;
  state.playerOpen = true;
  const p = $('#player');
  if (p) p.style.display = 'flex';
  renderPlayerUI();
  renderQueueUI();
  ensureOverlayHistory();
  // Dica única: ensina o gesto de arrastar para trocar de música.
  if (!localStorage.getItem('swipeTipSeen')) {
    try { localStorage.setItem('swipeTipSeen', '1'); } catch (e) {}
    setTimeout(() => { if (state.playerOpen) toast('Arraste a capa para o lado para trocar de música', 3600); }, 600);
  }
}
function closePlayer() {
  state.playerOpen = false;
  const p = $('#player');
  if (p) p.style.display = 'none';
  if (window.LyricsUI) window.LyricsUI.close();
}

// ---------- Voltar (botão e gesto do Android) ----------
let overlayHistory = false;
function hasOverlay() {
  return state.playerOpen || !!state.settingsSection || state.route === 'config' ||
    (state.route === 'detalhe' && !!state.detail);
}
function ensureOverlayHistory() {
  if (overlayHistory || !hasOverlay()) return;
  overlayHistory = true;
  try { history.pushState({ musicOverlay: true }, ''); }
  catch (e) { overlayHistory = false; }
}
function releaseOverlayHistory() {
  if (!overlayHistory) return;
  overlayHistory = false;
  try { history.back(); } catch (e) {}
}
function syncOverlayHistory() {
  if (hasOverlay()) ensureOverlayHistory(); else releaseOverlayHistory();
}
function goBackInternal() {
  if (state.playerOpen) {
    const sheet = $('#lyricsSheet');
    if (sheet && sheet.style.display !== 'none' && window.LyricsUI) { window.LyricsUI.close(); return; }
    closePlayer();
    return;
  }
  if (state.settingsSection) {
    state.settingsSection = null;
    renderConfig();
    updateShell();
    return;
  }
  if (state.route === 'detalhe') {
    const prev = state.navStack.pop();
    if (prev) { state.detail = prev.detail; showScreen(prev.route); }
    else { state.detail = null; state.rootTab = 'inicio'; showScreen('inicio'); }
    return;
  }
  if (state.route === 'config') {
    state.rootTab = 'inicio';
    showScreen('inicio');
  }
}
function triggerUIBack() {
  goBackInternal();
  syncOverlayHistory();
}
window.addEventListener('popstate', () => {
  if (!hasOverlay()) { overlayHistory = false; return; }
  overlayHistory = false;
  goBackInternal();
  if (hasOverlay()) ensureOverlayHistory();
});

// ---------- Gestos do player (arrastar para trocar de música) ----------
function slideTrack(dir) {
  const slide = $('#playerSlide');
  if (!slide) return;
  slide.classList.remove('swipe-next', 'swipe-prev');
  void slide.offsetWidth;
  slide.classList.add(dir === 'next' ? 'swipe-next' : 'swipe-prev');
  setTimeout(() => slide.classList.remove('swipe-next', 'swipe-prev'), 340);
}
function initPlayerGestures() {
  const slide = $('#playerSlide');
  const minip = $('#minip');
  if (!slide) return;
  const hasPointer = 'PointerEvent' in window;

  // Evita o clique fantasma disparado depois de arrastar (abriria o player).
  let clickGuardUntil = 0;
  const suppressNextClick = () => { clickGuardUntil = Date.now() + 420; };
  document.addEventListener('click', (e) => {
    if (Date.now() > clickGuardUntil) return;
    if (!e.target.closest || !e.target.closest('#playerSlide, #minip')) return;
    clickGuardUntil = 0;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  function bindSwipe(el, opts) {
    if (!el) return;
    const ignore = opts.ignore || '';
    const threshold = opts.threshold || 44;
    let sx = 0, sy = 0, st = 0, active = false, dragging = false;

    const reset = () => {
      active = false; dragging = false;
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    };
    const begin = (x, y) => {
      sx = x; sy = y; st = Date.now();
      active = true; dragging = false;
      el.style.transition = 'none';
    };
    const move = (x, y) => {
      if (!active) return false;
      const dx = x - sx, dy = y - sy;
      if (!dragging) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return false;
        // Gesto vertical: deixa a tela rolar e cancela o arrasto.
        if (Math.abs(dy) > Math.abs(dx) * 1.15) { reset(); return false; }
        dragging = true;
        el.style.transition = 'none';
      }
      const clamped = Math.max(-150, Math.min(150, dx));
      el.style.transform = 'translateX(' + clamped + 'px)';
      el.style.opacity = String(1 - Math.min(0.4, Math.abs(clamped) / 360));
      return true;
    };
    const end = (x, y) => {
      if (!active) return;
      const dx = x - sx, dy = y - sy;
      const dt = Math.max(1, Date.now() - st);
      const wasDragging = dragging;
      reset();
      if (!wasDragging) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const flick = Math.abs(dx) / dt > 0.45;
      if (Math.abs(dx) < threshold && !flick) return;
      suppressNextClick();
      if (dx < 0) opts.onNext(); else opts.onPrev();
    };

    if (hasPointer) {
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (ignore && e.target.closest && e.target.closest(ignore)) return;
        begin(e.clientX, e.clientY);
      });
      window.addEventListener('pointermove', (e) => {
        if (!active) return;
        if (move(e.clientX, e.clientY) && e.cancelable) e.preventDefault();
      }, { passive: false });
      window.addEventListener('pointerup', (e) => end(e.clientX, e.clientY));
      window.addEventListener('pointercancel', reset);
    } else {
      el.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        if (ignore && e.target.closest && e.target.closest(ignore)) return;
        begin(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      el.addEventListener('touchmove', (e) => {
        if (!active || e.touches.length !== 1) return;
        if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        if (t) end(t.clientX, t.clientY);
      }, { passive: true });
      el.addEventListener('touchcancel', reset, { passive: true });
    }
  }

  // Player: arrastar a capa/título para a esquerda = próxima, direita = anterior.
  bindSwipe(slide, {
    ignore: 'button, .prog-bar',
    threshold: 40,
    onNext: () => { slideTrack('next'); next(true); },
    onPrev: () => { slideTrack('prev'); prev(true); },
  });
  // Mini player: mesmo gesto, direto na barra.
  bindSwipe(minip, {
    ignore: '.minip-btn',
    threshold: 48,
    onNext: () => { next(true); },
    onPrev: () => { prev(true); },
  });

  document.addEventListener('keydown', (e) => {
    if (!state.playerOpen) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); slideTrack('next'); next(true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); slideTrack('prev'); prev(true); }
    else if (e.key === 'Escape') { e.preventDefault(); triggerUIBack(); }
  });
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
    <div class="track-dur">${fmtDur(t.dur)}</div>
    ${opts.noDownload ? '' : `<button class="track-more" data-dl="${esc(t.id)}" title="${dl ? 'Baixada' : 'Baixar'}" aria-label="Baixar">${dlPct != null ? `<span class="dl-pct">${Math.round(dlPct)}%</span>` : icon(dl ? 'check' : 'download', 20)}</button>`}
  </div>`;
}
function trackList(tracks, opts = {}) {
  if (!tracks.length) return '<div class="empty">Nenhuma música encontrada.</div>';
  const ids = tracks.map((t) => t.id).join('|');
  return `<div data-qlist="${esc(ids)}">${tracks.map((t) => trackRow(t, opts)).join('')}</div>`;
}
function hcardTrack(t) {
  const stamp = t.created || t.released || 0;
  const isNew = stamp && Date.now() - stamp < 14 * 86400000 && stamp <= Date.now() + 86400000;
  return `<div class="hcard" data-play="${esc(t.id)}">
    ${coverBox(t, 'hcard-cover')}
    ${isNew ? '<span class="new-badge">Novo</span>' : ''}
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
function brazilTracks() {
  return allTracks().filter((t) => t.br);
}
function brazilPicks(n = 14) {
  const groups = new Map();
  brazilTracks().forEach((t) => {
    const g = t.genre || 'Música brasileira';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  });
  const lists = [...groups.values()].map((list) => list.sort((a, b) => (b.plays || 0) - (a.plays || 0)));
  lists.sort((a, b) => b.length - a.length);
  const out = [];
  for (let i = 0; out.length < n && lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      if (list[i]) out.push(list[i]);
      if (out.length >= n) break;
    }
  }
  return out;
}
function buildPlaylists() {
  const NICE = {
    'Sertanejo': 'Sertanejo e modão',
    'Pagode': 'Pagode e samba',
    'Samba': 'Samba de raiz',
    'Forró': 'Forró e piseiro',
    'Piseiro': 'Piseiro e arrocha',
    'MPB': 'MPB essencial',
    'Bossa Nova': 'Bossa nova',
    'Funk brasileiro': 'Funk nacional',
    'Rap nacional': 'Rap nacional',
    'Trap brasileiro': 'Trap nacional',
    'Gospel brasileiro': 'Gospel brasileiro',
    'Brega': 'Brega e sofrência',
    'Axé': 'Axé e festa',
    'Pop brasileiro': 'Pop Brasil',
    'Rock nacional': 'Rock nacional',
    'Pop': 'Hits do pop nacional',
    'Country': 'Topnejo',
    'Latin': 'Topnejo',
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
  const preferred = [
    'Sertanejo', 'Pagode', 'Forró', 'Piseiro', 'MPB', 'Funk brasileiro',
    'Gospel brasileiro', 'Rap nacional', 'Axé', 'Pop brasileiro', 'Rock nacional',
    'Pop', 'Country', 'Funk', 'Lo-Fi', 'Electronic', 'House', 'Jazz',
  ];
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
  const brAll = brazilTracks().sort((a, b) => (b.plays || 0) - (a.plays || 0));
  if (brAll.length >= 6) {
    out.unshift({
      id: 'pl-br',
      genre: '__brazil__',
      name: 'Brasil em alta',
      artist: 'Sertanejo, pagode, samba e mais',
      tracks: brAll.slice(0, 80),
      brazil: true,
    });
  }
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
  if (back) {
    const showBack = state.route === 'config' || state.route === 'detalhe';
    back.style.display = showBack ? 'inline-flex' : 'none';
  }
  $$('.bn-item').forEach((b) => b.classList.toggle('active', b.dataset.route === state.rootTab));
  const tr = $('#topRight');
  if (tr) {
    if (state.route === 'inicio') {
      tr.innerHTML = `
        <button class="ico-btn" data-top="recent" title="Tocadas recentemente" aria-label="Tocadas recentemente">${icon('clock', 24)}</button>
        <button class="ico-btn" data-top="search" title="Pesquisar" aria-label="Pesquisar">${icon('search', 24)}</button>
        <button class="ico-btn" data-top="together" title="Ouvir juntos" aria-label="Ouvir juntos">${icon('people', 24)}</button>
        <button class="ico-btn" data-top="settings" title="Configurações" aria-label="Configurações">${icon('settings', 24)}</button>`;
    } else if (state.route === 'pesquisar') {
      tr.innerHTML = `<button class="ico-btn" data-top="settings" title="Configurações" aria-label="Configurações">${icon('settings', 24)}</button>`;
    } else tr.innerHTML = '';
  }
  // FAB somente no início
  let fab = $('#fabWrap');
  if (state.route === 'inicio') {
    if (!fab) {
      fab = document.createElement('div');
      fab.id = 'fabWrap'; fab.className = 'fab-wrap';
      fab.innerHTML = `<button class="fab mic" id="fabMic" title="Pesquisar" aria-label="Pesquisar">${icon('search', 24)}</button><button class="fab shuffle" id="fabShuffle" title="Rádio aleatório" aria-label="Rádio aleatório">${icon('shuffle', 24)}</button>`;
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
  const byRelease = [...state.catalog].sort((a, b) => (b.created || b.released || 0) - (a.created || a.released || 0));
  const launches = byRelease.slice(0, 20);
  const recommended = [...state.catalog]
    .sort((a, b) => (b.plays || 0) - (a.plays || 0))
    .slice(0, 20);
  const allRecent = byRelease.slice(0, 14);
  const chips = CHIPS.map((c, i) => `<div class="chip ${i === 0 ? 'active' : ''}" data-chip="${esc(c)}">${esc(c)}</div>`).join('');
  const brTracks = brazilTracks();
  const brPicks = brazilPicks(14);

  el.innerHTML = `
    ${!state.online ? '<div class="offline-banner">Sem internet — mostrando o catálogo salvo. Baixe músicas para ouvir offline.</div>' : ''}
    <div class="chips">${chips}</div>

    ${brTracks.length ? `<div class="section br-section">
      <div class="section-head"><h2 class="section-title">Música brasileira</h2><button class="section-arrow" data-open-type="brazil" data-open-key="Música brasileira">›</button></div>
      <div class="section-sub">${brTracks.length} faixas · sertanejo, pagode, samba, forró, MPB, piseiro e mais</div>
      <div class="hscroll">${brPicks.map(hcardTrack).join('')}</div>
      <button class="btn ghost wide" data-open-type="brazil" data-open-key="Música brasileira">Ver todas as músicas brasileiras</button>
    </div>` : (!state.brazilLoaded && state.online ? `<div class="section br-section">
      <div class="section-head"><h2 class="section-title">Música brasileira</h2></div>
      <div class="section-sub">Carregando sertanejo, pagode, samba, forró, MPB e mais… <span class="spinner mini-spin"></span></div>
    </div>` : (state.brazilTried && state.online ? `<div class="section br-section">
      <div class="section-head"><h2 class="section-title">Música brasileira</h2><button class="section-arrow" data-action="reloadBrazil">Tentar de novo</button></div>
      <div class="section-sub">Não foi possível carregar agora. Toque em tentar de novo.</div>
    </div>` : ''))}

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

    <div class="section">
      <div class="section-head"><h2 class="section-title">Todas as músicas</h2><button class="section-arrow" data-open-type="all" data-open-key="Todas as músicas">›</button></div>
      <div class="section-sub">${state.catalog.length} faixas no catálogo · atualizado agora</div>
      ${hasCatalog ? trackList(allRecent) : '<div class="empty">Carregando catálogo<br><span class="spinner"></span></div>'}
      ${hasCatalog ? `<button class="btn ghost wide" data-open-type="all" data-open-key="Todas as músicas">Ver as ${state.catalog.length} músicas</button>` : ''}
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
      <span class="search-ico">${icon('search', 20)}</span>
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
    state.searchShown = 60;
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
    state.searchQuery = ''; state.searchShown = 60; input.value = ''; $('#searchClear').style.display = 'none';
    input.focus(); renderSearchBody();
  });
  renderSearchBody();
}
function scoreTrack(t, ql) {
  const title = String(t.title || '').toLowerCase();
  const artist = String(t.artist || '').toLowerCase();
  const genre = String(t.genre || '').toLowerCase();
  const album = String(t.album || '').toLowerCase();
  const hay = title + ' ' + artist + ' ' + genre + ' ' + album;
  let score = 0;
  if (hay.includes(ql)) score += 40;
  const tokens = ql.split(/\s+/).filter((x) => x.length > 1);
  if (tokens.length) {
    const hits = tokens.filter((tok) => hay.includes(tok)).length;
    score += hits * 8;
  }
  if (title === ql) score += 120;
  else if (title.startsWith(ql)) score += 70;
  else if (title.includes(ql)) score += 45;
  if (artist === ql) score += 60;
  else if (artist.startsWith(ql)) score += 35;
  else if (artist.includes(ql)) score += 20;
  if (genre.includes(ql)) score += 8;
  if (album.includes(ql)) score += 5;
  return score;
}
function rankMatches(list, q) {
  const ql = q.toLowerCase().trim();
  const seen = new Set();
  const scored = [];
  for (const t of list) {
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    scored.push({ t, score: scoreTrack(t, ql) });
  }
  // Resultados sem correspondência literal (tags/descrição da nuvem) não somem:
  // ficam no fim, depois dos matches de título/artista.
  return scored.sort((a, b) => b.score - a.score).map((x) => x.t);
}
function renderSearchBody() {
  const el = $('#searchBody');
  if (!el || state.route !== 'pesquisar') return;
  const q = state.searchQuery.trim();
  const filter = state.searchFilter;
  const all = allTracks();

  if (!q) {
    const groups = genreGroups().slice(0, 6);
    const hot = [...all].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 10);
    el.innerHTML = `
      ${state.recent.length ? `<div class="section"><div class="section-head"><h2 class="section-title">Tocadas recentemente</h2></div>
        ${trackList(state.recent.map(trackById).filter(Boolean).slice(0, 5), { noDownload: true })}</div>` : ''}
      <div class="section"><div class="section-head"><h2 class="section-title">Em alta agora</h2></div>
        <div class="hscroll">${hot.map(hcardTrack).join('') || '<div class="empty">Carregando…</div>'}</div></div>
      <div class="section"><div class="section-head"><h2 class="section-title">Navegar por gêneros</h2></div>
        <div class="grid2">${MOODS.map((m) => `<div class="moment-card" style="background:${m.grad};height:70px" data-open-type="mood" data-open-key="${esc(m.label)}"><span>${esc(m.label)}</span></div>`).join('')}</div></div>
      <div class="section"><div class="section-head"><h2 class="section-title">Gêneros</h2></div>
        <div class="chips">${groups.map((g) => `<div class="chip" data-open-type="genre" data-open-key="${esc(g.genre)}">${esc(g.genre)}</div>`).join('')}</div></div>
    `;
    return;
  }

  const ql = q.toLowerCase();
  const tracks = rankMatches(all, q);
  const spinner = state.searching ? '<div class="search-status"><span class="spinner"></span> Buscando na nuvem…</div>' : '';
  const errBanner = state.searchError
    ? `<div class="search-error"><span>${esc(state.searchError)}</span><button type="button" data-search-retry>Recarregar</button></div>`
    : '';
  const head = spinner + errBanner;

  if (filter === 'Artistas') {
    const artists = [...new Set(tracks.slice(0, 60).map((t) => t.artist))].filter(Boolean);
    el.innerHTML = head + `<div class="section"><div class="section-head"><h2 class="section-title">Artistas</h2></div>
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
    const albums = [...new Set(tracks.slice(0, 60).map((t) => t.album || t.genre))].filter(Boolean);
    el.innerHTML = head + `<div class="section"><div class="section-head"><h2 class="section-title">Álbuns</h2></div>
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
    el.innerHTML = head + `<div class="section"><div class="section-head"><h2 class="section-title">Playlists</h2></div>
      ${pls.length ? pls.map((p) => `<div class="track" data-open-type="playlist" data-open-key="${esc(p.genre)}">
        ${coverBox(p.tracks[0], 'track-cover')}
        <div class="track-info"><div class="track-title">${esc(p.name)}</div><div class="track-artist">${p.tracks.length} músicas · ${esc(p.artist)}</div></div>
        <div class="track-dur">›</div></div>`).join('') : '<div class="empty">Nenhuma playlist encontrada.</div>'}</div>`;
    return;
  }

  // Tudo / Músicas
  const shown = Math.max(60, state.searchShown || 60);
  const list = tracks.slice(0, shown);
  const remaining = Math.max(0, tracks.length - list.length);
  if (q.length >= 2 && state.mbQuery !== q && !state.mbLoading) {
    state.mbQuery = q; // mark requested
    // trigger async fetch
    fetchMusicBrainz(q);
  }
  const mbSection = q.length >= 2 ? renderMusicBrainzSection(q) : '';
  el.innerHTML = `${head}
    ${list.length ? `<div class="section"><div class="section-head"><h2 class="section-title">Músicas</h2><span class="section-count">${tracks.length}</span></div>${trackList(list)}
      ${remaining ? `<button class="btn ghost wide" data-search-more>Mostrar mais ${Math.min(60, remaining)} de ${remaining}</button>` : ''}</div>`
      : (state.searching ? '' : '<div class="empty">Nada encontrado para esta busca.<br>Tente outro nome de música ou artista.</div>')}
    ${mbSection}`;
}
async function runSearch(q) {
  if (!q || q.length < 2) return;
  const token = ++state.searchToken;
  state.searching = true;
  state.searchError = '';
  state.searchShown = 60;
  renderSearchBody();
  const enc = encodeURIComponent(q);
  const endpoints = [
    `/tracks/search?query=${enc}&app_name=${APP_NAME}&limit=100&sort_method=relevant`,
    `/tracks/search?query=${enc}&app_name=${APP_NAME}&limit=100&sort_method=recent`,
    `/tracks/search?query=${enc}&app_name=${APP_NAME}&limit=100&offset=100&sort_method=recent`,
    `/tracks/search?query=${enc}&app_name=${APP_NAME}&limit=100&sort_method=popular`,
  ];
  try {
    const settled = await Promise.allSettled(endpoints.map((p) => apiFetch(p)));
    if (token !== state.searchToken) return;
    let list = [];
    let ok = 0;
    settled.forEach((r) => {
      if (r.status === 'fulfilled') { ok++; list = list.concat(normalizeTracks(r.value)); }
    });
    if (list.length) mergeCatalog(list);
    state.online = navigator.onLine;
    if (!ok) throw new Error('search failed');
    if (!list.length && !state.catalog.some((t) => scoreTrack(t, q.toLowerCase().trim()) > 0)) {
      state.searchError = '';
    }
  } catch (e) {
    if (token === state.searchToken) {
      state.online = navigator.onLine;
      state.searchError = navigator.onLine
        ? 'A busca na nuvem falhou agora. Mostrando o catálogo salvo.'
        : 'Você está sem internet. Mostrando o catálogo salvo.';
    }
  }
  state.searching = false;
  if (token === state.searchToken && state.route === 'pesquisar') renderSearchBody();
}

function renderMusicBrainzSection(q) {
  const results = state.mbResults || [];
  const loading = state.mbLoading && state.mbQuery === q;
  if (loading) {
    return `<div class="section"><div class="section-head"><h2 class="section-title">MusicBrainz (metadados)</h2></div>
      <div class="section-sub">Buscando 40M+ registros… <span class="spinner mini-spin"></span></div></div>`;
  }
  if (!results.length) {
    return `<div class="section"><div class="section-head"><h2 class="section-title">MusicBrainz (metadados)</h2></div>
      <div class="section-sub">Nenhum metadado encontrado (ou busca ainda não concluída).</div></div>`;
  }
  return `<div class="section"><div class="section-head"><h2 class="section-title">MusicBrainz (metadados)</h2><span class="section-count">${results.length}</span></div>
    <div class="section-sub">Metadados de 40M+ gravações. Tocar abre busca externa.</div>
    ${results.map((r) => `<div class="track" data-mb-open="${esc(r.title + ' ' + r.artist)}">
      <div class="track-cover cover" style="background:linear-gradient(135deg,#6c5ce7,#a29bfe)"><span class="cover-ph">♪</span></div>
      <div class="track-info"><div class="track-title">${esc(r.title)}</div><div class="track-artist">${esc(r.artist)}${r.dur ? ' · ' + fmt(r.dur / 1000) : ''}</div></div>
      <div class="track-dur">›</div>
    </div>`).join('')}</div>`;
}
async function fetchMusicBrainz(q) {
  const token = ++state.mbToken;
  state.mbLoading = true;
  state.mbQuery = q;
  state.mbResults = [];
  if (state.route === 'pesquisar') renderSearchBody();
  // Rate limit MusicBrainz: 1 req/s
  await wait(1100);
  if (token !== state.mbToken) { state.mbLoading = false; return; }
  try {
    const r = await fetch('https://musicbrainz.org/ws/2/recording/?query=' + encodeURIComponent(q) + '&fmt=json&limit=25');
    const j = await r.json();
    if (token !== state.mbToken) { state.mbLoading = false; return; }
    state.mbResults = (j.recordings || []).map((rec) => ({
      title: rec.title || 'Faixa',
      artist: (rec['artist-credit'] || []).map((a) => a.name).join(', ') || 'Artista',
      dur: rec.length || 0,
      id: rec.id,
    }));
  } catch (e) {
    state.mbResults = [];
  }
  state.mbLoading = false;
  if (state.route === 'pesquisar' && state.searchQuery.trim() === q) renderSearchBody();
}
function openExternalListen(query) {
  const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
  try { window.open(url, '_blank'); } catch (e) { location.href = url; }
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
        <button class="track-more" data-remove="${esc(t.id)}" title="Remover" aria-label="Remover">${icon('trash', 20)}</button>
      </div>`).join('')}</div>` : '<div class="empty">Nenhuma música baixada ainda.<br>Toque no botão de baixar em uma música para ouvir offline.</div>'}`;
    return;
  }
  if (state.libTab === 'favoritos') {
    const list = [...state.liked].map(trackById).filter(Boolean);
    content.innerHTML = list.length
      ? `<div data-qlist="${esc(list.map((t) => t.id).join('|'))}">${list.map((t) => trackRow(t)).join('')}</div>`
      : '<div class="empty">Nenhuma música favorita ainda.<br>Toque no coração no player para favoritar.</div>';
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
    if (d.key === '__brazil__') return all.filter((t) => t.br).sort((a, b) => (b.plays || 0) - (a.plays || 0));
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
  if (d.type === 'brazil') return all.filter((t) => t.br).sort((a, b) => (b.plays || 0) - (a.plays || 0));
  if (d.type === 'recent') return state.recent.map(trackById).filter(Boolean);
  if (d.type === 'all') {
    const k = String(d.key || '').toLowerCase();
    if (k.includes('lan') || k.includes('novidade') || k.includes('toda')) {
      return [...all].sort((a, b) => (b.created || b.released || 0) - (a.created || a.released || 0));
    }
    if (k.includes('recomend') || k.includes('alta') || k.includes('momento')) {
      return [...all].sort((a, b) => (b.plays || 0) - (a.plays || 0));
    }
    return all;
  }
  return all;
}
function openDetail(type, key) {
  const special = type === 'playlist' && key === '__discover__' ? 'Descobertas da semana'
    : type === 'playlist' && key === '__brazil__' ? 'Brasil em alta'
    : key;
  const titles = { playlist: special, genre: key, mood: key, album: key, artist: key, recent: 'Tocadas recentemente', all: key || 'Tudo', brazil: key || 'Música brasileira' };
  state.navStack.push({ route: state.route, detail: state.detail });
  state.detail = { type, key, title: titles[type] || key || 'Music' };
  state.detailShown = 80;
  if ((type === 'brazil' || key === '__brazil__') && !brazilTracks().length) loadBrazil();
  showScreen('detalhe');
  const sc = screenEl('detalhe'); if (sc) sc.scrollTop = 0;
  ensureOverlayHistory();
}
function detailVisible(tracks) {
  const shown = Math.max(80, state.detailShown || 80);
  return tracks.slice(0, shown);
}
function renderDetailList(tracks) {
  const host = $('#detailList');
  if (!host) return;
  const list = detailVisible(tracks);
  const remaining = Math.max(0, tracks.length - list.length);
  host.innerHTML = trackList(list) + (remaining
    ? `<button class="btn ghost wide" data-detail-more>Mostrar mais ${Math.min(80, remaining)} de ${remaining}</button>`
    : '');
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
        <button class="btn" id="playAll">${icon('play', 18)} Tocar tudo</button>
        <button class="btn ghost" id="shuffleAll">${icon('shuffle', 18)} Aleatório</button>
      </div>
    </div>
    <div id="detailList"></div>
  `;
  renderDetailList(tracks);
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
  if (id === 'permissoes') {
    if (!Native.available) return 'Disponível no APK Android';
    const p = state.permissions;
    if (!p) return 'Verificando…';
    const ok = [p.notifications, p.storage, p.unknownSources, p.batteryOptimization].filter(Boolean).length;
    return ok + ' de 4 liberadas';
  }
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
      <div class="cfg-icon">${icon(c.icon, 22)}</div>
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
      <div class="avatar">${icon('headset', 30)}</div>
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
      <p class="cfg-sub" style="margin-top:12px">Abra uma música, toque em 🎤 no player e depois em “Traduzir (IA)”. A tradução aparece logo abaixo de cada trecho da letra.</p></div>`;
  } else if (id === 'permissoes') {
    body = permissionSettingsHTML();
    if (Native.available && !state.permissions) {
      Native.check().then((s) => { if (s) { state.permissions = s; updatePermissionUI(); } });
    }
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
        <button class="track-more" data-remove="${esc(t.id)}" aria-label="Remover">${icon('trash', 20)}</button></div>`).join('') : '<div class="empty">Nenhum download.</div>'}`;
  } else if (id === 'backup') {
    body = `<div class="card"><div class="card-title">Backup e restauração</div>
      <p class="cfg-sub">Copie um backup dos favoritos e preferências. Os arquivos baixados não entram no backup.</p>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-action="backup">Copiar backup</button><button class="btn ghost" data-action="restore">Restaurar</button></div></div>`;
  } else if (id === 'sobre') {
    body = `<div class="card"><div class="app-logo">${icon('music', 30)}</div><div class="card-title" style="font-size:20px">Music</div>
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
  if (key === 'translateLyrics' && window.LyricsUI) window.LyricsUI.setAuto(!!state.settings.translateLyrics);
  renderConfig();
}

// ---------- Permissões (Android) ----------
const PERM_LIST = [
  { key: 'notifications', statusKey: 'notifications', icon: 'bell', title: 'Notificações', sub: 'Controles da música na tela de bloqueio e na barra' },
  { key: 'storage', statusKey: 'storage', icon: 'storage', title: 'Armazenamento interno', sub: 'Salvar as músicas baixadas no aparelho' },
  { key: 'unknown', statusKey: 'unknownSources', icon: 'package', title: 'Instalar fontes desconhecidas', sub: 'Permite instalar novas versões do APK' },
  { key: 'battery', statusKey: 'batteryOptimization', icon: 'battery', title: 'Segundo plano sem pausas', sub: 'Impede o Android de interromper a música' },
];
function permissionNeeds(p) {
  if (!p) return PERM_LIST.map((x) => x.key);
  return PERM_LIST.filter((it) => !p[it.statusKey]).map((it) => it.key);
}
function permissionRowHTML(it, p) {
  const ok = !!(p && p[it.statusKey]);
  return `<div class="perm-item" data-perm="${it.key}">
    <div class="cfg-icon">${icon(it.icon, 22)}</div>
    <div class="perm-item-text"><div class="perm-item-title">${it.title}</div><div class="perm-item-sub">${it.sub}</div></div>
    <div class="perm-badge ${ok ? 'ok' : 'todo'}">${ok ? 'Liberado' : 'Permitir'}</div>
  </div>`;
}
function permissionSettingsHTML() {
  if (!Native.available) {
    return `<div class="card"><div class="card-title">Permissões do aplicativo</div>
      <p class="cfg-sub">As permissões de armazenamento, notificações e segundo plano são solicitadas dentro do APK Android. No navegador não são necessárias.</p></div>`;
  }
  if (!state.permissions) return `<div class="card"><div class="search-status"><span class="spinner"></span> Verificando permissões…</div></div>`;
  return `<div class="card">${PERM_LIST.map((it) => permissionRowHTML(it, state.permissions)).join('')}</div>
    <div class="btn-row" style="margin-top:12px">
      <button class="btn" data-action="allowAll">Permitir tudo</button>
      <button class="btn ghost" data-action="openAppSettings">Abrir ajustes do app</button>
    </div>
    <p class="cfg-sub" style="margin-top:12px">Se alguma janela não abrir, libere manualmente em Configurações do Android › Apps › Music › Permissões.</p>`;
}
function showPermissionSheet() {
  const overlay = $('#permOverlay');
  if (!overlay || !Native.available) return;
  const p = state.permissions || {};
  overlay.innerHTML = `<div class="perm-sheet">
    <div class="perm-logo">${icon('lock', 28)}</div>
    <h2 class="perm-title">Permissões do Music</h2>
    <p class="perm-sub">Para tocar em segundo plano, salvar músicas e instalar atualizações, libere estas permissões. Você pode mudar isso depois em Configurações.</p>
    ${PERM_LIST.map((it) => permissionRowHTML(it, p)).join('')}
    <div class="perm-actions">
      <button class="btn" data-action="allowAll">Permitir tudo</button>
      <button class="btn ghost" data-action="permLater">Agora não</button>
    </div>
    <p class="perm-note">“Instalar fontes desconhecidas” serve para você instalar novas versões do APK. O Music não instala nada sozinho.</p>
  </div>`;
  overlay.style.display = 'flex';
}
function hidePermissionSheet() {
  const o = $('#permOverlay');
  if (o) { o.style.display = 'none'; o.innerHTML = ''; }
}
function updatePermissionUI() {
  const overlay = $('#permOverlay');
  if (overlay && overlay.style.display !== 'none') {
    PERM_LIST.forEach((it) => {
      const item = overlay.querySelector(`[data-perm="${it.key}"]`);
      if (!item) return;
      const badge = item.querySelector('.perm-badge');
      const ok = !!(state.permissions && state.permissions[it.statusKey]);
      if (badge) { badge.className = 'perm-badge ' + (ok ? 'ok' : 'todo'); badge.textContent = ok ? 'Liberado' : 'Permitir'; }
    });
  }
  if (state.route === 'config' && state.settingsSection === 'permissoes') renderConfig();
  const sub = $('[data-cfg="permissoes"] .cfg-sub');
  if (sub) sub.textContent = cfgSub('permissoes');
  const tr = $('#topRight');
  if (tr && state.route === 'inicio') { /* mantém os botões do topo */ }
}
function requestPermission(key) {
  if (!Native.available) { toast('Permissões disponíveis apenas no APK Android.'); return; }
  if (key === 'notifications' || key === 'storage' || key === 'all') {
    Native.request(key === 'all' ? 'all' : key);
    pollPermissions(key === 'all' ? 14 : 10);
  } else if (key === 'unknown') Native.openUnknown();
  else if (key === 'battery') Native.battery();
  else if (key === 'settings') Native.appSettings();
}
function pollPermissions(times = 10) {
  let n = 0;
  const tick = async () => {
    n++;
    const s = await Native.check();
    if (s) {
      state.permissions = s;
      updatePermissionUI();
      if (permissionNeeds(s).length === 0) {
        hidePermissionSheet();
        toast('Tudo pronto! Reprodução em segundo plano liberada.');
        return;
      }
    }
    if (n < times) setTimeout(tick, 700);
  };
  setTimeout(tick, 400);
}
async function initPermissions() {
  if (!Native.available) return;
  try {
    const s = await Native.check();
    if (!s) return;
    state.permissions = s;
    updatePermissionUI();
    const needs = permissionNeeds(s);
    const snooze = Number(localStorage.getItem('permSnooze') || 0);
    if (needs.length && Date.now() > snooze) showPermissionSheet();
  } catch (e) {}
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
  $$(`[data-dl="${String(id)}"]`).forEach((b) => {
    b.innerHTML = pct != null ? `<span class="dl-pct">${Math.round(pct)}%</span>` : icon(state.downloads.has(String(id)) ? 'check' : 'download', 20);
  });
}
function refreshDownloadButtons() {
  $$('[data-dl]').forEach((b) => {
    const id = b.dataset.dl;
    const pct = state.downloading.get(id);
    b.innerHTML = pct != null ? `<span class="dl-pct">${Math.round(pct)}%</span>` : icon(state.downloads.has(id) ? 'check' : 'download', 20);
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
  if (action === 'retryTrack') {
    if (!state.current) return;
    retryCount.delete(state.current.id);
    state.playbackError = false;
    loadTrack(state.current, true);
    return;
  }
  if (action === 'reloadBrazil') {
    state.brazilLoaded = false;
    state.brazilTried = false;
    renderInicio();
    loadBrazil();
    toast('Buscando mais música brasileira…');
    return;
  }
  if (action === 'allowAll') {
    if (!Native.available) { toast('Permissões disponíveis apenas no APK Android.'); return; }
    const p = state.permissions || {};
    if (!p.notifications || !p.storage) Native.request('all');
    pollPermissions(14);
    toast('Libere as janelas que abrirem. Depois toque nas outras permissões.');
    return;
  }
  if (action === 'permLater') {
    try { localStorage.setItem('permSnooze', String(Date.now() + 12 * 3600 * 1000)); } catch (e) {}
    hidePermissionSheet();
    toast('Você pode liberar depois em Configurações › Permissões.');
    return;
  }
  if (action === 'openAppSettings') { requestPermission('settings'); return; }
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
  const permItem = e.target.closest('[data-perm]');
  if (permItem) { requestPermission(permItem.dataset.perm); return; }

  const searchRetry = e.target.closest('[data-search-retry]');
  if (searchRetry) { runSearch(state.searchQuery.trim()); return; }

  const searchMore = e.target.closest('[data-search-more]');
  if (searchMore) {
    state.searchShown = (state.searchShown || 60) + 60;
    renderSearchBody();
    return;
  }

  const detailMore = e.target.closest('[data-detail-more]');
  if (detailMore && state.detail) {
    state.detailShown = (state.detailShown || 80) + 80;
    renderDetailList(detailTracks(state.detail));
    return;
  }

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

  const mbOpen = e.target.closest('[data-mb-open]');
  if (mbOpen) { openExternalListen(mbOpen.dataset.mbOpen); return; }

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
    if (a === 'settings') { state.rootTab = 'inicio'; state.settingsSection = null; showScreen('config'); ensureOverlayHistory(); }
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
    syncOverlayHistory();
  }
});

// ---------- Init ----------
async function init() {
  applyTheme(state.appearance);
  $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, 24); });
  const pPlayInit = $('#pPlay'); if (pPlayInit) pPlayInit.innerHTML = icon('play', 30);
  const pLikeInit = $('#pLike'); if (pLikeInit) pLikeInit.innerHTML = icon('heartOutline', 24);
  const pDlInit = $('#pDownload'); if (pDlInit) pDlInit.innerHTML = icon('download', 24);
  const miniPlayInit = $('#minipPlay'); if (miniPlayInit) miniPlayInit.innerHTML = icon('play', 22);
  state.catalog = normalizeTracks(FALLBACK);
  await loadDownloads();
  initAudio();
  initPlayerGestures();
  showScreen('inicio');
  initPermissions();

  Native.onAction((action) => {
    if (action === 'toggle') togglePlay();
    else if (action === 'play') play();
    else if (action === 'pause') pause();
    else if (action === 'next') next();
    else if (action === 'prev') prev();
    else if (action === 'stop') { pause(); Native.stop(); nativeRunning = false; }
  });

  if (window.LyricsUI) {
    window.LyricsUI.init({
      getTranslate: () => !!state.settings.translateLyrics,
      toast,
      onTranslateChange: (val) => {
        state.settings.translateLyrics = !!val;
        saveSettings();
        if (state.route === 'config') renderConfig();
        if (window.LyricsUI) window.LyricsUI.setAuto(!!val);
      },
      onClose: () => renderPlayerUI(),
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (audio) {
      state.playing = !audio.paused && !audio.ended;
      state.loading = false;
      renderPlayerUI();
      if (state.playerOpen) renderQueueUI();
      if (state.current) syncNative(state.playing, false);
    }
    if (Native.available) {
      Native.check().then((s) => { if (s) { state.permissions = s; updatePermissionUI(); } });
    }
  });

  window.addEventListener('online', () => { state.online = true; toast('Conectado'); loadDiscover().then(() => loadBrazil()).then(() => loadGenreCatalog()); });
  window.addEventListener('offline', () => { state.online = false; toast('Sem internet'); renderInicio(); });

  $('#btnBack').addEventListener('click', triggerUIBack);

  const minip = $('#minip');
  if (minip) minip.addEventListener('click', (e) => { if (e.target.closest('.minip-btn')) return; openPlayer(); });
  $('#minipPlay').addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  $('#minipPrev').addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  $('#minipNext').addEventListener('click', (e) => { e.stopPropagation(); next(); });
  $('#playerClose').addEventListener('click', triggerUIBack);
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
  $('#pLyrics').addEventListener('click', () => {
    const t = state.current;
    if (!t) { toast('Escolha uma música primeiro.'); return; }
    if (window.LyricsUI) window.LyricsUI.toggle(t);
  });
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

  loadDiscover().then(() => loadBrazil()).then(() => loadGenreCatalog()).catch(() => loadBrazil());
}

init();
window.MusicApp = { state, playTrack, downloadTrack, openPlayer };
