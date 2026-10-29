package com.barbeariadojota.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdatePlugin.class);
        registerPlugin(AvisoPlugin.class);
        super.onCreate(savedInstanceState);
        criarCanalDeNotificacoes();
    }

    // cria o canal nativo ANTES de qualquer push: se o canal nao existir,
    // o Android descarta a notificacao que manda channelId.
    private void criarCanalDeNotificacoes() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            NotificationChannel canal = new NotificationChannel(
                "barbearia_atualizacoes",
                "Atualizações do app",
                NotificationManager.IMPORTANCE_HIGH
            );
            canal.setDescription("Avisos de novas versões e novidades");
            canal.enableVibration(true);
            canal.enableLights(true);
            nm.createNotificationChannel(canal);
        } catch (Exception e) {
            // nunca deixa isso derrubar o app
        }
    }
}
