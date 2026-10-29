package com.barbeariadojota.app;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Baixa o APK novo DENTRO do aplicativo e abre a tela de instalacao do
 * Android, sem passar pelo Chrome/navegador.
 *
 * O arquivo fica na pasta cache do proprio app (nao precisa de permissao de
 * armazenamento) e e entregue ao instalador por FileProvider.
 */
@CapacitorPlugin(name = "ApkUpdate")
public class ApkUpdatePlugin extends Plugin {

    private static final String NOME_APK = "atualizacao.apk";
    private static final String NOME_MARCA = "atualizacao.url";
    private static final long TAMANHO_MINIMO = 1024L * 1024L; // 1 MB

    @PluginMethod
    public void instalar(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("endereco do apk nao informado");
            return;
        }
        final String endereco = url.trim();

        // 1) ANTES de baixar: o Android precisa autorizar ESTE app a instalar
        //    APK. Se ainda nao autorizou, abre a tela de permissao e para por
        //    aqui. O usuario autoriza, volta e toca em "Atualizar agora" de
        //    novo: ai o download comeca.
        if (!podeInstalar()) {
            JSObject aviso = new JSObject();
            aviso.put("precisaPermissao", true);
            aviso.put("mensagem", "Permita 'Instalar apps desconhecidos' e toque em Atualizar de novo.");
            abrirConfiguracoesDeInstalacao();
            notificar("Permita 'Instalar apps desconhecidos' e toque em Atualizar de novo.");
            emitir("permissao", aviso);
            call.resolve(aviso);
            return;
        }

        // 2) ja baixou esse mesmo arquivo antes? entao so abre a instalacao
        if (jaBaixado(endereco)) {
            try {
                abrirInstalador(arquivoApk());
                call.resolve();
            } catch (Exception e) {
                call.reject("nao consegui abrir a instalacao: " + e.getMessage());
            }
            return;
        }

        // 3) com a permissao dada: baixa dentro do app e abre o instalador
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    File apk = baixar(endereco);
                    abrirInstalador(apk);
                } catch (Exception e) {
                    String motivo = e.getMessage() == null ? "erro no download" : e.getMessage();
                    JSObject dados = new JSObject();
                    dados.put("mensagem", motivo);
                    emitir("erro", dados);
                    notificar("Nao consegui baixar a atualizacao: " + motivo);
                }
            }
        }).start();

        call.resolve();
    }

    // o Android so deixa instalar APK se o usuario autorizou este app
    private boolean podeInstalar() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        try {
            return getContext().getPackageManager().canRequestPackageInstalls();
        } catch (Exception e) {
            return true;
        }
    }

    // Mantido para o JS antigo nao quebrar: agora abre a tela onde o Android
    // pede permissao para instalar apps.
    @PluginMethod
    public void abrirDownloads(PluginCall call) {
        abrirConfiguracoesDeInstalacao();
        call.resolve();
    }

    private File arquivoApk() {
        return new File(getContext().getCacheDir(), NOME_APK);
    }

    private File arquivoMarca() {
        return new File(getContext().getCacheDir(), NOME_MARCA);
    }

    private boolean jaBaixado(String url) {
        try {
            File apk = arquivoApk();
            File marca = arquivoMarca();
            if (!apk.exists() || apk.length() < TAMANHO_MINIMO) return false;
            if (!marca.exists()) return false;
            return url.equals(lerTexto(marca).trim());
        } catch (Exception e) {
            return false;
        }
    }

    private File baixar(String endereco) throws Exception {
        File destino = arquivoApk();
        File temporario = new File(getContext().getCacheDir(), "atualizacao.tmp");
        if (temporario.exists() && !temporario.delete()) {
            throw new Exception("nao consegui limpar o download antigo");
        }

        HttpURLConnection conexao = null;
        InputStream entrada = null;
        FileOutputStream saida = null;
        try {
            conexao = (HttpURLConnection) new URL(endereco).openConnection();
            conexao.setInstanceFollowRedirects(true);
            conexao.setConnectTimeout(20000);
            conexao.setReadTimeout(60000);
            conexao.setRequestProperty("User-Agent", "Barbearia-do-Jota-Android");
            conexao.setRequestProperty("Accept", "application/octet-stream");
            conexao.connect();

            int codigo = conexao.getResponseCode();
            if (codigo != HttpURLConnection.HTTP_OK) {
                throw new Exception("servidor respondeu " + codigo);
            }

            long total = conexao.getContentLengthLong();
            entrada = conexao.getInputStream();
            saida = new FileOutputStream(temporario);

            byte[] buffer = new byte[16 * 1024];
            long baixado = 0;
            int lidos;
            int ultimoPct = -1;
            while ((lidos = entrada.read(buffer)) != -1) {
                saida.write(buffer, 0, lidos);
                baixado += lidos;
                if (total > 0) {
                    int pct = (int) ((baixado * 100L) / total);
                    if (pct >= ultimoPct + 5) {
                        ultimoPct = pct;
                        JSObject dados = new JSObject();
                        dados.put("pct", Math.min(pct, 100));
                        emitir("progresso", dados);
                    }
                }
            }
            saida.flush();
            saida.close();
            saida = null;
            entrada.close();
            entrada = null;

            if (temporario.length() < TAMANHO_MINIMO) {
                throw new Exception("o arquivo veio incompleto");
            }
            if (destino.exists() && !destino.delete()) {
                throw new Exception("nao consegui trocar o arquivo antigo");
            }
            if (!temporario.renameTo(destino)) {
                throw new Exception("nao consegui salvar o apk");
            }
            try {
                escreverTexto(arquivoMarca(), endereco);
            } catch (Exception e) {
                // se falhar a marca, na proxima ele baixa de novo (sem problema)
            }
            return destino;
        } finally {
            try { if (saida != null) saida.close(); } catch (Exception e) { }
            try { if (entrada != null) entrada.close(); } catch (Exception e) { }
            if (conexao != null) conexao.disconnect();
            if (temporario.exists()) temporario.delete();
        }
    }

    private void abrirInstalador(final File apk) {
        final Context ctx = getContext();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !ctx.getPackageManager().canRequestPackageInstalls()) {
            notificar("Permita 'Instalar apps desconhecidos' e toque em Atualizar de novo.");
            abrirConfiguracoesDeInstalacao();
            JSObject dados = new JSObject();
            dados.put("mensagem", "precisa permitir a instalacao de apps");
            emitir("permissao", dados);
            return;
        }

        if (!apk.exists()) {
            notificar("O APK baixado sumiu. Toque em Atualizar de novo.");
            return;
        }

        try {
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
            } else {
                uri = Uri.fromFile(apk);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.setClipData(ClipData.newRawUri("apk", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);

            JSObject ok = new JSObject();
            ok.put("ok", true);
            emitir("concluido", ok);
        } catch (Exception e) {
            String motivo = e.getMessage() == null ? "erro ao abrir a instalacao" : e.getMessage();
            notificar("Nao consegui abrir a instalacao: " + motivo);
            JSObject dados = new JSObject();
            dados.put("mensagem", motivo);
            emitir("erro", dados);
        }
    }

    private void abrirConfiguracoesDeInstalacao() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            // alguns aparelhos nao tem essa tela; o usuario instala pelos Downloads
        }
    }

    // notificacoes para o JavaScript (progresso / concluido / erro / permissao)
    private void emitir(final String nome, final JSObject dados) {
        try {
            if (getActivity() == null) return;
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        notifyListeners(nome, dados);
                    } catch (Exception e) {
                        // sem o JS escutando, so ignora
                    }
                }
            });
        } catch (Exception e) {
            // ignora
        }
    }

    private void notificar(final String texto) {
        try {
            if (getActivity() == null) return;
            final Context ctx = getContext();
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    android.widget.Toast.makeText(ctx, texto, android.widget.Toast.LENGTH_LONG).show();
                }
            });
        } catch (Exception e) {
            // ignora
        }
    }

    private String lerTexto(File f) throws Exception {
        BufferedReader r = new BufferedReader(new FileReader(f));
        try {
            StringBuilder sb = new StringBuilder();
            String linha;
            while ((linha = r.readLine()) != null) sb.append(linha);
            return sb.toString();
        } finally {
            r.close();
        }
    }

    private void escreverTexto(File f, String texto) throws Exception {
        FileOutputStream out = new FileOutputStream(f);
        try {
            out.write(texto.getBytes("UTF-8"));
        } finally {
            out.close();
        }
    }
}
