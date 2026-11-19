const fs = require('fs');
let s = fs.readFileSync('site-barbearia/app.js', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Remove "Horario selecionado" toasts
s = s.replace("      toast(`Horário ${el.dataset.t} selecionado.`);\n", '');

// Remove "Canal conectado" toast
s = s.replace("      es.onopen = () => { toast('Canal conectado ✅'); };\n", "      es.onopen = () => { /* canal conectado */ };\n");

s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('site-barbearia/app.js', s);
console.log('done');

// verify
const s2 = fs.readFileSync('site-barbearia/app.js', 'utf8');
const toasts = (s2.match(/toast\(`Horário/g) || []).length;
const canal = (s2.match(/toast\('Canal conectado/g) || []).length;
console.log('Horario toasts remaining:', toasts);
console.log('Canal conectado toasts remaining:', canal);