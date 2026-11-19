const fs = require('fs');
let s = fs.readFileSync('site-barbearia/app.js', 'utf8');
// Handle CRLF
s = s.replace(/\r\n/g, '\n');
s = s.replace(/  SUPABASE_FEED_URL: 'https:\/\/snxfixolrgxizoqczmbv\.supabase\.co\/storage\/v1\/object\/public\/apk\/versao\.json',\n/, '');
s = s.replace(/  \/\/ 0\) Supabase \(sempre atualizado, funciona mesmo com GitHub\/Render fora do ar\)\n  const doSupabase = await releaseDoSupabase\(\);\n  if \(doSupabase\) return doSupabase;\n\n/, '');
s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('site-barbearia/app.js', s);
console.log('done');
const s2 = fs.readFileSync('site-barbearia/app.js', 'utf8');
const m = s2.match(/SUPABASE_FEED_URL/g);
console.log('SUPABASE_FEED_URL remaining:', m ? m.length : 0);
const m2 = s2.match(/releaseDoSupabase/g);
console.log('releaseDoSupabase remaining:', m2 ? m2.length : 0);