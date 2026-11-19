const fs = require('fs');
let s = fs.readFileSync('C:/Users/Yagoa/Documents/Projeto Padrão/apk-painel/painel.js', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Remove SUPABASE_FEED_URL line
s = s.replace(/  SUPABASE_FEED_URL: 'https:\/\/snxfixolrgxizoqczmbv\.supabase\.co\/storage\/v1\/object\/public\/apk\/versao\.json',\n/, '');

// Remove releaseDoSupabasePainel function
const start = s.indexOf('// 0) Supabase: arquivo versao.json publico.');
const end = s.indexOf('// 1) Servidor (Render)');
if (start !== -1 && end !== -1) {
  s = s.substring(0, start) + s.substring(end);
}

// Update releaseMaisNovaDoPainel to not call releaseDoSupabasePainel
s = s.replace(/  const doSupabase = await releaseDoSupabasePainel\(\);\n  if \(doSupabase\) return doSupabase;\n\n/, '');

// Update comments
s = s.replace(/  \/\/ 0\) Supabase  1\) servidor  2\) GitHub  3\) link direto do app\n/, '  // 1) servidor  2) GitHub  3) link direto do app\n');

s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('C:/Users/Yagoa/Documents/Projeto Padrão/apk-painel/painel.js', s);
console.log('done');
const m = s.match(/SUPABASE_FEED_URL/g);
console.log('SUPABASE_FEED_URL remaining:', m ? m.length : 0);
const m2 = s.match(/releaseDoSupabasePainel/g);
console.log('releaseDoSupabasePainel remaining:', m2 ? m2.length : 0);