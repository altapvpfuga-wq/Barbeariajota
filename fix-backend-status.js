const fs = require('fs');
let s = fs.readFileSync('backend/server.js', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Fix minutosDe in backend
const oldMinutos = "function minutosDe(t) { const s = String(t || '09:00').trim(); if (s === '00:00') return 24 * 60; const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); }";
const newMinutos = "function minutosDe(t) { const s = String(t || '').trim(); if (!s || s === 'null' || s === 'undefined') return null; if (s === '00:00') return 24 * 60; const [h, m] = s.split(':').map(Number); if (isNaN(h)) return null; return (h || 0) * 60 + (m || 0); }";
if (s.includes(oldMinutos)) {
  s = s.replace(oldMinutos, newMinutos);
  console.log('backend minutosDe fixed');
} else {
  console.log('backend minutosDe NOT FOUND');
}

// Fix calcularAberto in backend
const oldCalc = "  const mins = now.getHours() * 60 + now.getMinutes();\n  return mins >= minutosDe(st.abreAs) && mins <= minutosDe(st.fechaAs);";
const newCalc = "  const mins = now.getHours() * 60 + now.getMinutes();\n  const abre = minutosDe(st.abreAs);\n  const fecha = minutosDe(st.fechaAs);\n  if (abre === null || fecha === null) return false;\n  return mins >= abre && mins <= fecha;";
if (s.includes(oldCalc)) {
  s = s.replace(oldCalc, newCalc);
  console.log('backend calcularAberto fixed');
} else {
  console.log('backend calcularAberto NOT FOUND');
}

s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/server.js', s);
console.log('done');