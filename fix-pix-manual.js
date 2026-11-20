const fs = require('fs');
let s = fs.readFileSync('site-barbearia/app.js', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Find mostrarPixManual function and hide the result box
const old = `  const res = $('pixResultado');
  res.classList.remove('hidden');
  res.classList.add('pagavel');
  $('btnWppFinal').classList.add('hidden');
  $('pixResultadoTexto').textContent =
    'Pague o sinal de ' + BRL(CONFIG.SIGNAL_VALUE) + ' e toque em "Já paguei o Pix" para avisar a barbearia.';`;

const newCode = `  const res = $('pixResultado');
  res.classList.add('hidden');
  $('btnWppFinal').classList.add('hidden');`;

if (s.includes(old)) {
  s = s.replace(old, newCode);
  console.log('replaced');
} else {
  console.log('NOT FOUND');
}

s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('site-barbearia/app.js', s);
console.log('done');