package com.surtadoo.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Serviço em primeiro plano que mantém o WebView/áudio vivo em segundo plano
 * e expõe os controles na notificação e na tela de bloqueio.
 */
public class PlaybackService extends Service {

    public static final String ACTION_START = "com.surtadoo.music.action.START";
    public static final String ACTION_UPDATE = "com.surtadoo.music.action.UPDATE";
    public static final String ACTION_STOP = "com.surtadoo.music.action.STOP";
    public static final String ACTION_TOGGLE = "com.surtadoo.music.action.TOGGLE";
    public static final String ACTION_NEXT = "com.surtadoo.music.action.NEXT";
    public static final String ACTION_PREV = "com.surtadoo.music.action.PREV";
    public static final String ACTION_MEDIA_EVENT = "com.surtadoo.music.MEDIA_EVENT";

    private static final String CHANNEL_ID = "music_playback";
    private static final int NOTIF_ID = 4242;

    public static volatile boolean isRunning = false;

    private MediaSession session;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private String title = "Music";
    private String artist = "";
    private String album = "Music";
    private String artworkUrl = "";
    private String loadedArtUrl = "";
    private long duration = 0;
    private boolean playing = false;
    private Bitmap artwork;

    @Override
    public void onCreate() {
        super.onCreate();
        isRunning = true;
        createChannel();

        session = new MediaSession(this, "MusicPlayback");
        session.setActive(true);
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { sendEvent("play"); }
            @Override public void onPause() { sendEvent("pause"); }
            @Override public void onSkipToNext() { sendEvent("next"); }
            @Override public void onSkipToPrevious() { sendEvent("prev"); }
            @Override public void onStop() { sendEvent("stop"); }
            @Override public void onSeekTo(long pos) { sendEvent("seek:" + (pos / 1000)); }
        });

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Music::playback");
                wakeLock.setReferenceCounted(false);
            }
        } catch (Exception ignored) {
        }
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Music::wifi");
                wifiLock.setReferenceCounted(false);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            stopPlayback();
            return START_NOT_STICKY;
        }
        if (ACTION_TOGGLE.equals(action)) {
            sendEvent("toggle");
            return START_STICKY;
        }
        if (ACTION_NEXT.equals(action)) {
            sendEvent("next");
            return START_STICKY;
        }
        if (ACTION_PREV.equals(action)) {
            sendEvent("prev");
            return START_STICKY;
        }

        if (intent != null) {
            title = safe(intent.getStringExtra("title"), "Music");
            artist = safe(intent.getStringExtra("artist"), "");
            album = safe(intent.getStringExtra("album"), "Music");
            duration = intent.getLongExtra("duration", 0L);
            playing = intent.getBooleanExtra("isPlaying", false);
            String art = intent.getStringExtra("artwork");
            artworkUrl = art == null ? "" : art;
            if (!artworkUrl.isEmpty() && !artworkUrl.equals(loadedArtUrl)) {
                loadArtwork(artworkUrl);
            }
        }

        startForegroundCompat();
        updateSession();
        updateNotification();
        return START_STICKY;
    }

    private void startForegroundCompat() {
        Notification n = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            try {
                startForeground(NOTIF_ID, n);
            } catch (Exception ignored) {
            }
        }
    }

    private void updateNotification() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIF_ID, buildNotification());
        } catch (Exception ignored) {
        }
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 10, open, pendingFlags());

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }

        b.setContentTitle(title)
                .setContentText(artist)
                .setSmallIcon(R.drawable.ic_music_note)
                .setContentIntent(content)
                .setOngoing(playing)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setVisibility(Notification.VISIBILITY_PUBLIC);

        b.addAction(R.drawable.ic_music_prev, "Anterior", servicePending(ACTION_PREV, 1));
        if (playing) {
            b.addAction(R.drawable.ic_music_pause, "Pausar", servicePending(ACTION_TOGGLE, 2));
        } else {
            b.addAction(R.drawable.ic_music_play, "Tocar", servicePending(ACTION_TOGGLE, 2));
        }
        b.addAction(R.drawable.ic_music_next, "Próxima", servicePending(ACTION_NEXT, 3));

        if (artwork != null) b.setLargeIcon(artwork);

        try {
            Notification.MediaStyle style = new Notification.MediaStyle();
            style.setShowActionsInCompactView(0, 1, 2);
            if (session != null) style.setMediaSession(session.getSessionToken());
            b.setStyle(style);
        } catch (Exception ignored) {
        }
        return b.build();
    }

    private PendingIntent servicePending(String action, int code) {
        Intent i = new Intent(this, PlaybackService.class).setAction(action);
        return PendingIntent.getService(this, code, i, pendingFlags());
    }

    private int pendingFlags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    private void updateSession() {
        if (session == null) return;
        try {
            MediaMetadata.Builder md = new MediaMetadata.Builder()
                    .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                    .putString(MediaMetadata.METADATA_KEY_ALBUM, album);
            if (duration > 0) md.putLong(MediaMetadata.METADATA_KEY_DURATION, duration);
            if (artwork != null) md.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, artwork);
            session.setMetadata(md.build());

            long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
                    | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT
                    | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO
                    | PlaybackState.ACTION_STOP;
            int state = playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
            session.setPlaybackState(new PlaybackState.Builder()
                    .setActions(actions)
                    .setState(state, 0, playing ? 1f : 0f)
                    .build());
        } catch (Exception ignored) {
        }
        if (playing) acquireLocks();
        else releaseLocks();
    }

    private void acquireLocks() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
        } catch (Exception ignored) {
        }
        try {
            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
        } catch (Exception ignored) {
        }
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {
        }
        try {
            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        } catch (Exception ignored) {
        }
    }

    private void loadArtwork(final String url) {
        loadedArtUrl = url;
        new Thread(new Runnable() {
            @Override
            public void run() {
                Bitmap bmp = null;
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(8000);
                    c.setInstanceFollowRedirects(true);
                    c.setRequestProperty("User-Agent", "MusicApp/2.0");
                    InputStream in = c.getInputStream();
                    bmp = BitmapFactory.decodeStream(in);
                    in.close();
                    c.disconnect();
                } catch (Exception ignored) {
                }
                if (bmp == null) return;
                final Bitmap finalBmp = bmp;
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        artwork = finalBmp;
                        updateSession();
                        updateNotification();
                    }
                });
            }
        }).start();
    }

    private void sendEvent(String action) {
        try {
            Intent i = new Intent(ACTION_MEDIA_EVENT);
            i.setPackage(getPackageName());
            i.putExtra("action", action);
            sendBroadcast(i);
        } catch (Exception ignored) {
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reprodução de música", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Controles da música em segundo plano");
            ch.setShowBadge(false);
            ch.setSound(null, null);
            ch.enableVibration(false);
            nm.createNotificationChannel(ch);
        } catch (Exception ignored) {
        }
    }

    private void stopPlayback() {
        releaseLocks();
        try {
            if (session != null) {
                session.setActive(false);
                session.release();
                session = null;
            }
        } catch (Exception ignored) {
        }
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception ignored) {
        }
        isRunning = false;
        stopSelf();
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        releaseLocks();
        try {
            if (session != null) {
                session.setActive(false);
                session.release();
                session = null;
            }
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Mantém a música tocando ao remover o app dos recentes.
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private static String safe(String v, String def) {
        return v == null || v.trim().isEmpty() ? def : v;
    }
}
