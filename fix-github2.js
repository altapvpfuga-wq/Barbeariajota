const fs = require('fs');
let s = fs.readFileSync('site-barbearia/app.js', 'utf8');

// Remove SUPABASE_FEED_URL line
s = s.replace(/  SUPABASE_FEED_URL: 'https:\/\/snxfixolrgxizoqczmbv\.supabase\.co\/storage\/v1\/object\/public\/apk\/versao\.json',\n/, '');

// Remove releaseDoSupabase function
const start = s.indexOf('// 0) Supabase: arquivo versao.json publico');
const end = s.indexOf('// 1) Servidor (Render)');
if (start !== -1 && end !== -1) {
  s = s.substring(0, start) + s.substring(end);
}

// Update buscarUltimaVersao to not call releaseDoSupabase
s = s.replace(/  \/\/ 0\) Supabase \(sempre atualizado, funciona mesmo com GitHub\/Render fora do ar\)\n  const doSupabase = await releaseDoSupabase\(\);\n  if \(doSupabase\) return doSupabase;\n\n/, '');

fs.writeFileSync('site-barbearia/app.js', s);
console.log('done');
const m = s.match(/SUPABASE_FEED_URL/g);
console.log('SUPABASE_FEED_URL remaining:', m ? m.length : 0);
const m2 = s.match(/releaseDoSupabase/g);
console.log('releaseDoSupabase remaining:', m2 ? m2.length : 0);