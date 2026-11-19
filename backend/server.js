// ============================================================
// Backend da Barbearia do Jota
//
// O QUE ELE FAZ (duas opcoes, voce escolhe no .env):
//
//   MODO = "link_unico"  (recomendado, funciona com varios clientes ao mesmo tempo)
//     Cria uma cobranca nova da InfinitePay para CADA agendamento.
//     O cliente paga naquele link e o servidor so confere SE AQUELA cobranca caiu.
//
//   MODO = "link_fixo"   (o seu link de sempre, um so para todos)
//     Nao cria cobranca. Todo mundo paga no mesmo link.
//     O servidor guarda como o link estava quando o agendamento comecou
//     e so confirma se o pagamento caiu DEPOIS disso.
//
//   API usada:
//     POST https://api.checkout.infinitepay.io/links          (cria cobranca)
//     POST https://api.checkout.infinitepay.io/payment_check  (confere se caiu)
//
// Roda com:  npm install  &&  npm start
// ============================================================

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// firebase-admin v14 usa a API modular: app.messaging() deixou de existir.
// Sem isso, TODO envio de push falhava com "firebaseApp.messaging is not a function".
let getMessaging = null;
try { ({ getMessaging } = require('firebase-admin/messaging')); } catch { /* versao antiga */ }

// le o .env de onde este arquivo esta, nao de onde o comando foi digitado
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Arquivos de atualizacao: ficam no proprio servidor (nao dependem do GitHub).
const VERSAO_FILE = path.join(__dirname, 'versao.json');
const APK_DIR = path.join(__dirname, 'apk');
const BASE_PUBLICO = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL
  || 'https://barbearia-jota-api-2026.onrender.com').replace(/\/+$/, '');

// ---------- Firebase Admin (push notifications) ----------
// Dois projetos Firebase: um para o cliente, outro para o painel
let firebaseClienteOk = false;
let firebasePainelOk = false;
let firebaseClienteApp = null;
let firebasePainelApp = null;
let messagingCliente = null;
let messagingPainel = null;
const projetosFirebase = { cliente: null, painel: null };

// le as credenciais de: variavel de ambiente (JSON), pasta do backend ou /etc/secrets
function lerServiceAccount(arquivo, variavelEnv) {
  const bruto = String(process.env[variavelEnv] || '').trim();
  if (bruto) {
    try { return JSON.parse(bruto); }
    catch (e) { console.warn(`[firebase] ${variavelEnv} invalido:`, e.message); }
  }
  const caminhos = [path.join(__dirname, arquivo), path.join('/etc/secrets', arquivo)];
  for (const caminho of caminhos) {
    try { return require(caminho); } catch { /* tenta o proximo */ }
  }
  return null;
}

function iniciarFirebase(arquivo, variavelEnv, nome) {
  const conta = lerServiceAccount(arquivo, variavelEnv);
  if (!conta) {
    console.warn(`[firebase] ${nome} sem credenciais (${arquivo})`);
    return null;
  }
  projetosFirebase[nome] = conta.project_id || null;
  try {
    const appFirebase = admin.initializeApp({ credential: admin.cert(conta) }, nome);
    console.log(`[firebase] ${nome} inicializado com sucesso`);
    return appFirebase;
  } catch (e) {
    console.warn(`[firebase] ${nome} nao inicializado:`, e.message);
    return null;
  }
}

firebaseClienteApp = iniciarFirebase('firebase-service-account.json', 'FIREBASE_SERVICE_ACCOUNT', 'cliente');
firebasePainelApp = iniciarFirebase('firebase-service-account-painel.json', 'FIREBASE_SERVICE_ACCOUNT_PAINEL', 'painel');
firebaseClienteOk = !!firebaseClienteApp;
firebasePainelOk = !!firebasePainelApp;

// cria o "messaging" do jeito certo em cada versao do firebase-admin
function criarMessaging(appFirebase) {
  if (!appFirebase) return null;
  try {
    if (getMessaging) return getMessaging(appFirebase);
    return appFirebase.messaging();
  } catch (e) {
    console.warn('[firebase] messaging indisponivel:', e.message);
    return null;
  }
}
messagingCliente = criarMessaging(firebaseClienteApp);
messagingPainel = criarMessaging(firebasePainelApp);

const firebaseOk = !!messagingCliente || !!messagingPainel;

// ---------- configuracoes (todas no .env) ----------
const MODO = (process.env.MODO_PAGAMENTO || 'link_unico').trim();   // link_unico | link_fixo
const API_KEY = (process.env.INFINITYPAY_API_KEY || '').trim();
const HANDLE = (process.env.INFINITEPAY_HANDLE || '').trim();
const LINK_FIXO = (process.env.INFINITEPAY_LINK || '').trim();
const SLUG_FIXO = (process.env.INFINITEPAY_LINK_SLUG || '').trim();
const SIGNAL_VALUE = Number(process.env.SIGNAL_VALUE || 10);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').trim();
const API = 'https://api.checkout.infinitepay.io';
const DB_FILE = path.join(__dirname, 'pagamentos.json');

// ============================================================
//  PAINEL DO BARBEIRO
//  - guarda TODOS os agendamentos que o site mandar (painel.json)
//  - manda o aberto/fechado e os horarios que o barbeiro escolher
//  - o Painel (APK do barbeiro) ler com um PIN para nao expor os
//    clientes para qualquer um.
const PIN_PAINEL = String(process.env.PIN_PAINEL || '1234').trim(); // <- troque pelo .env ou aqui
const PAINEL_FILE = path.join(__dirname, 'painel.json');
const NTFY_URL = String(process.env.NTFY_URL || 'https://ntfy.sh').trim();
const NTFY_TOPIC = String(process.env.NTFY_TOPIC || 'bjota-ag-7k2m9xI').trim();

// avisa o Painel pelo canal da internet (funciona mesmo se o servidor
// esta longe do celular do barbeiro)
function publicarCanal(corpo) {
  try {
    fetch(`${NTFY_URL}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(corpo),
    }).catch(() => {});
  } catch { /* ignora */ }
}
// ============================================================

const STATUS_PADRAO = { modo: 'auto', aberto: null, abreAs: '09:00', fechaAs: '21:00', atualizadoEm: null };
function loadPainel() {
  try {
    if (!fs.existsSync(PAINEL_FILE)) return { status: { ...STATUS_PADRAO }, agendamentos: {} };
    const d = JSON.parse(fs.readFileSync(PAINEL_FILE, 'utf8'));
    if (!d || typeof d !== 'object') throw new Error('arquivo ruim');
    if (!d.agendamentos || typeof d.agendamentos !== 'object') d.agendamentos = {};
    d.status = { ...STATUS_PADRAO, ...(d.status || {}) };
    return d;
  } catch {
    return { status: { ...STATUS_PADRAO }, agendamentos: {} };
  }
}
function savePainel(d) {
  try { fs.writeFileSync(PAINEL_FILE, JSON.stringify(d, null, 2)); }
  catch (e) { console.error('[painel] nao consegui salvar:', e.message); }
}
// diz se esta aberto agora, pelo statusdo painel
function calcularAberto(st) {
  if (!st) return false;
  if (st.modo === 'manual') return st.aberto === true; // so true = aberto (null/undefined/false = fechado)
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= minutosDe(st.abreAs) && mins <= minutosDe(st.fechaAs);
}
const minutosDe = (t) => {
  const [h, m] = String(t || '09:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const pinOk = (req) => {
  const q = (req.query && req.query.pin) != null ? req.query.pin : ((req.body || {}).pin);
  return String(q || '') === PIN_PAINEL;
};

app.use(cors());
app.use(express.json({ limit: '200kb' }));

// ---------- armazenamento simples em arquivo ----------
function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { pagamentos: {} };
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return db && db.pagamentos ? db : { pagamentos: {} };
  } catch { return { pagamentos: {} }; }
}
function saveDB(db) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
  catch (e) { console.error('[db] nao consegui salvar:', e.message); }
}
const getPagamento = (id) => loadDB().pagamentos[id] || null;
function setPagamento(id, patch) {
  const db = loadDB();
  const atual = db.pagamentos[id] || { bookingId: id };
  db.pagamentos[id] = { ...atual, ...patch, atualizadoEm: new Date().toISOString() };
  saveDB(db);
  return db.pagamentos[id];
}
const centavos = (v) => Math.round(Number(v || 0) * 100);

// ---------- InfinitePay ----------
async function chamar(metodo, rota, corpo) {
  const res = await fetch(`${API}${rota}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  const texto = await res.text();
  let dados = {};
  try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { raw: texto }; }
  if (!res.ok) throw new Error(`InfinitePay ${res.status}: ${dados.message || texto.slice(0, 160)}`);
  return dados;
}

// o link vem como https://checkout.infinitepay.io/<handle>?lenc=<SLUG>.v1.<checksum>
const extrairSlug = (url) => (url && url.split('lenc=')[1] ? url.split('lenc=')[1].split('.v1')[0] : null);

async function linkJaFoiPago(slug) {
  if (!slug) return false;
  const r = await chamar('POST', '/payment_check', { handle: HANDLE, slug });
  return r.success === true || Number(r.paid_amount || 0) > 0;
}

async function criarCobranca({ nsu, descricao }) {
  const link = await chamar('POST', '/links', {
    handle: HANDLE,
    order_nsu: nsu,
    items: [{ quantity: 1, price: centavos(SIGNAL_VALUE), description: descricao.slice(0, 120) }],
    ...(PUBLIC_BASE_URL ? {
      redirect_url: `${PUBLIC_BASE_URL}/?pago=${encodeURIComponent(nsu)}`,
      webhook_url: `${PUBLIC_BASE_URL}/api/webhook/infinitypay`,
    } : {}),
  });
  const url = link.url || null;
  return { url, slug: link.invoice_slug || link.slug || extrairSlug(url) };
}

// ============================================================
// ROTAS
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    modo: MODO,
    infinitepay: API_KEY && HANDLE ? 'configurado' : 'sem credenciais',
    handle: HANDLE || null,
    sinal: SIGNAL_VALUE,
    linkFixo: MODO === 'link_fixo' ? LINK_FIXO : null,
    aguardando: Object.values(loadDB().pagamentos).filter((p) => !p.pago).length,
    push: {
      firebase: firebaseOk,
      cliente: firebaseClienteOk,
      painel: firebasePainelOk,
      projetos: projetosFirebase,
      tokens: loadPushTokens().length,
      aparelhos: loadPushTokens().map((t) => ({
        app: t.app,
        versao: t.version,
        token: mascararToken(t.token),
        topicoOk: t.topicoOk,
        topicoErro: t.topicoErro,
        atualizadoEm: t.atualizadoEm,
      })),
      ultimo: ultimoPush,
      checagem: ultimaChecagem,
    },
  });
});

app.get('/api/link', (req, res) => {
  res.json({
    modo: MODO,
    link: MODO === 'link_fixo' ? LINK_FIXO : null,
    valor: centavos(SIGNAL_VALUE),
  });
});

// ============================================================
//  PAINEL: status publico (site usa para abrir/fechar e horarios)
// ============================================================
app.get('/api/status', (req, res) => {
  const st = loadPainel().status;
  const now = new Date();
  res.json({
    modo: st.modo,
    aberto: calcularAberto(st),
    abreAs: st.abreAs,
    fechaAs: st.fechaAs,
    neve: !!st.neve,
    presente: !!st.presente,
    ts: Number(st.ts) || Date.parse(st.atualizadoEm) || 0,
    weekday: now.getDay(),
    atualizadoEm: st.atualizadoEm,
  });
});

// Ocupacao publica: SO o dia e a hora (nunca nome/telefone).
// O app do cliente usa isso para marcar os horarios ja reservados.
app.get('/api/ocupados', (req, res) => {
  const p = loadPainel();
  const now = new Date();
  const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const ocupados = Object.values(p.agendamentos || {})
    .filter((b) => b && b.id && b.dateKey && b.time
      && b.dateKey >= hoje
      && b.status !== 'cancelado' && b.status !== 'expirado')
    .map((b) => ({ id: b.id, dateKey: b.dateKey, time: b.time }));
  res.json({ ocupados });
});

// Painel (APK do barbeiro, com PIN): tudo — status + agendamentos
app.get('/api/painel', (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const p = loadPainel();
  const agendamentos = Object.values(p.agendamentos).sort((a, b) => {
    const da = `${a.dateKey || ''} ${a.time || ''}`;
    const db = `${b.dateKey || ''} ${b.time || ''}`;
    if (da === db) return (b.createdAt || '').localeCompare(a.createdAt || '');
    return da > db ? 1 : -1;
  });
  res.json({ status: p.status, aberto: calcularAberto(p.status), agendamentos });
});

// Painel: o barbeiro confirmou ou recusou o Pix na mao (visto na conta dele)
app.post('/api/painel/pago', (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const { id, recusado } = req.body || {};
  if (!id) return res.status(400).json({ error: 'falta o id' });
  const p = loadPainel();
  if (!p.agendamentos[id]) return res.status(404).json({ error: 'agendamento nao existe' });
  const ag = p.agendamentos[id];
  const clientName = ag.clientName || '';
  const pushToken = ag.pushToken || '';
  const aparelhoId = ag.aparelhoId || '';

  if (recusado) {
    if (ag.pixStatus !== 'recusado') {
      p.agendamentos[id].pixStatus = 'recusado';
      p.agendamentos[id].status = 'cancelado';
      p.agendamentos[id].confirmadoPor = 'barbeiro';
      savePainel(p);
    }
    publicarCanal({ t: 'r', b: { id, pixStatus: 'recusado', status: 'cancelado', clientName } });
    console.log(`[painel] pagamento recusado: ${id} (${clientName})`);
    // envia push direcionado ao cliente (apenas para o aparelho que fez o agendamento)
    if (pushToken) {
      const nomeCliente = clientName.split(' ')[0] || clientName;
      if (recusado) {
        enviarPushParaToken('cliente', pushToken,
          'Agendamento cancelado',
          nomeCliente + ', seu agendamento foi cancelado. Entre em contato com a barbearia.',
          { tipo: 'pagamento', id: String(id), status: 'recusado' }
        ).catch((e) => console.warn('[push] falha ao avisar cliente:', e.message));
      } else {
        enviarPushParaToken('cliente', pushToken,
          'Pagamento confirmado!',
          nomeCliente + ', seu agendamento foi confirmado!',
          { tipo: 'pagamento', id: String(id), status: 'confirmado' }
        ).catch((e) => console.warn('[push] falha ao avisar cliente:', e.message));
      }
    }
  }  // se houver registro de cobranca, marca pago tambem (evita confirmacao dupla)
  if (!recusado) {
    const registro = getPagamento(id);
    if (!registro || !registro.pago) {
      setPagamento(id, { pago: true, confirmadoEm: new Date().toISOString(), confirmadoPor: 'barbeiro' });
    }
  }
  res.json({ ok: true });
});

// Painel: o barbeiro marca aberto/fechado e os horarios
app.post('/api/painel/status', (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const { modo, aberto, abreAs, fechaAs, neve, presente, ts } = req.body || {};
  const p = loadPainel();
  if (modo === 'auto' || modo === 'manual') p.status.modo = modo;
  if (modo === 'manual' && aberto != null) p.status.aberto = !!aberto;
  if (abreAs && /^\d{1,2}:\d{2}$/.test(String(abreAs))) p.status.abreAs = String(abreAs).padStart(5, '0');
  if (fechaAs && /^\d{1,2}:\d{2}$/.test(String(fechaAs))) p.status.fechaAs = String(fechaAs).padStart(5, '0');
  if (typeof neve === 'boolean') p.status.neve = neve;
  if (typeof presente === 'boolean') p.status.presente = presente;
  // guarda o horario do CELULAR do barbeiro (mesmo relogio do app do cliente),
  // para o site saber qual status e o mais novo sem depender do relogio do PC
  p.status.ts = Number(ts) || Date.now();
  p.status.atualizadoEm = new Date().toISOString();
  savePainel(p);
  // avisa TODOS os clientes pela internet: horarios e natal mudam na hora
  publicarCanal({
    t: 's',
    s: {
      modo: p.status.modo,
      aberto: p.status.modo === 'manual' ? (p.status.aberto === true) : null,
      abreAs: p.status.abreAs,
      fechaAs: p.status.fechaAs,
      neve: !!p.status.neve,
      presente: !!p.status.presente,
      ts: p.status.ts,
    },
  });
  console.log(`[painel] status: modo=${p.status.modo} aberto=${calcularAberto(p.status)} janela ${p.status.abreAs}-${p.status.fechaAs}`);
  res.json({ ok: true, status: p.status, aberto: calcularAberto(p.status) });
});

// Painel: o barbeiro EDITOU um agendamento (dia/hora/nome/etc)
app.post('/api/painel/editar', (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const { id, pin, ...campos } = req.body || {};
  if (!id) return res.status(400).json({ error: 'falta o id' });
  const p = loadPainel();
  if (!p.agendamentos[id]) return res.status(404).json({ error: 'agendamento nao existe' });
  p.agendamentos[id] = { ...p.agendamentos[id], ...campos, editadoEm: new Date().toISOString() };
  savePainel(p);
  // muda na hora no app/site do cliente
  publicarCanal({ t: 'e', b: p.agendamentos[id] });
  console.log(`[painel] agendamento editado: ${id}`);
  res.json({ ok: true });
});

// Painel: o barbeiro EXCLUIU um agendamento (some no app/site do cliente)
app.post('/api/painel/remover', (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'falta o id' });
  const p = loadPainel();
  if (p.agendamentos[id]) {
    delete p.agendamentos[id];
    savePainel(p);
  }
  const g = loadDB();
  if (g.pagamentos && g.pagamentos[id]) {
    delete g.pagamentos[id];
    saveDB(g);
  }
  publicarCanal({ t: 'd', b: { id } });
  console.log(`[painel] agendamento excluido: ${id}`);
  res.json({ ok: true });
});

// O site manda cada agendamento novo para ficar salvo no Painel
app.post('/api/agendar', (req, res) => {
  const b = req.body || {};
  if (!b.id) return res.status(400).json({ error: 'falta o id' });
  const p = loadPainel();
  const jaTinha = !!p.agendamentos[b.id];
  p.agendamentos[b.id] = {
    ...p.agendamentos[b.id], ...b,
    recebidoEm: jaTinha ? p.agendamentos[b.id].recebidoEm : new Date().toISOString(),
  };
  savePainel(p);
  console.log(`[painel] agendamento ${b.id} — ${b.clientName || '?'} · ${b.dateLabel || '?'} ${b.time || ''} (${b.payMethod || '?'})`);
  // avisa o painel no celular quando chega um agendamento novo
  if (!jaTinha) {
    const detalhe = [b.clientName, b.serviceName, b.dateLabel, b.time]
      .filter((x) => x != null && String(x).trim() !== '')
      .join(' · ');
    enviarPush(
      'Novo agendamento!',
      detalhe || 'Chegou um novo agendamento no painel.',
      { tipo: 'agendamento', id: String(b.id) },
      { alvos: { cliente: false, painel: true }, tag: 'barbearia-agendamento' }
    ).catch((e) => console.warn('[push] falha ao avisar o painel:', e.message));
  }
  res.json({ ok: true });
});

// ============================================================
// Abre a espera do pagamento de um agendamento.
//   link_unico: cria a cobranca agora
//   link_fixo :  guarda como o link esta, para comparar depois
// ============================================================
app.post('/api/aguardar', async (req, res) => {
  try {
    const { bookingId, serviceName, dateLabel, time, clientName } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'Falta o bookingId.' });
    if (!API_KEY || !HANDLE) {
      return res.status(503).json({ error: 'SEM_CREDENCIAIS', message: 'Backend sem a chave da InfinitePay.' });
    }

    // ja respondido antes? devolve o mesmo link
    const anterior = getPagamento(bookingId);
    if (anterior && anterior.pago) {
      return res.json({ modo: MODO, link: anterior.link, valor: anterior.valor, pago: true });
    }

    const descricao = `Sinal ${SIGNAL_VALUE.toFixed(2).replace('.', ',')} - ${serviceName || ''} ${dateLabel || ''} ${time || ''} - ${bookingId}`;
    const valor = centavos(SIGNAL_VALUE);

    // garante que o agendamento aparece no painel do barbeiro
    const pPainel = loadPainel();
    if (!pPainel.agendamentos[bookingId]) {
      pPainel.agendamentos[bookingId] = {
        id: bookingId, clientName: clientName || '', clientPhone: (req.body || {}).clientPhone || '',
        serviceName: serviceName || '', dateLabel: dateLabel || '', time: time || '',
        payMethod: 'pix', pixStatus: 'aguardando',
        createdAt: new Date().toISOString(), recebidoEm: new Date().toISOString(),
      };
      savePainel(pPainel);
    }

    if (MODO === 'link_fixo') {
      if (!SLUG_FIXO) return res.status(503).json({ error: 'SEM_LINK_FIXO' });
      let jaPagoAntes = false;
      try { jaPagoAntes = await linkJaFoiPago(SLUG_FIXO); }
      catch (e) { console.error('[aguardar]', e.message); }
      const r = setPagamento(bookingId, {
        modo: 'link_fixo', link: LINK_FIXO, slug: SLUG_FIXO,
        jaPagoAntes, pago: false, valor, descricao,
        cliente: clientName || '', criadoEm: new Date().toISOString(),
      });
      console.log(`[pix] aguardando ${bookingId} (link ja estava pago? ${jaPagoAntes})`);
      return res.json({ modo: 'link_fixo', link: r.link, valor });
    }

    // ---- modo link_unico: uma cobranca so para este agendamento ----
    const { url, slug } = await criarCobranca({ nsu: bookingId, descricao });
    const r = setPagamento(bookingId, {
      modo: 'link_unico', link: url, slug, jaPagoAntes: false, pago: false,
      valor, descricao, cliente: clientName || '', criadoEm: new Date().toISOString(),
    });
    console.log(`[pix] cobranca de ${bookingId} criada: ${url}`);
    return res.json({ modo: 'link_unico', link: r.link, valor });
  } catch (e) {
    console.error('[aguardar]', e.message);
    return res.status(500).json({ error: 'ERRO_INFINITEPAY', message: e.message });
  }
});

// ============================================================
// O site chama a cada 5 segundos. Responde pago:true quando caiu.
// ============================================================
app.get('/api/conferir/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const registro = getPagamento(bookingId);
    if (!registro) return res.status(404).json({ pago: false, erro: 'Agendamento nao encontrado.' });
    if (registro.pago) return res.json({ pago: true, valor: registro.valor });

    const caiu = await linkJaFoiPago(registro.slug);
    console.log(`[pix] conferindo ${bookingId} -> caiu=${caiu}`);

    if (caiu && !registro.jaPagoAntes) {
      setPagamento(bookingId, { pago: true, confirmadoEm: new Date().toISOString() });
      // marca pago no painel do barbeiro tambem (e no canal direto)
      const pPainel = loadPainel();
      if (pPainel.agendamentos[bookingId]) {
        pPainel.agendamentos[bookingId].pixStatus = 'pago';
        pPainel.agendamentos[bookingId].status = 'confirmado';
        savePainel(pPainel);
      }
      publicarCanal({ t: 'p', b: { id: bookingId, pixStatus: 'pago', status: 'confirmado' } });
      console.log(`[pix] PAGO: ${bookingId}`);
      return res.json({ pago: true, valor: registro.valor });
    }
    if (caiu && registro.jaPagoAntes) {
      return res.json({
        pago: false, ambiguo: true, valor: registro.valor,
        aviso: 'Este link ja estava pago antes do seu agendamento. Confirme com a barbearia.',
      });
    }
    return res.json({ pago: false, valor: registro.valor });
  } catch (e) {
    console.error('[conferir]', e.message);
    return res.status(500).json({ pago: false, erro: e.message });
  }
});

// a InfinitePay avisa na hora que cai (se voce configurar o webhook)
app.post('/api/webhook/infinitypay', (req, res) => {
  res.sendStatus(200);
  try {
    const b = req.body || {};
    const slug = b.invoice_slug || b.invoiceSlug || b.slug
      || (b.data && (b.data.invoice_slug || b.data.invoiceSlug || b.data.slug));
    if (!slug) return;
    const achado = Object.values(loadDB().pagamentos).find((p) => p.slug === slug);
    if (!achado) return;
    const pago = b.paid_amount != null
      ? Number(b.paid_amount) >= Number(b.amount || achado.valor)
      : true;
    setPagamento(achado.bookingId, { pago });
    console.log(`[webhook] ${achado.bookingId} pago=${pago}`);
  } catch (e) { console.error('[webhook]', e.message); }
});

// ============================================================
//  PUSH NOTIFICATIONS (FCM): recebe tokens e envia notificacoes
// ============================================================
const PUSH_TOKENS_FILE = path.join(__dirname, 'push-tokens.json');
let ultimoPush = null; // fica visivel em /api/health para conferir o envio
let ultimaChecagem = null; // ultima consulta ao GitHub (versao/erro)
function loadPushTokens() {
  try {
    if (!fs.existsSync(PUSH_TOKENS_FILE)) return [];
    const d = JSON.parse(fs.readFileSync(PUSH_TOKENS_FILE, 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}
function savePushTokens(tokens) {
  try { fs.writeFileSync(PUSH_TOKENS_FILE, JSON.stringify(tokens, null, 2)); }
  catch (e) { console.error('[push] erro ao salvar tokens:', e.message); }
}
function mascararToken(token) {
  const s = String(token || '');
  return s.length <= 12 ? s : `${s.slice(0, 6)}...${s.slice(-6)}`;
}

// topicos do FCM: a inscricao fica gravada no Google, entao o push continua
// chegando mesmo depois que o Render reinicia e apaga os arquivos do servidor.
const TOPICO_CLIENTE = 'atualizacoes-cliente';
const TOPICO_PAINEL = 'atualizacoes-painel';
const CANAL_ANDROID = 'barbearia_atualizacoes';

function messagingDoApp(nomeApp) {
  return nomeApp === 'painel' ? messagingPainel : messagingCliente;
}
function appDoNome(nomeApp) {
  return nomeApp === 'painel' ? firebasePainelApp : firebaseClienteApp;
}
function topicoDoApp(nomeApp) {
  return nomeApp === 'painel' ? TOPICO_PAINEL : TOPICO_CLIENTE;
}

// inscreve o aparelho no topico (pode chamar varias vezes, sem problema).
// tenta a API nova e, se o Google negar permissao, a API antiga (IID).
async function inscreverNoTopico(token, nomeApp) {
  const messaging = messagingDoApp(nomeApp);
  if (!messaging) return { ok: false, erro: 'sem credenciais' };
  const topico = topicoDoApp(nomeApp);
  const tentativas = [];

  try {
    const r = await messaging.subscribeToTopic([token], topico);
    const ok = !!(r && r.successCount > 0);
    const erros = (r && r.errors ? r.errors : [])
      .map((e) => (e.error && (e.error.code || e.error.message)) || 'erro')
      .filter(Boolean);
    if (ok) {
      console.log(`[push] topico ${topico} do ${nomeApp}: inscrito (api nova)`);
      return { ok: true, via: 'nova', successCount: r.successCount, failureCount: r.failureCount, erros };
    }
    tentativas.push({ via: 'nova', erros });
  } catch (e) {
    tentativas.push({ via: 'nova', erro: e.code || e.message });
  }

  try {
    const r = await messaging.subscribeToTopicLegacy([token], topico);
    const ok = !!(r && r.successCount > 0);
    const erros = (r && r.errors ? r.errors : [])
      .map((e) => (e.error && (e.error.code || e.error.message)) || 'erro')
      .filter(Boolean);
    console.log(`[push] topico ${topico} do ${nomeApp}: ${ok ? 'inscrito (api antiga)' : 'FALHOU (api antiga)'}`, erros);
    return {
      ok,
      via: 'antiga',
      successCount: r && r.successCount,
      failureCount: r && r.failureCount,
      erros,
      tentativas,
    };
  } catch (e) {
    console.warn('[push] topico falhou nas duas APIs:', e.code || '', e.message);
    return { ok: false, erro: e.code || e.message, tentativas };
  }
}

// recebe o token FCM do app
app.post('/api/push-token', async (req, res) => {
  const { token, app, version, aparelho } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });
  const nomeApp = app === 'painel' ? 'painel' : 'cliente';
  const idAparelho = aparelho ? String(aparelho).slice(0, 80) : '';
  const inscricao = await inscreverNoTopico(token, nomeApp);
  // o mesmo aparelho pode trocar de token (desinstalou, limpou dados...).
  // Guardamos so o token mais novo dele: senao a MESMA notificacao chega
  // duas vezes (uma por cada token antigo que continuou valido no Google).
  const tokens = loadPushTokens().filter((t) => {
    if (t.token === token) return false;
    if (idAparelho && t.aparelho === idAparelho && t.app === nomeApp) return false;
    return true;
  });
  tokens.push({
    token,
    app: nomeApp,
    version: version || '0',
    aparelho: idAparelho || null,
    topicoOk: !!inscricao.ok,
    topicoErro: inscricao.erro || (inscricao.erros && inscricao.erros[0]) || null,
    atualizadoEm: new Date().toISOString(),
  });
  savePushTokens(tokens);
  res.json({ ok: true, topico: topicoDoApp(nomeApp), inscrito: !!inscricao.ok });
});

// envia push para um token especifico (usado para notificacoes direcionadas)
async function enviarPushParaToken(nomeApp, token, titulo, corpo, dados) {
  const messaging = messagingDoApp(nomeApp);
  if (!messaging || !token) return false;
  try {
    const dadosTexto = {};
    for (const [chave, valor] of Object.entries(dados || {})) {
      dadosTexto[chave] = valor == null ? '' : String(valor);
    }
    await messaging.send({
      token,
      notification: { title: titulo, body: corpo },
      data: dadosTexto,
      android: { priority: 'high' },
    });
    console.log(`[push-${nomeApp}] enviado para token especifico`);
    return true;
  } catch (e) {
    console.warn(`[push-${nomeApp}] falha ao enviar para token:`, e.code || '', e.message);
    return false;
  }
}
// opcoes.alvos = { cliente: true, painel: true }
async function enviarPush(titulo, corpo, dados, opcoes) {
  if (!firebaseOk) {
    console.warn('[push] Firebase sem credenciais: nada enviado');
    return { ok: false, motivo: 'firebase' };
  }
  const alvos = { cliente: true, painel: true, ...((opcoes && opcoes.alvos) || {}) };
  // tag: notificacoes com a mesma tag se substituem na barra do Android
  // (evita aparecer duas vezes a mesma atualizacao)
  const tag = opcoes && opcoes.tag ? String(opcoes.tag) : null;
  const androidNotif = Object.assign(
    { defaultSound: true, defaultVibrateTimings: true },
    tag ? { tag } : {}
  );
  // o FCM so aceita texto nos dados
  const dadosTexto = {};
  for (const [chave, valor] of Object.entries(dados || {})) {
    dadosTexto[chave] = valor == null ? '' : String(valor);
  }

  async function enviarNoTopico(nomeApp) {
    const messaging = messagingDoApp(nomeApp);
    if (!messaging) return false;
    try {
      // sem channelId: usa o canal padrao do FCM, que sempre existe
      const id = await messaging.send({
        topic: topicoDoApp(nomeApp),
        notification: { title: titulo, body: corpo },
        data: dadosTexto,
        android: { priority: 'high', notification: androidNotif },
      });
      console.log(`[push-${nomeApp}] enviado no topico ${topicoDoApp(nomeApp)} (${id})`);
      return true;
    } catch (e) {
      console.warn(`[push-${nomeApp}] falha no topico:`, e.code || '', e.message);
      return false;
    }
  }

  async function enviarPorToken(nomeApp, lista) {
    const messaging = messagingDoApp(nomeApp);
    const detalhes = [];
    if (!messaging || lista.length === 0) return { validos: [], detalhes };
    try {
      const resp = await messaging.sendEachForMulticast({
        notification: { title: titulo, body: corpo },
        data: dadosTexto,
        tokens: lista.map((t) => t.token),
        android: { priority: 'high', notification: androidNotif },
      });
      console.log(`[push-${nomeApp}] tokens: ${resp.successCount} ok, ${resp.failureCount} falhas`);
      const validos = [];
      resp.responses.forEach((r, i) => {
        const codigo = r.error ? (r.error.code || r.error.message) : null;
        detalhes.push({ app: nomeApp, token: mascararToken(lista[i].token), ok: !!r.success, erro: codigo });
        if (r.success) validos.push(lista[i]);
        else if (r.error && r.error.code !== 'messaging/registration-token-not-registered') validos.push(lista[i]);
      });
      return { validos, detalhes };
    } catch (e) {
      console.error(`[push-${nomeApp}] erro por token:`, e.message);
      return { validos: lista, detalhes: [{ app: nomeApp, erro: e.code || e.message }] };
    }
  }

  const tokens = loadPushTokens();
  const tokensCliente = alvos.cliente ? tokens.filter((t) => t.app === 'cliente') : [];
  const tokensPainel = alvos.painel ? tokens.filter((t) => t.app === 'painel') : [];

  // 1) caminho principal: entrega DIRETO nos aparelhos que se registraram.
  //    (o envio por topico sempre "da certo" mesmo sem ninguem inscrito,
  //     entao ele nao serve de prova de entrega)
  let okCliente = false;
  let okPainel = false;
  const detalhes = [];
  const mortos = new Set();

  if (tokensCliente.length > 0) {
    const r = await enviarPorToken('cliente', tokensCliente);
    detalhes.push(...r.detalhes);
    okCliente = r.validos.length > 0;
    tokensCliente.forEach((t) => {
      if (!r.validos.includes(t)) mortos.add(t.token);
    });
  }
  if (tokensPainel.length > 0) {
    const r = await enviarPorToken('painel', tokensPainel);
    detalhes.push(...r.detalhes);
    okPainel = r.validos.length > 0;
    tokensPainel.forEach((t) => {
      if (!r.validos.includes(t)) mortos.add(t.token);
    });
  }

  // 2) sem aparelho registrado (deploy do Render apagou a lista): usa o topico
  if (alvos.cliente && !okCliente) okCliente = await enviarNoTopico('cliente');
  if (alvos.painel && !okPainel) okPainel = await enviarNoTopico('painel');

  if (mortos.size > 0) {
    const restantes = tokens.filter((t) => !mortos.has(t.token));
    if (restantes.length !== tokens.length) savePushTokens(restantes);
  }

  const resumo = {
    ok: (alvos.cliente && okCliente) || (alvos.painel && okPainel),
    cliente: !!alvos.cliente && okCliente,
    painel: !!alvos.painel && okPainel,
    tokens: tokens.length,
    direto: { cliente: tokensCliente.length, painel: tokensPainel.length },
    detalhes,
  };
  ultimoPush = { titulo, em: new Date().toISOString(), ...resumo };
  return resumo;
}

// endpoint para enviar notificacao de atualizacao manualmente
app.post('/api/push-atualizacao', async (req, res) => {
  const { pin, versao } = req.body || {};
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const v = String(versao || '').trim();
  const local = lerVersaoLocal();
  const urlCliente = local.urlCliente || `${BASE_PUBLICO}/download/cliente`;
  const urlPainel = local.urlPainel || `${BASE_PUBLICO}/download/painel`;
  const dados = {
    tipo: 'atualizacao',
    versao: v || local.cliente || '',
    urlCliente,
    urlPainel,
  };
  const rCliente = await enviarPush(
    'Atualização do app do cliente!',
    `Versão ${v || 'nova'} disponível. Toque para atualizar.`,
    dados,
    { alvos: { cliente: true, painel: false }, tag: 'barbearia-atualizacao-cliente' }
  );
  const rPainel = await enviarPush(
    'Atualização do Painel!',
    `Versão ${v || 'nova'} disponível. Toque para atualizar.`,
    dados,
    { alvos: { cliente: false, painel: true }, tag: 'barbearia-atualizacao-painel' }
  );
  res.json({ ok: rCliente.ok || rPainel.ok, cliente: rCliente, painel: rPainel });
});

// teste manual do push (app precisa ter sido aberto ao menos uma vez)
app.post('/api/push-teste', async (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const r = await enviarPush('Teste de notificação', 'Se você recebeu isso com o app fechado, está funcionando!', { tipo: 'teste' });
  res.json({ ok: r.ok, resultado: r, aviso: 'A notificação deve chegar em alguns segundos, mesmo com o app fechado.' });
});

// pergunta ao Google em quais topicos este token esta inscrito
async function topicosDoToken(nomeApp, token) {
  const appFirebase = appDoNome(nomeApp);
  if (!appFirebase) return { erro: 'sem credenciais' };
  try {
    const cred = appFirebase.options && appFirebase.options.credential;
    const { access_token } = await cred.getAccessToken();
    const r = await fetch(`https://iid.googleapis.com/iid/info/${encodeURIComponent(token)}?details=true`, {
      headers: { Authorization: `Bearer ${access_token}`, access_token_auth: 'true' },
    });
    const texto = await r.text();
    if (!r.ok) return { erro: `HTTP ${r.status}`, corpo: texto.slice(0, 300) };
    const j = JSON.parse(texto);
    return { topicos: Object.keys((j.rel && j.rel.topics) || {}) };
  } catch (e) {
    return { erro: e.message };
  }
}

// diagnostico: manda DIRETO para cada aparelho, SEM canal fixo.
// Assim, se o problema for o canal de notificacao, aqui chega.
app.post('/api/push-diag', async (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const tokens = loadPushTokens();
  const resultados = [];
  for (const t of tokens) {
    const messaging = messagingDoApp(t.app);
    const item = { app: t.app, versao: t.version, token: mascararToken(t.token) };
    item.topicos = await topicosDoToken(t.app, t.token);
    if (!messaging) {
      resultados.push({ ...item, ok: false, erro: 'sem credenciais Firebase' });
      continue;
    }
    try {
      const id = await messaging.send({
        token: t.token,
        notification: { title: 'Teste direto', body: 'Se apareceu esta, a entrega funciona.' },
        data: { tipo: 'teste' },
        android: { priority: 'high' },
      });
      resultados.push({ ...item, ok: true, id });
    } catch (e) {
      resultados.push({ ...item, ok: false, erro: e.code || e.message });
    }
  }
  res.json({
    total: tokens.length,
    projetos: projetosFirebase,
    resultados,
    dica: 'traga este JSON de volta: ele mostra o erro exato do Firebase e se o aparelho esta inscrito no topico.',
  });
});

// forca a inscricao nos topicos e manda um push SO pelo topico (diagnostico)
app.post('/api/push-topicos', async (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  const tokens = loadPushTokens();
  const inscricoes = [];
  for (const t of tokens) {
    const r = await inscreverNoTopico(t.token, t.app);
    t.topicoOk = !!r.ok;
    t.topicoErro = r.erro || (r.erros && r.erros[0]) || null;
    inscricoes.push({
      app: t.app,
      versao: t.version,
      token: mascararToken(t.token),
      ok: !!r.ok,
      sucesso: r.successCount,
      falhas: r.failureCount,
      erros: r.erros || (r.erro ? [r.erro] : []),
    });
  }
  savePushTokens(tokens);

  const envios = [];
  for (const nomeApp of ['cliente', 'painel']) {
    const messaging = messagingDoApp(nomeApp);
    if (!messaging) { envios.push({ app: nomeApp, ok: false, erro: 'sem credenciais' }); continue; }
    try {
      const id = await messaging.send({
        topic: topicoDoApp(nomeApp),
        notification: { title: 'Teste por tópico', body: 'Se isso chegou, o tópico está funcionando.' },
        data: { tipo: 'teste' },
        android: { priority: 'high' },
      });
      envios.push({ app: nomeApp, topico: topicoDoApp(nomeApp), ok: true, id });
    } catch (e) {
      envios.push({ app: nomeApp, ok: false, erro: e.code || e.message });
    }
  }

  res.json({ inscricoes, envios });
});

// teste disparado pelo proprio app (botao em Ajustes). Sem PIN e limitado,
// serve para o dono conferir a notificacao na hora.
let ultimoAutoTeste = 0;app.post('/api/push-auto-teste', async (req, res) => {
  if (Date.now() - ultimoAutoTeste < 8000) {
    return res.status(429).json({ error: 'Aguarde alguns segundos e tente de novo.' });
  }
  ultimoAutoTeste = Date.now();
  const tokens = loadPushTokens();
  if (tokens.length === 0) {
    return res.json({ ok: false, total: 0, enviados: 0, motivo: 'nenhum aparelho registrado ainda' });
  }
  const detalhes = [];
  let enviados = 0;
  for (const t of tokens) {
    const messaging = messagingDoApp(t.app);
    if (!messaging) {
      detalhes.push({ app: t.app, ok: false, erro: 'sem credenciais Firebase' });
      continue;
    }
    try {
      // sem channelId: usa o canal padrao do FCM, que sempre existe
      await messaging.send({
        token: t.token,
        notification: { title: 'Teste de notificação', body: 'Se você está vendo isso, está funcionando!' },
        data: { tipo: 'teste' },
        android: { priority: 'high' },
      });
      enviados++;
      detalhes.push({ app: t.app, ok: true });
    } catch (e) {
      detalhes.push({ app: t.app, ok: false, erro: e.code || e.message });
    }
  }
  res.json({ ok: enviados > 0, total: tokens.length, enviados, detalhes });
});

// forca uma checagem agora (para testar sem esperar os 5 minutos)
app.post('/api/push-checar', async (req, res) => {
  if (!pinOk(req)) return res.status(401).json({ error: 'PIN errado.' });
  await checarAtualizacaoGitHub();
  res.json({ ok: true, checagem: ultimaChecagem, ultimoPush });
});

// verifica GitHub a cada 5 minutos e envia push se houver nova versao
const ULTIMA_VERSAO_FILE = path.join(__dirname, 'ultima-versao-notificada.json');
let ultimaVersaoNotificada = null;
try {
  if (fs.existsSync(ULTIMA_VERSAO_FILE)) {
    ultimaVersaoNotificada = JSON.parse(fs.readFileSync(ULTIMA_VERSAO_FILE, 'utf8')).versao || null;
  }
} catch { /* ignora */ }

function versaoLimpa(tag) {
  return String(tag || '').trim().replace(/^v/i, '');
}

// O IP do Render e compartilhado: a API do GitHub pode responder 403
// (limite de consultas). O feed .atom nao tem esse limite.
async function releasePeloAtom() {
  const r = await fetch('https://github.com/altapvpfuga-wq/Barbeariajota/releases.atom', {
    headers: { 'User-Agent': 'barbearia-backend' },
  });
  if (!r.ok) throw new Error(`atom HTTP ${r.status}`);
  const xml = await r.text();
  const entrada = xml.split('<entry>')[1] || '';
  if (!entrada) throw new Error('atom vazio');
  const tag = (entrada.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const quando = (entrada.match(/<updated>([^<]*)<\/updated>/) || [])[1] || '';
  // no .atom o <title> e o NOME da release; a versao de verdade esta no link
  const link = (entrada.match(/releases\/tag\/([^"]+)"/) || [])[1] || '';
  const versao = versaoLimpa(link || (tag.match(/(\d+(?:\.\d+)*)\s*$/) || [])[1] || tag);
  if (!versao) throw new Error('atom sem tag');
  return { versao, publicadoEm: Date.parse(quando) || 0, origem: 'atom' };
}

async function obterUltimaRelease() {
  // 1) versao.json do proprio servidor: nao depende do GitHub.
  const local = lerVersaoLocal();
  if (local.cliente) {
    return { versao: local.cliente, publicadoEm: local.atualizadoEm || 0, origem: 'versao.json' };
  }
  // 2) GitHub (quando estiver liberado)
  try {
    const r = await fetch('https://api.github.com/repos/altapvpfuga-wq/Barbeariajota/releases/latest', {
      headers: { 'User-Agent': 'barbearia-backend', Accept: 'application/vnd.github+json' },
    });
    if (r.ok) {
      const rel = await r.json();
      const versao = versaoLimpa(rel.tag_name);
      if (!versao) throw new Error('release sem tag');
      return { versao, publicadoEm: Date.parse(rel.published_at || '') || 0, origem: 'api' };
    }
    const alt = await releasePeloAtom();
    return { ...alt, origem: `atom (api respondeu ${r.status})` };
  } catch (e) {
    const alt = await releasePeloAtom();
    return { ...alt, origem: `atom (api falhou: ${e.message})` };
  }
}

// ============================================================
//  Link curto para baixar o APK (facilita digitar no celular)
//  Agora o APK e servido PELO PROPRIO SERVIDOR: nao depende do GitHub.
// ============================================================
function lerVersaoLocal() {
  try {
    const d = JSON.parse(fs.readFileSync(VERSAO_FILE, 'utf8'));
    // aceita tanto { cliente: "1.0.51" } quanto { cliente: { versao, url, notas } }
    const cliObj = (typeof d.cliente === 'object' && d.cliente) ? d.cliente : null;
    const panObj = (typeof d.painel === 'object' && d.painel) ? d.painel : null;
    const cliente = cliObj ? cliObj.versao : d.cliente;
    const painel = panObj ? panObj.versao : d.painel;
    const urlCliente = cliObj ? cliObj.url : d.urlCliente;
    const urlPainel = panObj ? panObj.url : d.urlPainel;
    const notas = (cliObj && cliObj.notas) || d.notas || '';
    return {
      cliente: String(cliente || d.versao || '').replace(/^v/i, ''),
      painel: String(painel || d.versao || '').replace(/^v/i, ''),
      notas: String(notas),
      urlCliente: urlCliente || '',
      urlPainel: urlPainel || '',
      atualizadoEm: fs.statSync(VERSAO_FILE).mtimeMs || 0,
    };
  } catch {
    return { cliente: '', painel: '', notas: '', urlCliente: '', urlPainel: '', atualizadoEm: 0 };
  }
}

function arquivoApk(nomeApp) {
  return path.join(APK_DIR, nomeApp === 'painel' ? 'Painel.apk' : 'Barbearia-do-Jota.apk');
}

function baixarApk(nomeApp, res) {
  const arq = arquivoApk(nomeApp);
  if (!fs.existsSync(arq)) {
    return res.status(404).type('text').send('Esse APK ainda nao foi publicado no servidor.');
  }
  res.set('Cache-Control', 'no-store');
  res.type('application/vnd.android.package-archive');
  res.sendFile(arq);
}

// O app pergunta aqui: devolve a versao e o link direto de cada APK.
app.get('/api/atualizacao', (req, res) => {
  const v = lerVersaoLocal();
  res.set('Cache-Control', 'no-store');
  res.json({
    cliente: v.cliente
      ? { versao: v.cliente, url: v.urlCliente || `${BASE_PUBLICO}/download/cliente`, notas: v.notas }
      : null,
    painel: v.painel
      ? { versao: v.painel, url: v.urlPainel || `${BASE_PUBLICO}/download/painel`, notas: v.notas }
      : null,
  });
});

app.get('/download/cliente', (req, res) => baixarApk('cliente', res));
app.get('/download/painel', (req, res) => baixarApk('painel', res));

async function versaoParaDownload() {
  const local = lerVersaoLocal();
  if (local.cliente) return local.cliente;
  if (ultimaVersaoNotificada) return ultimaVersaoNotificada;
  try {
    const rel = await obterUltimaRelease();
    return rel.versao;
  } catch {
    return '1.0.51';
  }
}

app.get('/apk', async (req, res) => {
  const v = lerVersaoLocal();
  if (v.urlCliente) return res.redirect(302, v.urlCliente);
  if (fs.existsSync(arquivoApk('cliente'))) return res.redirect(302, '/download/cliente');
  try {
    const ver = await versaoParaDownload();
    res.redirect(302, `https://github.com/altapvpfuga-wq/Barbeariajota/releases/download/v${ver}/Barbearia-do-Jota-v${ver}.apk`);
  } catch (e) {
    res.status(500).send('nao consegui achar a versao: ' + e.message);
  }
});

app.get('/painel', async (req, res) => {
  const v = lerVersaoLocal();
  if (v.urlPainel) return res.redirect(302, v.urlPainel);
  if (fs.existsSync(arquivoApk('painel'))) return res.redirect(302, '/download/painel');
  try {
    const ver = await versaoParaDownload();
    res.redirect(302, `https://github.com/altapvpfuga-wq/Barbeariajota/releases/download/v${ver}/Painel-v${ver}.apk`);
  } catch (e) {
    res.status(500).send('nao consegui achar a versao: ' + e.message);
  }
});

app.get('/instalar', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instalar apps - Barbearia do Jota</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0d0d0d;color:#f5f5f5;
       margin:0;padding:28px 18px;text-align:center}
  h1{font-size:22px;margin:8px 0 4px}
  p{color:#bdbdbd;font-size:15px;line-height:1.5}
  a{display:block;margin:16px auto;max-width:420px;padding:18px 16px;border-radius:14px;
    text-decoration:none;font-weight:700;font-size:18px}
  .c{background:#d4af37;color:#1a1a1a}
  .p{background:#2b2b2b;color:#f5f5f5;border:1px solid #444}
  small{color:#8a8a8a}
</style></head><body>
<h1>💈 Barbearia do Jota</h1>
<p>Toque no app que voce quer instalar/atualizar.<br>
Se o Android perguntar, permita <b>instalar apps desconhecidos</b>.</p>
<a class="c" href="/apk">📱 Baixar app do CLIENTE</a>
<a class="p" href="/painel">🖥️ Baixar app do PAINEL</a>
<p><small>Depois de instalar, as proximas atualizacoes acontecem dentro do proprio app.</small></p>
</body></html>`);
});

async function checarAtualizacaoGitHub() {
  if (!firebaseOk) {
    ultimaChecagem = { em: new Date().toISOString(), erro: 'Firebase sem credenciais' };
    return;
  }
  try {
    const rel = await obterUltimaRelease();
    const versao = rel.versao;
    // Primeira checagem depois de ligar/reiniciar: o arquivo com a ultima
    // versao avisada pode ter sido apagado pelo deploy do Render.
    // Se a release saiu nos ultimos 10 minutos, ela ainda precisa ser avisada.
    const saiuAgora = rel.publicadoEm > 0 && (Date.now() - rel.publicadoEm) < 10 * 60 * 1000;
    const primeiraVez = ultimaVersaoNotificada === null;

    ultimaChecagem = {
      em: new Date().toISOString(),
      versao,
      publicadoEm: rel.publicadoEm ? new Date(rel.publicadoEm).toISOString() : null,
      origem: rel.origem,
      primeiraVez,
      enviado: false,
      motivo: null,
    };

    if (!primeiraVez && versao === ultimaVersaoNotificada) {
      ultimaChecagem.motivo = 'ja avisada';
      return;
    }

    if (primeiraVez && !saiuAgora) {
      // servidor reiniciou muito depois da release: so guarda, sem avisar
      ultimaVersaoNotificada = versao;
      try { fs.writeFileSync(ULTIMA_VERSAO_FILE, JSON.stringify({ versao })); } catch { /* ignora */ }
      ultimaChecagem.motivo = 'release antiga, sem aviso';
      return;
    }

    ultimaVersaoNotificada = versao;
    try { fs.writeFileSync(ULTIMA_VERSAO_FILE, JSON.stringify({ versao })); } catch { /* ignora */ }
    // envia push notification para todos os apps inscritos.
    // Vai junto o endereco DIRETO de cada APK, servido pelo proprio backend:
    // assim o app abre o popup de atualizacao com o link certo, mesmo se o
    // GitHub estiver bloqueado.
    const dados = {
      tipo: 'atualizacao',
      versao,
      urlCliente: `${BASE_PUBLICO}/download/cliente`,
      urlPainel: `${BASE_PUBLICO}/download/painel`,
    };
    const pushCliente = await enviarPush(
      'Atualização do app do cliente!',
      `Versão ${versao} disponível. Toque para atualizar.`,
      dados,
      { alvos: { cliente: true, painel: false }, tag: 'barbearia-atualizacao-cliente' }
    );
    const pushPainel = await enviarPush(
      'Atualização do Painel!',
      `Versão ${versao} disponível. Toque para atualizar.`,
      dados,
      { alvos: { cliente: false, painel: true }, tag: 'barbearia-atualizacao-painel' }
    );
    const resultadoPush = {
      ok: pushCliente.ok || pushPainel.ok,
      cliente: pushCliente.cliente,
      painel: pushPainel.painel,
      tokens: pushCliente.tokens,
      direto: { cliente: pushCliente.direto.cliente, painel: pushPainel.direto.painel },
      detalhes: [...(pushCliente.detalhes || []), ...(pushPainel.detalhes || [])],
    };
    ultimaChecagem.enviado = !!resultadoPush.ok;
    ultimaChecagem.push = resultadoPush;
    console.log(`[push] notificacao de atualizacao v${versao} enviada`, resultadoPush);
  } catch (e) {
    ultimaChecagem = { em: new Date().toISOString(), erro: e.message };
    console.warn('[push] erro ao checar GitHub:', e.message);
  }
}
// checa a cada 5 minutos
setInterval(checarAtualizacaoGitHub, 5 * 60 * 1000);
setTimeout(checarAtualizacaoGitHub, 10000);

app.listen(PORT, () => {
  console.log(`\n  Barbearia do Jota - servidor na porta ${PORT}`);
  console.log(`  Modo: ${MODO}`);
  console.log(`  InfinitePay: ${API_KEY && HANDLE ? `OK (${HANDLE})` : 'SEM CREDENCIAIS'}`);
  if (MODO === 'link_fixo') console.log(`  Link fixo: ${LINK_FIXO}`);
  console.log(`  Sinal: R$ ${SIGNAL_VALUE.toFixed(2)}`);
  console.log(`  Push (FCM): ${firebaseOk ? 'OK' : 'SEM CREDENCIAIS'}  |  tokens salvos: ${loadPushTokens().length}`);
  console.log('');
});
