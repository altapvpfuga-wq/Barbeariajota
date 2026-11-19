const fs = require('fs');
let s = fs.readFileSync('site-barbearia/app.js', 'utf8');

// Remove SUPABASE_FEED_URL line (line 20)
s = s.replace(/  SUPABASE_FEED_URL: 'https:\/\/snxfixolrgxizoqczmbv\.supabase\.co\/storage\/v1\/object\/public\/apk\/versao\.json',\n/, '');

// Remove the releaseDoSupabase call block in buscarUltimaVersao
s = s.replace(/  \/\/ 0\) Supabase \(sempre atualizado, funciona mesmo com GitHub\/Render fora do ar\)\n  const doSupabase = await releaseDoSupabase\(\);\n  if \(doSupabase\) return doSupabase;\n\n/, '');

// Update comments
s = s.replace(/  \/\/ Ao publicar uma versao nova, atualize o versao\.json no Supabase \(basta\n  \/\/ sobrescrever o arquivo apk\/versao\.json\) e\/ou o APP_VERSION aqui\.\n/, '  // Ao publicar uma versao nova no GitHub Releases, o app detecta automaticamente.\n');

fs.writeFileSync('site-barbearia/app.js', s);
console.log('done');
const m = s.match(/SUPABASE_FEED_URL/g);
console.log('SUPABASE_FEED_URL remaining:', m ? m.length : 0);
const m2 = s.match(/releaseDoSupabase/g);
console.log('releaseDoSupabase remaining:', m2 ? m2.length : 0);