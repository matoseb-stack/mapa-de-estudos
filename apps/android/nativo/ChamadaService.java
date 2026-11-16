package app.logicacademy.estudos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

/** Mantém o app vivo durante a chamada (notificação "Chamada em andamento"), mesmo com o app fora da tela. */
public class ChamadaService extends Service {
    private static final String CANAL = "chamada";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String titulo = intent != null && intent.getStringExtra("titulo") != null ? intent.getStringExtra("titulo") : "Chamada";
        String texto = intent != null && intent.getStringExtra("texto") != null ? intent.getStringExtra("texto") : "Chamada em andamento no Logic Academy";
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            nm.createNotificationChannel(new NotificationChannel(CANAL, "Chamadas", NotificationManager.IMPORTANCE_LOW));
        }
        Intent abrir = new Intent(this, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent pi = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CANAL)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setSmallIcon(getApplicationInfo().icon)
                .setOngoing(true)
                .setContentIntent(pi)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .build();
        try {
            if (Build.VERSION.SDK_INT >= 30) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(1, n);
        } catch (Exception semMicrofone) {
            try {
                if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                else startForeground(1, n);
            } catch (Exception e) {
                stopSelf();
            }
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
