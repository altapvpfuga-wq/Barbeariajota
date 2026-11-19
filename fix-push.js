const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Find the section to replace
const startMarker = "    // envia push direcionado ao cliente\n    if (pushToken) {";
const endMarker = "    }\n  }\n  // se houver registro de cobranca";

const startIdx = s.indexOf(startMarker);
const endIdx = s.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found. startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const newSection = `    // envia push direcionado ao cliente (apenas para o aparelho que fez o agendamento)
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
  }`;

s = s.substring(0, startIdx) + newSection + s.substring(endIdx + "    }\n  }\n".length);

s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/server.js', s);
console.log('done');

// verify
const s2 = fs.readFileSync('backend/server.js', 'utf8');
console.log('enviarPushParaToken in pago:', s2.includes('enviarPushParaToken(\'cliente\', pushToken'));