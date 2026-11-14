/* ============================================================
   Letras + tradução por IA
   Letras: LRCLIB (https://lrclib.net)
   Tradução: Google Translate (endpoint público gtx) com
   fallback para MyMemory. Tudo com cache local.
   ============================================================ */
(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const CACHE_MS = 1000 * 60 * 60 * 24 * 30;

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
    if (n > 36000) n = n / 1000;
    return n;
  }
  function cacheGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function cacheSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function cleanArtist(a) {
    return String(a || '')
      .replace(/^@+/, '')
      .replace(/\s*[-–]\s*topic$/i, '')
      .replace(/\s+(feat\.?|ft\.?|com)\s+.*$/i, '')
      .trim();
  }
  function cleanTitle(t) {
    return String(t || '')
      .replace(/\((?:official|oficial|lyrics?|letra|audio|áudio|video|vídeo|visualizer|hd|hq|explicit|clean)[^)]*\)/gi, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s*[-–]\s*(?:official|oficial|lyrics?|letra|audio|áudio|video|vídeo).*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function splitBlocks(text) {
    let blocks = String(text || '').split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
    if (blocks.length <= 1) {
      const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
      blocks = [];
      for (let i = 0; i < lines.length; i += 4) blocks.push(lines.slice(i, i + 4).join('\n'));
    }
    return blocks;
  }

  let deps = { getTranslate: () => false, toast: () => {}, onTranslateChange: () => {}, onClose: () => {} };
  let track = null;
  let data = null;
  let translation = null;
  let showTranslated = false;
  let translating = false;
  let reqId = 0;

  async function load(t) {
    const key = 'lyr:v3:' + t.id;
    const cached = cacheGet(key);
    if (cached && Date.now() - (cached.at || 0) < CACHE_MS) return cached;

    const artist = cleanArtist(t.artist);
    const title = cleanTitle(t.title);
    const dur = Math.round(toSeconds(t.dur));
    let best = null;

    try {
      const u = new URL('https://lrclib.net/api/get');
      u.searchParams.set('artist_name', artist);
      u.searchParams.set('track_name', title);
      if (dur) u.searchParams.set('duration', String(dur));
      const r = await fetch(u.toString(), { headers: { Accept: 'application/json' } });
      if (r.ok) best = await r.json();
    } catch (e) {}

    if (!best || (!best.plainLyrics && !best.instrumental)) {
      const queries = [`${artist} ${title}`.trim(), title];
      for (const query of queries) {
        if (!query) continue;
        try {
          const u2 = new URL('https://lrclib.net/api/search');
          u2.searchParams.set('q', query);
          const r2 = await fetch(u2.toString(), { headers: { Accept: 'application/json' } });
          if (!r2.ok) continue;
          const arr = await r2.json();
          if (Array.isArray(arr) && arr.length) {
            const usable = arr.filter((x) => x && (x.plainLyrics || x.instrumental));
            usable.sort((a, b) => Math.abs((a.duration || 0) - dur) - Math.abs((b.duration || 0) - dur));
            best = usable[0] || best;
            if (best && best.plainLyrics) break;
          }
        } catch (e) {}
      }
    }

    const out = {
      at: Date.now(),
      lyrics: best && best.plainLyrics ? String(best.plainLyrics).trim() : '',
      instrumental: !!(best && best.instrumental),
      synced: !!(best && best.syncedLyrics),
      source: 'LRCLIB',
      matched: best ? [best.trackName, best.artistName].filter(Boolean).join(' — ') : '',
    };
    if (out.lyrics || out.instrumental) cacheSet(key, out);
    return out;
  }
  function chunkText(text, max) {
    const lines = String(text).split('\n');
    const out = [];
    let cur = '';
    for (const line of lines) {
      if (line.length > max) {
        if (cur) { out.push(cur); cur = ''; }
        for (let i = 0; i < line.length; i += max) out.push(line.slice(i, i + max));
        continue;
      }
      if (cur && (cur + '\n' + line).length > max) { out.push(cur); cur = line; }
      else cur = cur ? cur + '\n' + line : line;
    }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  }
  async function googleTranslate(text) {
    const urls = [
      'https://translate.googleapis.com/translate_a/single?client=gtx&dj=1&sl=auto&tl=pt-BR&dt=t&q=',
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt-BR&dt=t&q=',
    ];
    let last = null;
    for (const base of urls) {
      try {
        const r = await fetch(base + encodeURIComponent(text), { cache: 'no-store' });
        if (!r.ok) throw new Error('translate ' + r.status);
        const j = await r.json();
        let out = '';
        if (j && Array.isArray(j.sentences)) {
          out = j.sentences.map((s) => (s && s.trans) || '').join('');
        } else if (Array.isArray(j) && Array.isArray(j[0])) {
          out = j[0].map((x) => (Array.isArray(x) ? (x[0] || '') : '')).join('');
        }
        if (out && out.trim()) return out;
        last = new Error('empty translate');
      } catch (e) { last = e; }
    }
    throw last || new Error('translate failed');
  }
  async function clients5Translate(text) {
    const url = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=pt-BR&q=' + encodeURIComponent(text);
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('clients5 ' + r.status);
    const j = await r.json();
    if (Array.isArray(j)) {
      if (Array.isArray(j[0])) return j[0].join('');
      if (j.every((x) => typeof x === 'string')) {
        // Alguns servidores devolvem uma frase por linha.
        return j.join(text.includes('\n') ? '\n' : '');
      }
    }
    if (j && Array.isArray(j.sentences)) return j.sentences.map((s) => (s && s.trans) || '').join('');
    if (j && typeof j.translatedText === 'string') return j.translatedText;
    throw new Error('bad clients5');
  }
  async function myMemoryTranslate(text) {
    const lines = String(text).split('\n');
    const out = [];
    let buf = [];
    const flush = async () => {
      if (!buf.length) return;
      const q = buf.join('\n');
      buf = [];
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=auto|pt-BR';
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('mymemory ' + r.status);
      const j = await r.json();
      const tr = j && j.responseData && j.responseData.translatedText;
      if (!tr || /MYMEMORY WARNING/i.test(tr)) throw new Error('quota');
      out.push(tr);
    };
    for (const line of lines) {
      if (buf.length && (buf.join('\n') + '\n' + line).length > 420) await flush();
      buf.push(line);
    }
    await flush();
    return out.join('\n');
  }
  async function translateText(text) {
    const chunks = chunkText(text, 2400);
    const parts = [];
    for (const c of chunks) {
      let tr = '';
      try { tr = await googleTranslate(c); } catch (e) { tr = ''; }
      if (!tr) { try { tr = await clients5Translate(c); } catch (e) {} }
      if (!tr) { try { tr = await myMemoryTranslate(c); } catch (e) {} }
      if (!tr) throw new Error('translation unavailable');
      parts.push(tr);
    }
    return parts.join('\n');
  }

  let translateError = false;
  let progress = 0;
  let total = 0;

  async function translateAll() {
    if (!data || !data.lyrics || !track || translating) return;
    if (translation && translation.length) { render(); return; }
    const key = 'lyr:pt:v4:' + track.id;
    const cached = cacheGet(key);
    if (cached && Array.isArray(cached.blocks) && cached.blocks.length) {
      translation = cached.blocks; translateError = false; render(); return;
    }

    translating = true;
    translateError = false;
    progress = 0;
    total = 0;
    render(false);

    const blocks = splitBlocks(data.lyrics);
    const fullText = blocks.join('\n\n');
    const chunks = chunkText(fullText, 2400);
    total = chunks.length;

    try {
      const parts = [];
      for (const c of chunks) {
        parts.push(await translateText(c));
        progress++;
        render(false);
      }
      let aligned = parts.join('\n\n')
        .replace(/\r/g, '')
        .split(/\n\s*\n+/)
        .map((b) => b.trim())
        .filter(Boolean);

      // Se o tradutor juntou ou separou estrofes, alinha bloco a bloco.
      if (aligned.length !== blocks.length) {
        aligned = [];
        for (const b of blocks) {
          let tr = '';
          try { tr = await translateText(b); } catch (e) { tr = ''; }
          aligned.push(tr);
          translation = aligned.slice();
          render(false);
        }
      }

      translation = aligned;
      const ok = aligned.filter((x) => x && x.trim()).length;
      if (ok) {
        translateError = false;
        cacheSet(key, { at: Date.now(), blocks: aligned });
      } else {
        translateError = true;
        deps.toast('A tradução não respondeu agora. A letra original continua disponível.');
      }
    } catch (e) {
      translateError = true;
      deps.toast('Não foi possível traduzir agora. Tente de novo em instantes.');
    } finally {
      translating = false;
      render(false);
    }
  }

  function updateBtn() {
    const btn = $('#lyricsTranslate');
    if (!btn) return;
    if (!data || !data.lyrics) { btn.style.display = 'none'; return; }
    btn.style.display = 'inline-flex';
    btn.textContent = translating ? 'Traduzindo…' : (showTranslated ? 'Ver original' : 'Traduzir (IA)');
    btn.classList.toggle('active', showTranslated);
    btn.disabled = translating;
  }
  function header() {
    if (!track) return '';
    const extra = data && data.matched && data.matched.toLowerCase().indexOf(String(track.artist).toLowerCase()) < 0
      ? `<div class="cfg-sub" style="margin-top:2px">Encontrado: ${esc(data.matched)}</div>` : '';
    return `<div class="lyrics-song">${esc(track.title)}</div><div class="lyrics-artist">${esc(track.artist)}</div>${extra}`;
  }
  function render(resetScroll = true) {
    const body = $('#lyricsBody');
    if (!body || !track) return;
    if (!data || !data.lyrics) { renderEmpty(); return; }
    const blocks = splitBlocks(data.lyrics);
    const badge = showTranslated ? '<div class="lyrics-ai-badge">✨ Tradução por IA</div>' : '';
    let status = '';
    if (showTranslated && translating) {
      const prog = total > 1 ? ` ${Math.min(progress + 1, total)}/${total}` : '';
      status = `<div class="search-status"><span class="spinner"></span> Traduzindo com IA${prog}…</div>`;
    }
    const content = blocks.map((b, i) => {
      let tr = '';
      if (showTranslated) {
        if (translation && translation[i] && translation[i].trim()) {
          tr = `<div class="lyr-trans">${esc(translation[i])}</div>`;
        } else if (translating) {
          tr = '<div class="lyr-trans lyr-pending"><span class="spinner"></span></div>';
        }
      }
      return `<p class="lyr-block">${esc(b)}</p>${tr}`;
    }).join('');
    const error = showTranslated && translateError && !translating
      ? `<div class="lyrics-tr-error"><span>Não foi possível traduzir tudo agora.</span><button type="button" id="lyricsRetryTr">Tentar de novo</button></div>`
      : '';
    body.innerHTML = header() + badge + status + content + error +
      '<div class="lyrics-source">Letra: LRCLIB · Tradução: Google IA</div>';
    updateBtn();
    const retry = $('#lyricsRetryTr');
    if (retry) retry.addEventListener('click', () => {
      try { localStorage.removeItem('lyr:pt:v4:' + track.id); } catch (e) {}
      translation = null; translateError = false; translateAll();
    });
    if (resetScroll) body.scrollTop = 0;
  }
  function renderLoading() {
    const body = $('#lyricsBody');
    if (body) body.innerHTML = header() + '<div class="search-status"><span class="spinner"></span> Buscando letra…</div>';
    const btn = $('#lyricsTranslate');
    if (btn) { btn.style.display = 'none'; btn.disabled = true; }
  }
  function renderEmpty(failed) {
    const body = $('#lyricsBody');
    if (!body || !track) return;
    const instrumental = !!(data && data.instrumental);
    const msg = instrumental
      ? 'Esta faixa é instrumental — não há letra para traduzir.'
      : failed
        ? 'Não foi possível consultar a base de letras agora. Verifique sua conexão e tente de novo.'
        : 'O catálogo do Audius é formado por música independente, então algumas faixas não têm letra disponível.';
    body.innerHTML = header() +
      `<div class="lyrics-empty"><div class="app-logo">🎤</div><b>${instrumental ? 'Faixa instrumental' : 'Letra não encontrada'}</b><br>${esc(msg)}</div>` +
      `<div style="text-align:center"><button class="btn ghost" id="lyricsRetry" type="button">Tentar de novo</button></div>`;
    const btn = $('#lyricsTranslate');
    if (btn) { btn.style.display = 'none'; btn.disabled = false; }
    const retry = $('#lyricsRetry');
    if (retry) retry.addEventListener('click', () => {
      try { localStorage.removeItem('lyr:v3:' + track.id); } catch (e) {}
      open(track);
    });
  }

  function open(t) {
    if (!t) return;
    track = t;
    data = null;
    translation = null;
    translating = false;
    translateError = false;
    progress = 0;
    total = 0;
    showTranslated = !!deps.getTranslate();
    const sheet = $('#lyricsSheet');
    if (sheet) sheet.style.display = 'flex';
    renderLoading();
    const token = ++reqId;
    load(t).then((res) => {
      if (token !== reqId || !track || track.id !== t.id) return;
      data = res;
      if (!data.lyrics) { renderEmpty(false); return; }
      render();
      if (showTranslated) translateAll();
    }).catch(() => {
      if (token !== reqId) return;
      data = { lyrics: '', instrumental: false };
      renderEmpty(true);
    });
  }
  function close() {
    const sheet = $('#lyricsSheet');
    if (sheet) sheet.style.display = 'none';
    track = null;
    data = null;
    translation = null;
    translating = false;
    reqId++;
    try { deps.onClose(); } catch (e) {}
  }
  function toggle(t) {
    const sheet = $('#lyricsSheet');
    if (sheet && sheet.style.display !== 'none') { close(); return; }
    open(t);
  }
  function setAuto(val) {
    if (!val) {
      if (showTranslated) { showTranslated = false; render(); }
      return;
    }
    showTranslated = true;
    if (data && data.lyrics) {
      if (translation) render(); else translateAll();
    }
  }

  function init(d) {
    if (d) deps = Object.assign(deps, d);
    const closeBtn = $('#lyricsClose');
    if (closeBtn) closeBtn.addEventListener('click', close);
    const trBtn = $('#lyricsTranslate');
    if (trBtn) trBtn.addEventListener('click', () => {
      if (!data || !data.lyrics || translating) return;
      if (!showTranslated) {
        showTranslated = true;
        deps.onTranslateChange(true);
        if (translation) render(); else translateAll();
      } else {
        showTranslated = false;
        deps.onTranslateChange(false);
        render();
      }
    });
  }

  window.LyricsUI = { init, open, close, toggle, setAuto };
})();
