const fs = require('fs');
let s = fs.readFileSync('site-barbearia/app.js', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Add toast in the "no release" case
s = s.replace(
  "    if (!rel || !rel.tag_name) {\n      if (!silencioso) mostrarAvisoUpdate(mensagemSemConexao());\n      return null;\n    }",
  "    if (!rel || !rel.tag_name) {\n      if (!silencioso) { toast('Buscando... não encontrei atualização.'); mostrarAvisoUpdate(mensagemSemConexao()); }\n      return null;\n    }"
);

// Add toast when no update (same version)
s = s.replace(
  "    } else if (!versaoEhMaior(nova, CONFIG.APP_VERSION)) return null;",
  "    } else if (!versaoEhMaior(nova, CONFIG.APP_VERSION)) { if (!silencioso) toast('Você já está na versão mais recente (' + CONFIG.APP_VERSION + ').'); return null; }"
);

// Add toast when update found
s = s.replace(
  "    const asset = (rel.assets || []).find((a) => /\\.apk$/i.test(a.name || '')) || (rel.assets || [])[0];\n    if (!asset) return null;\n    mostrarAtualizacao(nova, rel, asset, forcar);",
  "    const asset = (rel.assets || []).find((a) => /\\.apk$/i.test(a.name || '')) || (rel.assets || [])[0];\n    if (!asset) return null;\n    if (!silencioso) toast('Atualização ' + nova + ' encontrada!');\n    mostrarAtualizacao(nova, rel, asset, forcar);"
);

// Add toast in catch
s = s.replace(
  "    if (!silencioso) mostrarAvisoUpdate(mensagemSemConexao(e));",
  "    if (!silencioso) { toast('Erro ao checar: ' + (e && e.message ? e.message : 'sem internet')); mostrarAvisoUpdate(mensagemSemConexao(e)); }"
);

s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('site-barbearia/app.js', s);
console.log('done');