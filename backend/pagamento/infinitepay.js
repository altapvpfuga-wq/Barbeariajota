// ============================================================
//  Provedor de pagamento: InfinitePay
//
//  Implementa o contrato definido em pagamento/README.md.
//  Para trocar de banco, crie outro arquivo (ex.: mercadopago.js)
//  seguindo o MESMO contrato e adicione em pagamento/index.js.
// ============================================================

const API = 'https://api.checkout.infinitepay.io';

function apiKey() { return String(process.env.INFINITYPAY_API_KEY || '').trim(); }
function handle() { return String(process.env.INFINITEPAY_HANDLE || '').trim(); }

async function chamar(metodo, rota, corpo) {
  const res = await fetch(`${API}${rota}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
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

module.exports = {
  nome: 'InfinitePay',

  estaConfigurado() {
    return !!(apiKey() && handle());
  },

  async criarCobranca({ nsu, descricao, valor, publicBaseUrl }) {
    const link = await chamar('POST', '/links', {
      handle: handle(),
      order_nsu: nsu,
      items: [{ quantity: 1, price: valor, description: String(descricao || '').slice(0, 120) }],
      ...(publicBaseUrl ? {
        redirect_url: `${publicBaseUrl}/?pago=${encodeURIComponent(nsu)}`,
        webhook_url: `${publicBaseUrl}/api/webhook/infinitypay`,
      } : {}),
    });
    const url = link.url || null;
    return { url, slug: link.invoice_slug || link.slug || extrairSlug(url) };
  },

  async foiPago(slug) {
    if (!slug) return false;
    const r = await chamar('POST', '/payment_check', { handle: handle(), slug });
    return r.success === true || Number(r.paid_amount || 0) > 0;
  },

  extrairSlugDoWebhook(body) {
    const b = body || {};
    return b.invoice_slug || b.invoiceSlug || b.slug
      || (b.data && (b.data.invoice_slug || b.data.invoiceSlug || b.data.slug));
  },

  // usados apenas no modo "link_fixo" (especifico da InfinitePay)
  linkFixo() { return String(process.env.INFINITEPAY_LINK || '').trim(); },
  slugFixo() { return String(process.env.INFINITEPAY_LINK_SLUG || '').trim(); },
};