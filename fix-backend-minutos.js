const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');
s = s.replace(/\r\n/g, '\n');
const old = `const minutosDe = (t) => {
  const [h, m] = String(t || '09:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};`;
const newFn = `const minutosDe = (t) => {
  const s = String(t || '').trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  if (s === '00:00') return 24 * 60;
  const [h, m] = s.split(':').map(Number);
  if (isNaN(h)) return null;
  return (h || 0) * 60 + (m || 0);
};`;
if (s.includes(old)) {
  s = s.replace(old, newFn);
  console.log('fixed');
} else {
  console.log('NOT FOUND');
}
// also update calcularAberto to handle null
const oldCalc = `  const mins = now.getHours() * 60 + now.getMinutes();
  const abre = minutosDe(st.abreAs);
  const fecha = minutosDe(st.fechaAs);
  if (abre === null || fecha === null) return false;
  return mins >= abre && mins <= fecha;`;
const newCalc = `  const mins = now.getHours() * 60 + now.getMinutes();
  const abre = minutosDe(st.abreAs);
  const fecha = minutosDe(st.fechaAs);
  if (abre === null || fecha === null) return false;
  return mins >= abre && mins <= fecha;`;
if (s.includes(oldCalc)) {
  console.log('calc already fixed');
}
s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/server.js', s);
console.log('done');