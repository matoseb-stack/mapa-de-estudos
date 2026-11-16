package app.logicacademy.estudos;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lembretes de estudo agendados pelo próprio celular: chegam mesmo com o app fechado.
 * O site manda a agenda dos próximos 7 dias (próximo bloco, meta, sequência); ao religar o celular, a agenda volta.
 */
public class Lembretes extends BroadcastReceiver {
    private static final String CANAL = "lembretes";

    static void agendar(Context c, String json) {
        SharedPreferences sp = c.getSharedPreferences("logic", Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int antes = sp.getInt("n_lemb", 0);
        for (int i = 0; i < antes; i++) am.cancel(pendente(c, i, null));
        int n = 0;
        try {
            JSONArray lista = new JSONArray(json == null ? "[]" : json);
            long agora = System.currentTimeMillis();
            for (int i = 0; i < lista.length() && n < 60; i++) {
                JSONObject o = lista.getJSONObject(i);
                long em = o.optLong("em", 0);
                if (em <= agora) continue;
                PendingIntent pi = pendente(c, n, o);
                if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, em, pi);
                else am.set(AlarmManager.RTC_WAKEUP, em, pi);
                n++;
            }
        } catch (Exception e) { }
        sp.edit().putInt("n_lemb", n).putString("agenda", json == null ? "[]" : json).apply();
    }

    private static PendingIntent pendente(Context c, int i, JSONObject o) {
        Intent it = new Intent(c, Lembretes.class);
        it.setAction("app.logicacademy.estudos.LEMBRETE_" + i);
        if (o != null) {
            it.putExtra("titulo", o.optString("titulo", "Logic Academy"));
            it.putExtra("texto", o.optString("texto", ""));
        }
        return PendingIntent.getBroadcast(c, i, it, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public void onReceive(Context c, Intent it) {
        String acao = it.getAction() == null ? "" : it.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(acao) || "android.intent.action.MY_PACKAGE_REPLACED".equals(acao)) {
            agendar(c, c.getSharedPreferences("logic", Context.MODE_PRIVATE).getString("agenda", "[]"));
            return;
        }
        if (!acao.startsWith("app.logicacademy.estudos.LEMBRETE_")) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CANAL, "Lembretes de estudo", NotificationManager.IMPORTANCE_DEFAULT));
        Intent abrir = new Intent(c, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pa = PendingIntent.getActivity(c, 7, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String titulo = it.getStringExtra("titulo"), texto = it.getStringExtra("texto");
        Notification n = new NotificationCompat.Builder(c, CANAL)
                .setSmallIcon(c.getApplicationInfo().icon)
                .setContentTitle(titulo == null ? "Logic Academy" : titulo)
                .setContentText(texto == null ? "" : texto)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(texto == null ? "" : texto))
                .setAutoCancel(true)
                .setContentIntent(pa)
                .build();
        nm.notify((int) (System.currentTimeMillis() % 1000000), n);
    }
}
