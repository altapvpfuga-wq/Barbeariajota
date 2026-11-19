const fs = require('fs');
let s = fs.readFileSync('publicar-release.ps1', 'utf8');
s = s.replace("  [string]$Usuario = 'Surtadoo',", "  [string]$Usuario = 'altapvpfuga-wq',");
s = s.replace("  [string]$Repositorio = 'barbearia-do-jota',", "  [string]$Repositorio = 'Barbeariajota',");
fs.writeFileSync('publicar-release.ps1', s);
console.log('done');
const m = s.match(/Surtadoo/g);
console.log('Surtadoo remaining:', m ? m.length : 0);