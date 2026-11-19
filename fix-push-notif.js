const fs = require('fs');
let s = fs.readFileSync('site-barbearia/app.js', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Fix the push notification handler to show toast even when atual is null
const old = `        if (atual) {
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
          const nome = (atual.clientName || '').split(' ')[0] || 'Você';
          if (status === 'confirmado') {
            toast('✅ ' + nome + ', seu agendamento foi confirmado!');
          } else if (status === 'recusado') {
            toast('❌ ' + nome + ', seu agendamento foi cancelado. Entre em contato com a barbearia.');
          }
        }
        return;`;

const newCode = `        const nome = (atual && atual.clientName ? atual.clientName : (dados.nome || '')).split(' ')[0] || 'Você';
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

if (s.includes(old)) {
  s = s.replace(old, newCode);
  console.log('replaced');
} else {
  console.log('NOT FOUND');
}

s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('site-barbearia/app.js', s);
console.log('done');