package com.surtadoo.music;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MusicBackground")
public class MusicBackgroundPlugin extends Plugin {

    private BroadcastReceiver mediaReceiver;

    @Override
    public void load() {
        mediaReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                String action = intent.getStringExtra("action");
                if (action == null) return;
                try {
                    JSObject ret = new JSObject();
                    ret.put("action", action);
                    notifyListeners("mediaAction", ret);
                } catch (Exception ignored) {
                }
            }
        };
        try {
            IntentFilter filter = new IntentFilter(PlaybackService.ACTION_MEDIA_EVENT);
            if (Build.VERSION.SDK_INT >= 33) {
                getContext().registerReceiver(mediaReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(mediaReceiver, filter);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (mediaReceiver != null) getContext().unregisterReceiver(mediaReceiver);
        } catch (Exception ignored) {
        }
        mediaReceiver = null;
        super.handleOnDestroy();
    }

    private Intent baseIntent(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class);
        i.putExtra("title", call.getString("title", "Music"));
        i.putExtra("artist", call.getString("artist", ""));
        i.putExtra("album", call.getString("album", "Music"));
        Double d = call.getDouble("duration", 0.0);
        i.putExtra("duration", d == null ? 0L : d.longValue());
        Boolean p = call.getBoolean("isPlaying", false);
        i.putExtra("isPlaying", p != null && p);
        i.putExtra("artwork", call.getString("artwork", ""));
        return i;
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent i = baseIntent(call);
        i.setAction(PlaybackService.ACTION_START);
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
            else getContext().startService(i);
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent i = baseIntent(call);
        i.setAction(PlaybackService.ACTION_UPDATE);
        try {
            if (PlaybackService.isRunning) getContext().startService(i);
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class);
        i.setAction(PlaybackService.ACTION_STOP);
        try {
            getContext().startService(i);
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void askPermissions(PluginCall call) {
        String kind = call.getString("kind", "all");
        java.util.ArrayList<String> perms = new java.util.ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33) {
            if ("all".equals(kind) || "notifications".equals(kind)) perms.add(Manifest.permission.POST_NOTIFICATIONS);
            if ("all".equals(kind) || "storage".equals(kind)) perms.add(Manifest.permission.READ_MEDIA_AUDIO);
        } else if (Build.VERSION.SDK_INT >= 23) {
            if ("all".equals(kind) || "storage".equals(kind)) perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        if (!perms.isEmpty()) {
            try {
                if (getActivity() != null) {
                    ActivityCompat.requestPermissions(getActivity(), perms.toArray(new String[0]), 7711);
                }
            } catch (Exception ignored) {
            }
        }
        call.resolve(status());
    }

    @PluginMethod
    public void checkStatus(PluginCall call) {
        call.resolve(status());
    }

    private JSObject status() {
        JSObject o = new JSObject();
        boolean notifications;
        try {
            notifications = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        } catch (Exception e) {
            notifications = true;
        }
        boolean storage;
        if (Build.VERSION.SDK_INT >= 33) {
            storage = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
        } else if (Build.VERSION.SDK_INT >= 23) {
            storage = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        } else {
            storage = true;
        }
        boolean unknown = true;
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                unknown = getContext().getPackageManager().canRequestPackageInstalls();
            } catch (Exception e) {
                unknown = false;
            }
        }
        boolean battery = true;
        if (Build.VERSION.SDK_INT >= 23) {
            try {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                battery = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            } catch (Exception e) {
                battery = false;
            }
        }
        o.put("notifications", notifications);
        o.put("storage", storage);
        o.put("unknownSources", unknown);
        o.put("batteryOptimization", battery);
        o.put("sdk", Build.VERSION.SDK_INT);
        return o;
    }

    @PluginMethod
    public void openUnknownSources(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 26) {
                i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            try {
                getContext().startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23) {
            try {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception e) {
                try {
                    getContext().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) {
                }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) {
        }
        call.resolve();
    }
}
