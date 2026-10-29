# Pagamentos — como trocar de banco

O pagamento (sinal de R$ 10 via Pix) usa um **provedor pluggable**.
Hoje o padrão é a InfinitePay. Para trocar para Mercado Pago, Stripe,
PagSeguro etc., basta criar um arquivo novo e mudar uma variável.

## Contrato (o que todo provedor precisa ter)

Crie `backend/pagamento/<nome>.js` exportando um objeto com:

```js
module.exports = {
  nome: 'NomeDoBanco',                       // string
  estaConfigurado() { return true/false; },    // tem credenciais?
  async criarCobranca({ nsu, descricao, valor, publicBaseUrl }) {
    // valor esta em CENTAVOS (ex.: 1000 = R$ 10,00)
    // devolve { url, slug }  (url = link que o cliente abre para pagar)
    return { url: 'https://...', slug: 'abc123' };
  },
  async foiPago(slug) {
    // devolve true se essa cobranca ja foi paga
    return true/false;
  },
  extrairSlugDoWebhook(body) {
    // tira o "slug" do corpo do webhook do banco
    // devolve null/undefined se nao conseguir
    return body && body.slug;
  },
  // opcionais (so InfinitePay usa hoje):
  linkFixo() { return ''; },
  slugFixo() { return ''; },
};
```

## Como adicionar um novo banco

1. Crie `backend/pagamento/mercadopago.js` seguindo o contrato acima.
2. Abra `backend/pagamento/index.js` e adicione:
   ```js
   const provedores = {
     infinitepay: require('./infinitepay'),
     mercadopago: require('./mercadopago'),
   };
   ```
3. No `.env` (ou variáveis do Render) coloque:
   ```
   PAGAMENTO_PROVIDER=mercadopago
   ```
4. Adicione as credenciais do novo banco no `.env` (veja abaixo).
5. Reinicie o servidor. Pronto.

## Variáveis de ambiente necessárias

### Comuns (qualquer provedor)
- `MODO_PAGAMENTO` = `link_unico` (recomendado) ou `link_fixo`
- `SIGNAL_VALUE` = valor do sinal em reais (ex.: `10`)
- `PUBLIC_BASE_URL` = URL pública do backend (para webhook/redirect)
- `PIN_PAINEL` = PIN do painel

### InfinitePay (padrão)
- `INFINITYPAY_API_KEY` = chave da API (Bearer)
- `INFINITEPAY_HANDLE` = handle da loja (ex.: `yago-assumpcao-y9d`)
- `INFINITEPAY_LINK` = link fixo (só no modo link_fixo)
- `INFINITEPAY_LINK_SLUG` = slug do link fixo

### Para um novo banco
Adicione as variáveis que o SEU provedor precisar (ex.: `MERCADOPAGO_ACCESS_TOKEN`,
`MERCADOPAGO_WEBHOOK_SECRET`) e leia-as dentro do arquivo `pagamento/<nome>.js`.

## O que a pessoa que for configurar precisa ter em mãos

1. Conta no banco/provedor escolhido, com a API habilitada.
2. A **chave de API** (token/secret) do provedor.
3. O **handle/identificador da loja** (se o provedor usar).
4. Uma **URL pública** para o backend (Render já dá uma: https://...onrender.com)
   — necessária para o webhook confirmar o pagamento automaticamente.
5. Cadastrar o webhook no painel do provedor apontando para:
   `https://<seu-backend>/api/webhook/<nome-do-provedor>`
   (hoje: `/api/webhook/infinitypay`)
6. Reiniciar o servidor após mudar as variáveis.

## Observação

O modo `link_fixo` (um link só para todos) é específico da InfinitePay.
Outros provedores normalmente usam sempre `link_unico` (uma cobrança por
agendamento), que é o modo recomendado.
" path">
C:\Users\Yagoa\Documents\Projeto Padrão\site+apk+github\backend\pagamento\README.md