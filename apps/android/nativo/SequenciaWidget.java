package app.logicacademy.estudos;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** Widget da tela inicial: sequência de dias, próximo bloco e quanto falta para a meta. Tocar abre o app. */
public class SequenciaWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, vistas(c));
    }

    static RemoteViews vistas(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_sequencia);
        int seq = 0; String prox = "", texto = "";
        try {
            JSONObject o = new JSONObject(c.getSharedPreferences("logic", Context.MODE_PRIVATE).getString("widget", "{}"));
            seq = o.optInt("seq", 0); prox = o.optString("proximo", ""); texto = o.optString("texto", "");
        } catch (Exception e) { }
        v.setTextViewText(R.id.w_seq, "🔥 " + seq + (seq == 1 ? " dia" : " dias"));
        v.setTextViewText(R.id.w_prox, prox.isEmpty() ? "Sem blocos pendentes hoje" : "Próximo: " + prox);
        v.setTextViewText(R.id.w_meta, texto.isEmpty() ? "Toque para abrir" : texto);
        Intent abrir = new Intent(c, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.w_raiz, PendingIntent.getActivity(c, 3, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return v;
    }

    static void atualizarTodos(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, SequenciaWidget.class));
        for (int id : ids) m.updateAppWidget(id, vistas(c));
    }
}
