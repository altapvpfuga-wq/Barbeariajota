#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#  Atualizar APK da Barbearia do Jota no Termux
#  Uso: bash atualizar-apk-termux.sh [cliente|painel]
# ============================================================

APP="${1:-cliente}"

if [ "$APP" = "cliente" ]; then
  URL="https://github.com/altapvpfuga-wq/Barbeariajota/releases/download/v1.0.57/Barbearia-do-Jota-v1.0.57.apk"
  ARQUIVO="/sdcard/Download/barbearia-cliente.apk"
  NOME="Barbearia do Jota"
elif [ "$APP" = "painel" ]; then
  URL="https://github.com/altapvpfuga-wq/Barbeariajota/releases/download/v1.0.57/Painel-v1.0.57.apk"
  ARQUIVO="/sdcard/Download/barbearia-painel.apk"
  NOME="Painel Barbearia"
else
  echo "Uso: bash atualizar-apk-termux.sh [cliente|painel]"
  exit 1
fi

echo "Baixando $NOME..."
curl -L -o "$ARQUIVO" "$URL"

if [ $? -ne 0 ]; then
  echo "Erro ao baixar. Verifique a internet."
  exit 1
fi

echo "Abrindo instalador..."
am start -a android.intent.action.VIEW -d "file://$ARQUIVO" -t "application/vnd.android.package-archive" 2>/dev/null || \
termux-open "$ARQUIVO" 2>/dev/null || \
echo "Abra manualmente: $ARQUIVO"

echo "Pronto! Permita a instalacao quando o Android pedir."