// ============================================================
//  PAINEL DO BARBEIRO — Barbearia do Jota
//
//  ESTA TELA TEM 3 COISAS, DE CIMA PARA BAIXO:
//   1. ESTOU ABERTO / ESTOU FECHADO  (entra na hora no app do cliente)
//   2. Horário de funcionamento      (abre as / fecha as)
//   3. Agendamentos que chegam sozinhos pela internet
//
//  Os agendamentos chegam DIRETO do aplicativo "Barbearia do Jota"
//  pelo canal ntfy (internet). O computador NAO precisa estar ligado.
//  Ele serve apenas como EXTRA: confirmacao automatica do Pix e backup.
//  Tudo fica SALVO neste aparelho — fechar o app nao perde nada.
// ============================================================

const CONFIG = {
  APP_VERSION: '1.0.51',

  // Repositório do GitHub onde os APK são publicados.
  GITHUB_USER: 'Surtadoo',
  GITHUB_REPO: 'barbearia-do-jota',
  ASSET_PREFIX: 'Painel',

  BARBER_NAME: 'Barbearia do Jota',

  // Servidores no PC — OPCIONAIS (so Pix automatico e backup)
  API_BASES: [
    'https://barbearia-jota-api-2026.onrender.com',
    'http://localhost:3001',
    'http://192.168.1.73:3001',
  ],

  // PIN padrão (troque também no backend/.env PIN_PAINEL)
  PIN: '1234',
};

// Canal DIRETO entre o app do cliente e este Painel (ntfy — grátis).
// TEM que ser o MESMO nome nos dois apps. Trocar aqui = trocar lá também.
CONFIG.NTFY_URL = 'https://ntfy.sh';
// canal RESERVA: se o principal ficar fora do ar ou estourar o limite
// diario de mensagens, tudo continua funcionando por aqui.
CONFIG.NTFY_URL_RESERVA = 'https://ntfy.envs.net';
CONFIG.NTFY_TOPIC = 'bjota-ag-7k2m9xI';

// Enderecos do canal (principal + reserva), sem repetir.
function canaisNtfy() {
  const lista = [CONFIG.NTFY_URL];
  if (CONFIG.NTFY_URL_RESERVA && !lista.includes(CONFIG.NTFY_URL_RESERVA)) {
    lista.push(CONFIG.NTFY_URL_RESERVA);
  }
  return lista.filter(Boolean);
}

const LS_SRV = 'painel_servidor_v1';
const LS_PIN = 'painel_pin_v1';
const LS_ADIA = 'painel_update_adiado';
const LS_VISTO = 'painel_update_visto_v1'; // popup forcado aparece SO UMA VEZ por versao
const LS_NOTIF_UPDATE = 'painel_update_notificado_v1'; // aviso na barra: 1 vez por versao
const LS_AG = 'painel_agendamentos_v1';   // agendamentos salvos no aparelho
const LS_ST = 'painel_status_v1';          // ultimo status aberto/fechado

const $ = (id) => document.getElementById(id);
const BRL = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
const minutosDe = (t) => { const s = String(t || '09:00').trim(); if (s === '00:00') return 24 * 60; const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

// ---------- chamada ao servidor do PC (opcional) ----------
let apiBaseAtual = null;

function servidores() {
  const salvo = (localStorage.getItem(LS_SRV) || '').trim().replace(/\/+$/, '');
  return salvo ? [salvo, ...CONFIG.API_BASES] : CONFIG.API_BASES;
}

async function tentarFetch(base, rota, opcoes, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${base}${rota}`, { ...(opcoes || {}), signal: ctrl.signal });
    if (!r.ok) {
      const erro = new Error(`HTTP ${r.status}`);
      erro.status = r.status;
      try { erro.dados = await r.json(); } catch { /* sem corpo */ }
      throw erro;
    }
    return await r.json();
  } finally { clearTimeout(t); }
}

async function chamarApi(rota, opcoes) {
  const lista = apiBaseAtual ? [apiBaseAtual, ...servidores()] : servidores();
  let ultimoErro = null;
  for (const base of lista) {
    try {
      const dados = await tentarFetch(base, rota, opcoes, 12000);
      apiBaseAtual = base;
      return dados;
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro || new Error('servidor nao encontrado');
}

const pinAtual = () => (localStorage.getItem(LS_PIN) || CONFIG.PIN).trim();

// ============================================================
//  1. STATUS: ABERTO OU FECHADO (o mais importante)
// ============================================================
function statusIniciado() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_ST) || 'null');
    if (s && s.modo) return s;
  } catch { /* primeiro uso */ }
  return { modo: 'auto', aberto: null, abreAs: '09:00', fechaAs: '21:00', ts: 0 };
}
let statusLoja = statusIniciado();

// esta aberto AGORA? (manual vale a palavra do barbeiro; auto vale o horario)
function calcularAbertoAgora(st) {
  if (!st) return false;
  if (st.modo === 'manual') return st.aberto === true;   // só true = aberto (null/undefined/false = fechado)
  const agora = new Date();
  if (agora.getDay() === 1) return false; // segunda fechado
  const mins = agora.getHours() * 60 + agora.getMinutes();
  return mins >= minutosDe(st.abreAs) && mins <= minutosDe(st.fechaAs);
}

// pinta a tela com o status atual
function pintarStatus() {
  const aberto = calcularAbertoAgora(statusLoja);
  const g = $('stGrande');
  if (g) {
    g.className = 'st-grande ' + (aberto ? 'ok' : 'no');
    g.textContent = aberto ? '🟢 ABERTO' : '🔴 FECHADO';
  }
  const aviso = $('stAviso');
  if (aviso) {
    let texto = '';
    if (statusLoja.modo === 'manual') {
      texto = 'Você escolheu à mão. Vale até você mudar aqui.';
    } else {
      texto = `Horário automático: ${statusLoja.abreAs || '09:00'} às ${statusLoja.fechaAs || '21:00'} (segunda fechado).`;
    }
    aviso.textContent = texto;
  }
  if ($('mAuto')) $('mAuto').classList.toggle('on', statusLoja.modo !== 'manual');
  if ($('mAberto')) $('mAberto').classList.toggle('on', statusLoja.modo === 'manual' && statusLoja.aberto === true);
  if ($('mFechado')) $('mFechado').classList.toggle('on', statusLoja.modo === 'manual' && statusLoja.aberto !== true);
  if ($('inpAbre') && statusLoja.abreAs) $('inpAbre').value = statusLoja.abreAs;
  if ($('inpFecha') && statusLoja.fechaAs) $('inpFecha').value = statusLoja.fechaAs;
  pintarNatal();
}

// marcar o status: salva aqui, avisa os clientes PELA INTERNET e
// (se estiver ligado) avisa o servidor do PC tambem
async function mandarStatus(corpo) {
  statusLoja = {
    ...statusLoja,
    modo: corpo.modo || statusLoja.modo,
    aberto: corpo.aberto === undefined ? statusLoja.aberto : !!corpo.aberto,
    abreAs: corpo.abreAs || statusLoja.abreAs || '09:00',
    fechaAs: corpo.fechaAs || statusLoja.fechaAs || '21:00',
    ts: Date.now(),
  };
  try { localStorage.setItem(LS_ST, JSON.stringify(statusLoja)); } catch { /* ignora */ }
  pintarStatus();
  publicarCanal({ t: 's', s: statusLoja });   // <- chega NO HORA no app do cliente
  ultimoStatusEnviado = Date.now();
  try {
    await chamarApi('/api/painel/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // manda o status COMPLETO para o PC nao republicar um estado antigo
      body: JSON.stringify({
        pin: pinAtual(),
        modo: statusLoja.modo,
        aberto: statusLoja.aberto,
        abreAs: statusLoja.abreAs,
        fechaAs: statusLoja.fechaAs,
        neve: !!statusLoja.neve,
        presente: !!statusLoja.presente,
        ts: statusLoja.ts,
      }),
    });
    toast('✅ Salvo! O site já atualizou.');
  } catch {
    toast('✅ Salvo! (PC desligado — mesmo assim funciona)');
  }
}

$('mAberto').onclick = () => mandarStatus({ modo: 'manual', aberto: true });
$('mFechado').onclick = () => mandarStatus({ modo: 'manual', aberto: false });
$('mAuto').onclick = () => mandarStatus({ modo: 'auto' });
$('btnSalvarHoras').onclick = () => mandarStatus({ abreAs: $('inpAbre').value, fechaAs: $('inpFecha').value });
if ($('btnMeiaNoite')) $('btnMeiaNoite').onclick = () => {
  $('inpFecha').value = '00:00';
  toast('Fechamento definido para meia-noite. Toque em 💾 Salvar.');
};

// ============================================================
//  2. AGENDAMENTOS (salvos no aparelho — nada se perde)
// ============================================================
function lerLocais() {
  try { return JSON.parse(localStorage.getItem(LS_AG) || '{}'); }
  catch { return {}; }
}
function salvarLocais(obj) {
  try { localStorage.setItem(LS_AG, JSON.stringify(obj)); } catch { /* cheio, ignora */ }
}

// registra/agrupa um agendamento que chegou
function registrar(b, { avisaNovo = true } = {}) {
  if (!b || !b.id || typeof b.id !== 'string') return 'nao';
  if (foiApagado(b.id)) return 'ignorado';   // foi excluido de proposito: nao volta
  const loc = lerLocais();
  const atual = loc[b.id];
  let novo = false;
  if (!atual) {
    novo = true;
    loc[b.id] = b;
  } else if (b.pixStatus === 'pago' && atual.pixStatus !== 'pago') {
    loc[b.id] = { ...atual, ...b, pixStatus: 'pago', status: b.status || atual.status };
  } else if (String(b.createdAt || '') >= String(atual.createdAt || '')) {
    // chegou versao mais nova (ou igual): ela ganha
    loc[b.id] = { ...atual, ...b };
  } else {
    // chegou versao MAIS ANTIGA (relógio do celular atrasado?):
    // junta, mas os dados que ja estavam (mais novos) ficam por cima
    loc[b.id] = { ...b, ...atual };
  }
  salvarLocais(loc);
  if (novo && avisaNovo) {
    vibrar();
    // NAO criamos notificacao local aqui: o servidor ja manda o push
    // "Novo agendamento!" e o Android mostra na barra. Antes apareciam duas.
    toast(`📋 Novo agendamento!\n${b.clientName || ''} — ${b.time || ''} ${b.dateLabel || ''}`);
    pintarLista();
  }
  return novo ? 'novo' : 'atualizou';
}

// tira um agendamento da lista (o cliente ve a mudança na hora pelo canal)
function removerLocal(id, { avisa = true } = {}) {
  const loc = lerLocais();
  if (!loc[id]) return false;
  delete loc[id];
  salvarLocais(loc);
  pintarLista();
  if (avisa) toast('🗑️ Agendamento excluído.');
  return true;
}

function listaAtual() {
  return Object.values(lerLocais()).sort((a, b) => {
    const da = `${a.dateKey || ''} ${a.time || ''}`;
    const db = `${b.dateKey || ''} ${b.time || ''}`;
    if (da === db) return (b.createdAt || '').localeCompare(a.createdAt || '');
    return da > db ? 1 : -1;
  });
}

// ---------- pinta a lista com grupos por dia ----------
function racharDia(b) {
  const chaveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoje = new Date();
  const amanha = new Date(); amanha.setDate(hoje.getDate() + 1);
  if (b.dateKey === chaveDia(hoje)) return 'HOJE';
  if (b.dateKey === chaveDia(amanha)) return 'AMANHÃ';
  return (b.dateLabel || b.dateKey || '').replace(/,/g, '');
}

function badgePagamento(b) {
  if (b.payMethod === 'pix') {
    if (b.pixStatus === 'pago') return ['💰 Sinal pago', 'pago'];
    return ['⏳ Sinal pendente', 'espera'];
  }
  return ['💵 Pago no local (dinheiro)', 'dinheiro'];
}

function cardAg(b) {
  const [rotulo, classe] = badgePagamento(b);
  const digits = String(b.clientPhone || '').replace(/\D/g, '');
  const wpp = digits ? `https://wa.me/55${digits.length <= 11 ? '55' + digits : digits}?text=${encodeURIComponent('Olá! Sobre seu agendamento na Barbearia do Jota.')}` : null;
  const obs = b.note ? `<small>💬 "${esc(String(b.note).slice(0, 80))}"</small>` : '';
  // para Pix pendente: botao que confere o dinheiro na conta do barbeiro
  const btnPago = (b.payMethod === 'pix' && b.pixStatus !== 'pago')
    ? `<button class="btn-pago" data-id="${esc(b.id)}">✅ Marcar sinal pago</button>` : '';
  // editar e excluir: muda na hora no app/site do cliente
  // IMPORTANTE: as classes btn-editar/btn-apagar TEM que bater com o
  // addEventListener lá embaixo — é o que faz o toque funcionar no APK.
  const mini = `<div class="mini-acoes">
      <button class="btn-mini btn-editar" data-id="${esc(b.id)}" title="Editar agendamento">✏️ Editar</button>
      <button class="btn-mini btn-apagar perigo" data-id="${esc(b.id)}" title="Excluir agendamento">🗑️ Excluir</button>
    </div>`;
  return `<div class="ag">
    <div class="ag-hora">${esc(b.time) || '--:--'}</div>
    <div class="ag-meio">
      <b>${esc(b.clientName) || '?'}</b>
      <small>✂️ ${esc(b.serviceName)}</small>
      <small>📅 ${esc(b.dateLabel) || esc(b.dateKey)}</small>
      ${obs}
      ${wpp ? `<a class="wpp-mini" href="${wpp}" target="_blank" rel="noopener">📞 Falar no WhatsApp</a>` : ''}
      ${mini}
    </div>
    <div class="ag-lado">
      <span class="badge ${classe}">${rotulo}</span>
      <span class="preco">${b.payMethod === 'pix' ? 'Sinal R$ 10,00' : (b.price ? BRL(b.price) : '')}</span>
      ${btnPago}
    </div>
  </div>`;
}

function pintarLista() {
  const box = $('listaAg');
  if (!box) return;
  const lista = listaAtual();
  const hoje = lista.filter((b) => racharDia(b) === 'HOJE');
  if ($('agContador')) {
    $('agContador').textContent = lista.length
      ? `${hoje.length} hoje · ${lista.length} no total`
      : '';
  }
  if (!lista.length) {
    box.innerHTML = '<div class="vazio">Ninguém agendou ainda.<br>Quando um cliente agendar no aplicativo, <b>aparece aqui e o celular vibra</b>.</div>';
    return;
  }
  let html = '';
  let ultimoGrupo = null;
  for (const b of lista) {
    const g = racharDia(b);
    if (g !== ultimoGrupo) {
      html += `<div class="grupo">📅 ${g}</div>`;
      ultimoGrupo = g;
    }
    html += cardAg(b);
  }
  box.innerHTML = html;
}

// ============================================================
//  CANAL DIRETO ntfy — agendamentos entram SOZINHOS aqui
// ============================================================
let sseLista = [];
let canalOk = false;
let anunciouStatus = false;
let ultimoStatusEnviado = 0;
// so publica a lista de ocupados depois de recuperar o que chegou com o app fechado
// (senao uma lista vazia/parcial poderia "liberar" horarios que ja estao reservados)
let backlogOk = false;
// e so depois de tentar juntar os agendamentos que estao no PC
let servidorTentou = false;

// publica no canal principal E no reserva. Basta um aceitar.
// Retorna true se pelo menos um recebeu (usado para nao repetir a lista a toa).
async function publicarCanal(corpo) {
  const texto = JSON.stringify(corpo);
  let algumOk = false;
  await Promise.all(canaisNtfy().map(async (base) => {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const r = await fetch(`${base}/${CONFIG.NTFY_TOPIC}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: texto,
        });
        if (r.ok) { algumOk = true; return; }
        // 429 = limite diario do servidor: nao adianta insistir agora
        if (r.status === 429) return;
      } catch { /* sem internet agora — tenta de novo uma vez */ }
      if (tentativa === 0) await new Promise((ok) => setTimeout(ok, 1200));
    }
  }));
  return algumOk;
}

// avisa os apps dos clientes QUAIS horarios ja estao reservados.
// Sai daqui SO id + dia + hora (nenhum nome ou telefone).
// IMPORTANTE: so publica quando a lista MUDA. Antes ele repetia a lista
// a cada minuto e estourava o limite diario do ntfy (250 mensagens),
// fazendo os botoes de Neve/Presente pararem de funcionar.
let ultimaOcupacaoPublicada = '';
let ocupacaoInicialOk = false;
let publicandoOcupados = false;

function assinaturaOcupados(lista) {
  return lista.map((x) => `${x.id}|${x.dateKey}|${x.time}`).sort().join(',');
}

async function publicarOcupados({ forcar = false } = {}) {
  if (publicandoOcupados) return false;
  try {
    const hoje = new Date();
    const chaveHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const lista = Object.values(lerLocais())
      .filter((b) => b && b.id && b.dateKey && b.time
        && b.dateKey >= chaveHoje
        && b.status !== 'cancelado' && b.status !== 'expirado')
      .map((b) => ({ id: b.id, dateKey: b.dateKey, time: b.time }));
    const assinatura = assinaturaOcupados(lista);
    if (!forcar && assinatura === ultimaOcupacaoPublicada) return true;
    publicandoOcupados = true;
    const ok = await publicarCanal({ t: 'o', o: lista, completo: true, ts: Date.now() });
    if (ok) ultimaOcupacaoPublicada = assinatura;
    return ok;
  } catch {
    return false;
  } finally {
    publicandoOcupados = false;
  }
}
// a lista so sai quando o Painel ja recuperou tudo (canal + PC)
async function talvezPublicarOcupados() {
  if (!backlogOk || !servidorTentou) return;
  const forcar = !ocupacaoInicialOk;   // primeira vez manda mesmo sem mudanca
  const ok = await publicarOcupados({ forcar });
  if (ok) ocupacaoInicialOk = true;
}

function ligarCanal() {
  try { sseLista.forEach((es) => es.close()); } catch { /* nada */ }
  sseLista = [];
  for (const base of canaisNtfy()) {
    try {
      const sse = new EventSource(`${base}/${CONFIG.NTFY_TOPIC}/sse`);
      sse.onopen = () => {
        canalOk = true;
        const aviso = $('stAviso');
        // ao abrir o canal, avisa os clientes "sou eu, o status atual e este"
        if (!anunciouStatus && statusLoja.ts) {
          anunciouStatus = true;
          setTimeout(() => {
            ultimoStatusEnviado = Date.now();
            publicarCanal({ t: 's', s: statusLoja });
          }, 900);
        }
        // manda a ocupacao para quem ja esta com o app aberto
        setTimeout(talvezPublicarOcupados, 1300);
        if (aviso && !aviso.textContent) pintarStatus();
      };
      sse.onerror = () => {
        // um canal pode cair sem o outro cair
        canalOk = sseLista.some((es) => es.readyState === 1);
      };
      sse.onmessage = (ev) => {
        let m = null, p = null;
        try { m = JSON.parse(ev.data); if (m.event !== 'message' || !m.message) return; } catch { return; }
        try { p = JSON.parse(m.message); } catch { return; }
        if (p.t === 'b' && p.b) registrar(p.b, { avisaNovo: true });        // agendamento novo do app do cliente
        else if (p.t === 'p' && p.b) registrar(p.b, { avisaNovo: false });  // sinal do Pix caiu
        else if (p.t === 's' && p.s && Number(p.s.ts || 0) > Number(statusLoja.ts || 0)) {
          // outro aparelho com o PAINEL mudou o status — reflete aqui também
          statusLoja = p.s;
          try { localStorage.setItem(LS_ST, JSON.stringify(statusLoja)); } catch { /* ignora */ }
          pintarStatus();
        }
      };
      sseLista.push(sse);
    } catch { /* sem internet — tenta de novo na proxima volta */ }
  }
}

// ---------- confirmar o que o Pix caiu (o barbeiro ve na conta dele) ----------
async function confirmarPixSinal(id) {
  if (!id) return;
  const b = lerLocais()[id];
  if (!b || b.pixStatus === 'pago') return;
  // marca aqui mesmo e avisa o APLICATIVO do cliente pela internet
  registrar({ id, pixStatus: 'pago', status: 'confirmado', confirmadoPor: 'barbeiro' }, { avisaNovo: false });
  pintarLista();
  publicarCanal({ t: 'p', b: { id, pixStatus: 'pago', status: 'confirmado' } });
  vibrar();
  toast('✅ Sinal marcado como pago! O cliente já é avisado.');
  // se o PC estiver ligado, guarda a confirmacao na central tambem
  try {
    await chamarApi('/api/painel/pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinAtual(), id }),
    });
  } catch { /* PC desligado — o aviso pela internet ja saiu */ }
}

// clicou em algum botao do cartao? (delegacao: funciona em toda a lista)
// acha o botao pela CLASSE ou pelo TEXTO — assim nunca mais fica "mudo"
$('listaAg').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset ? btn.dataset.id : null;
  if (!id) return;
  const ehEditar = btn.classList.contains('btn-editar')
    || (btn.classList.contains('btn-mini') && /editar/i.test(btn.textContent || ''));
  const ehApagar = btn.classList.contains('btn-apagar')
    || (btn.classList.contains('btn-mini') && /excluir/i.test(btn.textContent || ''));
  if (btn.classList.contains('btn-pago')) { e.preventDefault(); confirmarPixSinal(id); return; }
  if (ehEditar) { e.preventDefault(); abrirEditar(id); return; }
  if (ehApagar) { e.preventDefault(); pedirExcluirAgendamento(id); }
});

// ============================================================
//  EDITAR / EXCLUIR AGENDAMENTO (muda na hora no app e no site)
// ============================================================
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES_ANO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function labelDeDia(key) {
  const p = String(key || '').split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return '';
  const dt = new Date(p[0], p[1] - 1, p[2]);
  return `${DIAS_SEMANA[dt.getDay()]}, ${p[2]} de ${MESES_ANO[p[1] - 1]} de ${p[0]}`;
}

let editandoId = null;
function abrirEditar(id) {
  const b = lerLocais()[id];
  if (!b) return;
  editandoId = id;
  $('eNome').value = b.clientName || '';
  $('eFone').value = b.clientPhone || '';
  $('eServico').value = b.serviceName || '';
  $('eDia').value = b.dateKey || '';
  $('eHora').value = b.time || '';
  $('ePreco').value = b.price != null ? b.price : '';
  $('eObs').value = b.note || '';
  $('modalEditar').classList.remove('hidden');
}

$('btnFecharEditar').onclick = () => $('modalEditar').classList.add('hidden');

$('btnSalvarEditar').onclick = async () => {
  if (!editandoId) return;
  const idAlvo = editandoId;
  const dia = $('eDia').value;
  const hora = $('eHora').value;
  if (!$('eNome').value.trim()) { toast('Digite o nome do cliente.'); return; }
  if (!dia || !hora) { toast('Escolha o dia e a hora.'); return; }
  const p = dia.split('-').map(Number);
  const patch = {
    clientName: $('eNome').value.trim(),
    clientPhone: $('eFone').value.trim(),
    serviceName: $('eServico').value.trim(),
    dateKey: dia,
    dateLabel: labelDeDia(dia),
    dow: DIAS_SEMANA[new Date(p[0], p[1] - 1, p[2]).getDay()],
    time: hora,
    note: $('eObs').value.trim(),
  };
  const preco = Number($('ePreco').value);
  if (preco > 0) patch.price = preco;
  // manda o agendamento INTEIRO com as mudanças por cima (assim o merge
  // do registrar nunca descarta a edição por causa do createdAt antigo)
  registrar({ ...lerLocais()[idAlvo], ...patch }, { avisaNovo: false });
  pintarLista();
  // avisa o APP/SITE do cliente — muda na hora (vai completo, com dia/hora)
  publicarCanal({ t: 'e', b: { ...lerLocais()[idAlvo], ...patch } });
  toast('✏️ Agendamento atualizado! O cliente já vê a mudança.');
  $('modalEditar').classList.add('hidden');
  editandoId = null;
  // se o PC estiver ligado, guarda na central também
  try {
    await chamarApi('/api/painel/editar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinAtual(), id: idAlvo, ...patch }),
    });
  } catch { /* PC desligado — o aviso pela internet ja saiu */ }
};

// ---------- controle de exclusão ----------
// a confirmacao NAO usa confirm() do navegador: o Android do APK
// nao mostra essa caixinha e a exclusao seria cancelada sozinha.
let apagandoId = null;

// "lapide": id apagado nao volta por 3 dias — nem pelo PC, nem pelo
// historico do canal (que guarda 12 horas de mensagens)
const LS_APAGADOS = 'painel_apagados_v1';
function lerApagados() {
  try { return JSON.parse(localStorage.getItem(LS_APAGADOS) || '{}'); } catch { return {}; }
}
function marcarApagado(id) {
  try {
    const m = lerApagados();
    const agora = Date.now();
    for (const k of Object.keys(m)) if (agora - m[k] > 3 * 24 * 60 * 60 * 1000) delete m[k];
    m[id] = agora;
    localStorage.setItem(LS_APAGADOS, JSON.stringify(m));
  } catch { /* ignora */ }
}
function foiApagado(id) {
  const m = lerApagados();
  return !!(m[id] && Date.now() - m[id] < 3 * 24 * 60 * 60 * 1000);
}

// abre a caixinha de confirmacao do proprio app
function pedirExcluirAgendamento(id) {
  const b = lerLocais()[id];
  if (!b) { toast('Agendamento não encontrado.'); return; }
  apagandoId = id;
  $('excluirTexto').textContent =
    `Excluir o agendamento de ${b.clientName || '?'} — ${b.time || ''} ${b.dateLabel || ''}?`
    + ' Ele some do aplicativo e do site do cliente na hora.';
  $('modalExcluir').classList.remove('hidden');
}
$('btnCancelarExcluir').onclick = () => { apagandoId = null; $('modalExcluir').classList.add('hidden'); };
$('btnConfirmarExcluir').onclick = async () => {
  const id = apagandoId;
  apagandoId = null;
  $('modalExcluir').classList.add('hidden');
  if (id) await excluirAgendamento(id);
};

async function excluirAgendamento(id) {
  const b = lerLocais()[id];
  if (!b) { toast('Agendamento não encontrado.'); return; }
  marcarApagado(id);      // nao deixa voltar de jeito nenhum
  removerLocal(id, { avisa: false });
  // avisa o APP/SITE do cliente — some na hora
  publicarCanal({ t: 'd', b: { id } });
  vibrar();
  toast('🗑️ Agendamento excluído. O cliente já foi avisado.');
  try {
    await chamarApi('/api/painel/remover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinAtual(), id }),
    });
  } catch { /* PC desligado — o aviso pela internet ja saiu */ }
}

function vibrar() {
  try { navigator.vibrate && navigator.vibrate([300, 120, 300]); } catch { /* fora */ }
}

// ============================================================
//  SERVIDOR DO PC (EXTRA): pega o estado central do Pix pago
// ============================================================
async function atualizarPainel() {
  try {
    const d = await chamarApi('/api/painel?pin=' + encodeURIComponent(pinAtual()));
    // os agendamentos centrais entram (sem vibrar; o vibrar e so para NOVOS do canal)
    for (const b of (d.agendamentos || [])) registrar(b, { avisaNovo: false });
  } catch {
    // sem PC: sem problema, o canal da internet cobre a lista
  } finally {
    // ja tentou o PC: agora pode publicar a lista completa (com o que veio do canal)
    servidorTentou = true;
    talvezPublicarOcupados();
  }
  pintarLista();
}

// ============================================================
//  AJUSTES (PIN + servidor do PC opcional)
// ============================================================
$('btnCfg').onclick = () => {
  $('painelVersao').textContent = CONFIG.APP_VERSION;
  $('inpServidorPainel').value = (localStorage.getItem(LS_SRV) || '').trim();
  $('inpPin').value = pinAtual();
  $('cfgAviso').textContent = '—';
  $('modalCfg').classList.remove('hidden');
};
$('btnFecharCfg').onclick = () => $('modalCfg').classList.add('hidden');
$('btnSalvarCfg').onclick = async () => {
  const srv = $('inpServidorPainel').value.trim().replace(/\/+$/, '');
  const pin = $('inpPin').value.trim() || CONFIG.PIN;
  localStorage.setItem(LS_SRV, srv);
  localStorage.setItem(LS_PIN, pin);
  apiBaseAtual = null;
  $('cfgAviso').textContent = 'Testando...';
  try {
    const r = await chamarApi('/api/painel?pin=' + encodeURIComponent(pin));
    $('cfgAviso').textContent = '✅ Servidor do PC conectado (opcional, só para o Pix).';
    for (const b of (r.agendamentos || [])) registrar(b, { avisaNovo: false });
    toast('✅ Salvo!');
    setTimeout(() => $('modalCfg').classList.add('hidden'), 900);
  } catch (e) {
    $('cfgAviso').textContent = '⚠️ (Tudo bem—os agendamentos chegam pela internet mesmo assim.) ' + (e.status === 401 ? 'PIN errado.' : 'PC não responde.');
  }
};

// ============================================================
//  TOAST
// ============================================================
let timerToast = null;
function toast(msg) {
  let t = $('toastPainel');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toastPainel';
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--gold);color:#111;font-weight:800;padding:12px 18px;border-radius:12px;z-index:99;box-shadow:0 6px 24px rgba(0,0,0,.45);max-width:90vw;text-align:center;white-space:pre-line';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

// correcao de texto com < > "
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ============================================================
//  ATUALIZACAO DO APLICATIVO (baixa o APK "Painel-vX.X.X.apk")
// ============================================================
function versaoParaNumero(v) {
  return String(v || '0').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
}
function versaoEhMaior(nova, atual) {
  const a = versaoParaNumero(nova);
  const b = versaoParaNumero(atual);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}
// Busca as releases e devolve a mais nova que TEM o APK do Painel.
// Antes eu olhava so a release "latest": quando ela tinha apenas o APK do
// app do cliente, o botao abria a pagina do GitHub e o barbeiro baixava o
// aplicativo errado. Agora release sem "Painel-vX.X.X.apk" e ignorada.
async function releasesDoPainel() {
  const resp = await fetch(
    `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/releases?per_page=20`,
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!resp.ok) throw new Error(`GitHub ${resp.status}`);
  const lista = await resp.json();
  if (!Array.isArray(lista)) throw new Error('resposta estranha do GitHub');
  const re = new RegExp('^' + CONFIG.ASSET_PREFIX + '.*\\.apk$', 'i');
  return lista
    .filter((r) => r && r.tag_name && !r.draft && !r.prerelease)
    .map((r) => ({ rel: r, asset: (r.assets || []).find((a) => re.test(a.name)) }))
    .filter((x) => x.asset);
}
// Devolve a release mais nova que tem o APK do Painel.
// 1) tenta a API do GitHub (diz exatamente quais APKs existem);
// 2) se a API bloquear (limite por IP), usa o feed .atom, que nao tem limite.
async function releaseMaisNovaDoPainel() {
  try {
    const lista = await releasesDoPainel();
    if (lista.length) return lista[0];
  } catch (e) {
    console.warn('[painel-update] api falhou, tentando o feed:', e.message);
  }
  const resp = await fetch(
    `https://github.com/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/releases.atom`,
    { headers: { Accept: 'application/atom+xml' } }
  );
  if (!resp.ok) throw new Error(`GitHub ${resp.status}`);
  const xml = await resp.text();
  const m = xml.match(/<entry>[\s\S]*?<link[^>]*href="[^"]*\/releases\/tag\/([^"]+)"/i);
  if (!m) return null;
  const tag = m[1];
  const versao = tag.replace(/^v/i, '');
  const nome = `${CONFIG.ASSET_PREFIX}-v${versao}.apk`;
  return {
    rel: { tag_name: tag, body: '' },
    asset: {
      name: nome,
      browser_download_url: `https://github.com/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/releases/download/${tag}/${nome}`,
    },
  };
}
async function checarAtualizacao({ silencioso = true } = {}) {
  try {
    const achado = await releaseMaisNovaDoPainel();
    if (!achado) {
      if (!silencioso) $('updStatus').textContent = 'Ainda não há APK do Painel publicado.';
      return null;
    }
    const { rel, asset } = achado;
    const nova = String(rel.tag_name).replace(/^v/i, '');
    const notas = String(rel.body || '');
    // forcar aparece mesmo com versao igual (rollback), MAS SO UMA VEZ por versao
    const forcar = /\[FORCAR\]|\[FORCE\]/i.test(notas);
    if (forcar) {
      if (localStorage.getItem(LS_VISTO) === nova) return null;
    } else if (!versaoEhMaior(nova, CONFIG.APP_VERSION)) return null;
    const adiado = Number(localStorage.getItem(LS_ADIA) || 0);
    if (!forcar && silencioso && adiado > Date.now() - 5 * 60 * 1000) return null;
    mostrarAtualizacao(nova, notas, asset, forcar);
    // avisa tambem na barra do Android (uma vez por versao, e so na checagem automatica)
    if (silencioso) avisarAtualizacao(nova);
    return nova;
  } catch (e) {
    console.warn('[painel-update] ', e.message);
    if (!silencioso) $('updStatus').textContent = 'Não consegui checar: ' + e.message;
    return null;
  }
}
// Aviso de nova versao do Painel NAO cria notificacao local: o servidor
// manda o push "Atualizacao disponivel!" e o Android mostra na barra.
// (antes apareciam duas notificacoes iguais)
function avisarAtualizacao(versao) {
  try {
    if (!versao) return;
    localStorage.setItem(LS_NOTIF_UPDATE, String(versao));
  } catch { /* ignora */ }
}
function mostrarAtualizacao(versao, notasBrutas, asset, forcar) {
  // tira a tag [FORCAR] do texto que aparece para voce
  const notas = String(notasBrutas || '').replace(/\[FORCAR\]|\[FORCE\]/gi, '').trim();
  $('updVersao').textContent = forcar ? `⚠️ Atualização importante: ${versao}` : `Nova versão: ${versao}`;
  $('updAtual').textContent = `Você está na versão ${CONFIG.APP_VERSION}`;
  $('updNotas').innerHTML = notas ? notas.replace(/</g, '&lt;').replace(/\n/g, '<br>') : 'Correções e melhorias nesta versão.';
  const url = asset ? asset.browser_download_url
    : `https://github.com/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/releases/download/v${versao}/${CONFIG.ASSET_PREFIX}-v${versao}.apk`;
  $('btnAtualizar').textContent = '⬇️ Atualizar agora';
  $('btnAtualizar').disabled = false;
  $('btnAtualizar').onclick = () => {
    localStorage.setItem(LS_VISTO, versao);
    baixarEInstalar(url);
  };
  $('btnDepois').textContent = forcar ? 'Fechar' : 'Depois';
  $('btnDepois').onclick = () => {
    if (forcar) {
      // fechou = ja viu nessa versao (nao volta mais nesta)
      localStorage.setItem(LS_VISTO, versao);
      $('modalUpdate').classList.add('hidden');
      return;
    }
    localStorage.setItem(LS_ADIA, String(Date.now()));
    $('modalUpdate').classList.add('hidden');
  };
  $('modalUpdate').classList.remove('hidden');
}
function baixarEInstalar(url) {
  if (!url) return;
  localStorage.removeItem(LS_ADIA);
  const nativo = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ApkUpdate;
  const dentroDoApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!nativo) {
    if (dentroDoApp) {
      // NUNCA abre navegador de dentro do aplicativo
      $('updNotas').textContent = 'O instalador interno nao carregou neste aparelho. Instale o APK mais novo uma vez (nao abre o Chrome).';
      $('btnAtualizar').disabled = false;
      $('btnAtualizar').textContent = '🔁 Tentar de novo';
      $('btnAtualizar').onclick = () => baixarEInstalar(url);
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  $('updNotas').textContent = 'Baixando a atualização dentro do app...';
  $('btnAtualizar').disabled = true;
  $('btnAtualizar').textContent = '⏳ Baixando...';
  nativo.instalar({ url })
    .then((r) => {
      if (r && r.precisaPermissao) {
        $('updNotas').textContent = 'Permita "Instalar apps desconhecidos" na tela que abriu e toque em ⬇️ Atualizar agora de novo.';
        $('btnAtualizar').disabled = false;
        $('btnAtualizar').textContent = '⬇️ Atualizar agora';
        return;
      }
      // o download continua no próprio aplicativo; quando terminar, o
      // Android abre sozinho a tela de instalação (sem Chrome)
      $('updNotas').textContent = 'Baixando a atualização dentro do app...';
    })
    .catch((e) => {
      $('btnAtualizar').disabled = false;
      $('btnAtualizar').textContent = '⬇️ Atualizar agora';
      $('btnAtualizar').onclick = () => baixarEInstalar(url);
      $('updNotas').textContent = 'Não consegui baixar: ' + (e && e.message ? e.message : 'erro') + '. Tente de novo com a internet ligada.';
    });
}

// eventos do download nativo: progresso, fim, erro e permissão
(function ligarEventosDoApkUpdate() {
  const nativo = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ApkUpdate;
  if (!nativo || !nativo.addListener) return;
  const nota = () => $('updNotas');
  const botao = () => $('btnAtualizar');
  nativo.addListener('progresso', (d) => {
    if (nota() && d && d.pct != null) {
      nota().textContent = `Baixando a atualização dentro do app... ${d.pct}%`;
    }
  });
  nativo.addListener('concluido', () => {
    if (nota()) nota().textContent = 'Download concluído. Abrindo a instalação do Android...';
  });
  nativo.addListener('erro', (d) => {
    if (nota()) nota().textContent = 'Não consegui baixar: ' + ((d && d.mensagem) || 'erro')
      + '. Toque em Atualizar agora para tentar de novo.';
    if (botao()) { botao().disabled = false; botao().textContent = '⬇️ Atualizar agora'; }
  });
  nativo.addListener('permissao', () => {
    if (nota()) nota().textContent = 'Permita "Instalar apps desconhecidos" para o aplicativo e toque em Atualizar agora de novo.';
    if (botao()) { botao().disabled = false; botao().textContent = '⬇️ Atualizar agora'; }
  });
})();
$('btnVerificarUpdate').onclick = async () => {
  $('updStatus').textContent = 'Procurando...';
  $('modalCfg').classList.add('hidden');
  const achou = await checarAtualizacao({ silencioso: false });
  if (!achou && document.getElementById('modalUpdate').classList.contains('hidden')) {
    $('updStatus').textContent = `Você está na versão mais recente (${CONFIG.APP_VERSION}).`;
    $('modalCfg').classList.remove('hidden');
  }
};

// ============================================================
//  RECUPERA O QUE PERDEU: o ntfy guarda 12 horas de mensagens.
//  Se o Painel estava fechado quando o cliente agendou, pega aqui.
// ============================================================
async function pegarAtrasados() {
  let txt = '';
  let algumOk = false;
  for (const base of canaisNtfy()) {
    try {
      const resp = await fetch(`${base}/${CONFIG.NTFY_TOPIC}/json?poll=1&since=12h`);
      if (resp.ok) { txt += await resp.text() + '\n'; algumOk = true; }
    } catch { /* esse canal falhou; tenta o outro */ }
  }
  try {
    if (!algumOk) return;
    for (const linha of String(txt || '').split('\n')) {
      let o = null, p = null;
      try { o = JSON.parse(linha); } catch { continue; }
      if (!o || o.event !== 'message' || !o.message) continue;
      try { p = JSON.parse(o.message); } catch { continue; }
      if (p.t === 'b' && p.b) {
        // so vibra/notifica se o agendamento for recente (menos de 10 min)
        const fresco = Date.now() - (Date.parse(p.b.createdAt) || 0) < 10 * 60 * 1000;
        registrar(p.b, { avisaNovo: fresco });
      } else if (p.t === 'p' && p.b) registrar(p.b, { avisaNovo: false });
      else if (p.t === 'e' && p.b && p.b.id) registrar(p.b, { avisaNovo: false });
      else if (p.t === 'd' && p.b && p.b.id) { removerLocal(p.b.id, { avisa: false }); marcarApagado(p.b.id); }
      else if (p.t === 's' && p.s && Number(p.s.ts || 0) > Number(statusLoja.ts || 0)) {
        statusLoja = p.s;
        try { localStorage.setItem(LS_ST, JSON.stringify(statusLoja)); } catch { /* ignora */ }
        pintarStatus();
      }
    }
    // terminou de recuperar: agora sim a lista de ocupados esta completa
    backlogOk = true;
    await talvezPublicarOcupados();
  } catch { /* sem internet — tenta de novo no proximo ciclo */ }
}

// ============================================================
//  NATAL: neve e presente no app do cliente (voce liga aqui)
// ============================================================
function pintarNatal() {
  const tn = $('tNeve'), tp = $('tPresente');
  if (tn) { tn.textContent = statusLoja.neve ? '🔆 Ligado' : '⚫ Desligado'; tn.classList.toggle('on', !!statusLoja.neve); }
  if (tp) { tp.textContent = statusLoja.presente ? '🔆 Ligado' : '⚫ Desligado'; tp.classList.toggle('on', !!statusLoja.presente); }
}

async function ligarNatal(campo, valor) {
  statusLoja = { ...statusLoja, [campo]: valor, ts: Date.now() };
  try { localStorage.setItem(LS_ST, JSON.stringify(statusLoja)); } catch { /* ignora */ }
  pintarNatal();
  // o app do cliente liga/desliga NA HORA pela internet
  publicarCanal({ t: 's', s: statusLoja });
  ultimoStatusEnviado = Date.now();
  try {
    await chamarApi('/api/painel/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: pinAtual(),
        modo: statusLoja.modo,
        aberto: statusLoja.aberto,
        abreAs: statusLoja.abreAs,
        fechaAs: statusLoja.fechaAs,
        [campo]: valor,
        ts: statusLoja.ts,
      }),
    });
  } catch { /* PC desligado — o aviso pela internet ja saiu */ }
}
if ($('tNeve')) $('tNeve').onclick = () => ligarNatal('neve', !statusLoja.neve);
if ($('tPresente')) $('tPresente').onclick = () => ligarNatal('presente', !statusLoja.presente);

// ============================================================
//  INICIO
// ============================================================
// ===== NOTIFICACOES PUSH (FCM) =====
const LS_PUSH_TOKEN = 'barbearia_painel_push_token_v1';
const LS_APARELHO = 'barbearia_painel_aparelho_id_v1';

// identifica ESTE aparelho: se o token do FCM trocar, o servidor substitui o
// antigo em vez de guardar os dois (evita a mesma notificacao chegar 2 vezes)
function idDoAparelho() {
  try {
    let id = localStorage.getItem(LS_APARELHO);
    if (!id) {
      id = 'pd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(LS_APARELHO, id);
    }
    return id;
  } catch { return ''; }
}

// manda o token para o servidor testando todos os enderecos (nuvem, local...)
async function enviarTokenPushPainel(valor) {
  if (!valor) return false;
  const corpo = JSON.stringify({
    token: valor,
    app: 'painel',
    version: CONFIG.APP_VERSION,
    aparelho: idDoAparelho(),
  });
  const lista = apiBaseAtual ? [apiBaseAtual, ...servidores()] : servidores();
  for (const base of lista) {
    try {
      const r = await fetch(base + '/api/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corpo,
      });
      if (r.ok) {
        apiBaseAtual = base;
        localStorage.setItem(LS_PUSH_TOKEN, valor);
        console.log('[push] token do painel registrado no servidor:', base);
        return true;
      }
    } catch (e) { /* tenta o proximo endereco */ }
  }
  console.warn('[push] nao consegui mandar o token do painel agora');
  return false;
}

async function registrarPushPainel() {
  try {
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.PushNotifications) return;
    const PushNotifications = window.Capacitor.Plugins.PushNotifications;

    // canal de alta prioridade (Android 8+)
    try {
      await PushNotifications.createChannel({
        id: 'barbearia_atualizacoes',
        name: 'Avisos do painel',
        description: 'Novos agendamentos e atualizações',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#d4af37',
      });
    } catch (e) { /* Android antigo nao tem canal */ }

    // ouvintes ANTES do register()
    PushNotifications.addListener('registration', async (token) => {
      if (!token || !token.value) return;
      localStorage.setItem(LS_PUSH_TOKEN, token.value);
      const ok = await enviarTokenPushPainel(token.value);
      if (!ok) setTimeout(() => enviarTokenPushPainel(token.value), 15000);
    });
    PushNotifications.addListener('registrationError', (erro) => {
      console.warn('[push] erro no registro:', JSON.stringify(erro || {}));
    });
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      toast(notification.title || 'Nova notificacao');
    });
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const dados = (notification.notification && notification.notification.data) || {};
      if (dados.tipo !== 'atualizacao') return;
      // o push ja traz o endereco DIRETO do APK do Painel
      const nova = String(dados.versao || '').replace(/^v/i, '');
      if (dados.urlPainel && nova && versaoEhMaior(nova, CONFIG.APP_VERSION)) {
        mostrarAtualizacao(nova, '', { browser_download_url: dados.urlPainel }, false);
        return;
      }
      checarAtualizacao({ silencioso: false });
    });

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      console.warn('[push] permissao de notificacao negada pelo Android');
      return;
    }
    await PushNotifications.register();

    const salvo = localStorage.getItem(LS_PUSH_TOKEN);
    if (salvo) enviarTokenPushPainel(salvo);
  } catch (e) {
    console.warn('[push] erro ao registrar:', e.message);
  }
}

window.addEventListener('load', () => {
  window.scrollTo(0, 0);
  pintarStatus();       // status salvo aparece na hora
  pintarLista();        // agendamentos salvos aparecem na hora
  atualizarPainel();    // (extra: estado do Pix vindo do PC)
  ligarCanal();         // canal da internet: agendamentos ENTAM sozinhos
  pegarAtrasados();     // recupera o que chegou com o app fechado
  setInterval(atualizarPainel, 60000);
  setInterval(pegarAtrasados, 60000);   // de minuto em minuto cobre furos do canal
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pintarLista();
      atualizarPainel();
      // reavisa os clientes do status atual (cobre desconexoes longas),
      // mas sem repetir a cada vez que abre o app (economiza o limite do ntfy)
      if (statusLoja.ts && Date.now() - ultimoStatusEnviado > 2 * 60 * 1000) {
        ultimoStatusEnviado = Date.now();
        publicarCanal({ t: 's', s: statusLoja });
      }
      talvezPublicarOcupados();
    }
  });
  document.title = 'Painel — ' + CONFIG.BARBER_NAME;
  // procura versao nova so dentro do APK
  const ehApk = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (ehApk) {
    setTimeout(() => checarAtualizacao({ silencioso: true }), 1000);
    setInterval(() => checarAtualizacao({ silencioso: true }), 2 * 60 * 1000);
    // registra push notifications para receber notificacoes com o app fechado
    setTimeout(() => registrarPushPainel(), 2000);
  }
});
