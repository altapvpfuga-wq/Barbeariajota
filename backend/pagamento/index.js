// ============================================================
//  Fabrica de provedor de pagamento.
//
//  Para trocar de banco, crie um arquivo novo em pagamento/
//  (ex.: mercadopago.js) seguindo o contrato do README.md e
//  adicione-o no objeto "provedores" abaixo. Depois mude
//  PAGAMENTO_PROVIDER no .env.
// ============================================================

const provedores = {
  infinitepay: require('./infinitepay'),
  // mercadopago: require('./mercadopago'),   // exemplo
};

function ativo() {
  const nome = String(process.env.PAGAMENTO_PROVIDER || 'infinitepay').trim().toLowerCase();
  const p = provedores[nome];
  if (!p) {
    throw new Error('Provedor de pagamento desconhecido: "' + nome + '". Disponiveis: ' + Object.keys(provedores).join(', '));
  }
  return p;
}

const pagamento = ativo();
pagamento.provedoresDisponiveis = Object.keys(provedores);
module.exports = pagamento;