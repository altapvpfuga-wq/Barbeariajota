const fs = require('fs');
let s = fs.readFileSync('site-barbearia/app.js', 'utf8');
s = s.replace(/\r\n/g, '\n');

const startMarker = "        if (atual) {\n          if (status === 'confirmado' && atual.pixStatus !== 'pago') {";
const endMarker = "        return;\n      }\n      if (dados.tipo !== 'atualizacao') return;";

const startIdx = s.indexOf(startMarker);
const endIdx = s.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found. startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const newBlock = `        const nome = (atual && atual.clientName ? atual.clientName : (dados.nome || '')).split(' ')[0] || 'Você';
        if (atual) {
          if (status === 'confirmado' && atual.pixStatus !== 'pago') {
            updateBooking(id, { pixStatus: 'pago', status: 'confirmado' });
            if (pixBooking && pixBooking.id === id) {
              pixBooking.pixStatus = 'pago';
              pixBooking.status = 'confirmado';
              pararTimerResetPix();
              renderPixArea();
            }
            checkPixOnLoad();
          } else if (status === 'recusado' && atual.pixStatus !== 'recusado') {
            updateBooking(id, { pixStatus: 'recusado', status: 'cancelado' });
            if (pixBooking && pixBooking.id === id) {
              pixBooking = null;
              pararTimerResetPix();
              limparEstadoPagamento();
            }
          }
        }
        if (status === 'confirmado') {
          toast('✅ ' + nome + ', seu agendamento foi confirmado!');
          try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch { /* ignora */ }
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('Pagamento confirmado!', { body: nome + ', seu agendamento foi confirmado!', icon: '/icone-192.png' });
            }
          } catch (e) { /* ignora */ }
        } else if (status === 'recusado') {
          toast('❌ ' + nome + ', seu agendamento foi cancelado. Entre em contato com a barbearia.');
          try { if (navigator.vibrate) navigator.vibrate([300, 100, 300]); } catch { /* ignora */ }
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('Agendamento cancelado', { body: nome + ', seu agendamento foi cancelado. Entre em contato com a barbearia.', icon: '/icone-192.png' });
            }
          } catch (e) { /* ignora */ }
        }
        return;`;

s = s.substring(0, startIdx) + newBlock + s.substring(endIdx);

s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('site-barbearia/app.js', s);
console.log('done');