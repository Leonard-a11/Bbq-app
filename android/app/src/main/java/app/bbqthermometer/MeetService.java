package app.bbqthermometer;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/** Voorgrondservice: vaste melding met de temperaturen + CPU wakker houden. */
public class MeetService extends Service {
    static final String KANAAL = "meten";
    static final int ID = 4711;
    static volatile boolean actief = false;
    private PowerManager.WakeLock wakeLock;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String titel = intent != null ? intent.getStringExtra("titel") : null;
        String tekst = intent != null ? intent.getStringExtra("tekst") : null;
        Notification n = bouw(this, titel != null ? titel : "BBQ Thermometer", tekst != null ? tekst : "Meten…");
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            } else {
                startForeground(ID, n);
            }
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        actief = true;
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "bbqthermometer:meten");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(36L * 3600 * 1000); // max 36 uur
            }
        }
        // Niet vanzelf herstarten: zonder de app zelf kan de service niet meten.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        actief = false;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // App weggeveegd: stoppen, anders blijft er een melding staan zonder metingen.
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    static void maakKanaal(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(KANAAL) == null) {
                NotificationChannel ch = new NotificationChannel(KANAAL, "Meten op de achtergrond", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Vaste melding met de temperaturen zolang er gemeten wordt");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    static Notification bouw(Context c, String titel, String tekst) {
        maakKanaal(c);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent pi = open == null ? null : PendingIntent.getActivity(c, 0, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAAL)
                .setSmallIcon(R.drawable.ic_stat_thermo)
                .setColor(0xFFFF7A1A)
                .setContentTitle(titel)
                .setContentText(tekst)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(tekst))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        if (pi != null) b.setContentIntent(pi);
        return b.build();
    }

    static void toon(Context c, String titel, String tekst) {
        if (!actief) return;
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return;
        try {
            NotificationManagerCompat.from(c).notify(ID, bouw(c, titel, tekst));
        } catch (SecurityException e) {
            // geen toestemming voor meldingen
        }
    }
}
