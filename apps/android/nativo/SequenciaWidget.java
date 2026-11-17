package app.logicacademy.estudos;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget da tela inicial (estilo apps de estudo como o Duolingo):
 * chama da sequência (acesa se já estudou hoje), bolinhas da semana, barra da meta do dia,
 * frase que muda conforme a situação e botão "Estudar" que abre o próximo bloco.
 * Três tamanhos: pequeno (2x2), médio (4x2) e grande (4x3+). Recalcula sozinho na virada do dia.
 */
public class SequenciaWidget extends AppWidgetProvider {
    static final String EXTRA_ABRIR = "app.logicacademy.estudos.ABRIR";

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, montar(c, m, id));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle opcoes) {
        m.updateAppWidget(id, montar(c, m, id));
    }

    static void atualizarTodos(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, SequenciaWidget.class));
        for (int id : ids) m.updateAppWidget(id, montar(c, m, id));
    }

    /** Dados que o site manda (window.LogicAndroid.widget) já ajustados para o dia de hoje. */
    static class Dados {
        int seq, hoje, meta, recorde;
        boolean estudouHoje, temDados;
        String proximo = "";
        int[] semana = new int[7];   // seg..dom: 1 estudou, 0 não estudou, 2 hoje sem estudo, -1 ainda vai chegar
        int horaAgora;

        static Dados ler(Context c) {
            Dados d = new Dados();
            Calendar agora = Calendar.getInstance();
            d.horaAgora = agora.get(Calendar.HOUR_OF_DAY);
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            String hojeIso = f.format(agora.getTime());
            Calendar ontemC = (Calendar) agora.clone(); ontemC.add(Calendar.DAY_OF_YEAR, -1);
            String ontemIso = f.format(ontemC.getTime());
            Set<String> feitos = new HashSet<>();
            String dia = "";
            try {
                JSONObject o = new JSONObject(c.getSharedPreferences("logic", Context.MODE_PRIVATE).getString("widget", "{}"));
                d.temDados = o.has("seq");
                d.seq = o.optInt("seq", 0); d.hoje = o.optInt("hoje", 0); d.meta = o.optInt("meta", 0);
                d.recorde = o.optInt("recorde", 0);
                d.proximo = o.optString("proximo", "");
                dia = o.optString("dia", "");
                JSONArray a = o.optJSONArray("feitos");
                if (a != null) for (int i = 0; i < a.length(); i++) feitos.add(a.optString(i));
            } catch (Exception e) { }
            // os dados foram salvos em outro dia? ajusta sem precisar abrir o app
            if (!dia.isEmpty() && !dia.equals(hojeIso)) {
                boolean ontemEstudou = feitos.contains(ontemIso) || (dia.equals(ontemIso) && d.hoje > 0);
                if (!ontemEstudou) d.seq = 0;
                d.hoje = 0; d.proximo = "";
            }
            if (d.hoje > 0) feitos.add(hojeIso);
            d.estudouHoje = feitos.contains(hojeIso);
            // semana atual, de segunda a domingo
            int idxHoje = (agora.get(Calendar.DAY_OF_WEEK) + 5) % 7;   // seg=0 … dom=6
            Calendar seg = (Calendar) agora.clone(); seg.add(Calendar.DAY_OF_YEAR, -idxHoje);
            for (int i = 0; i < 7; i++) {
                String iso = f.format(seg.getTime());
                if (i > idxHoje) d.semana[i] = -1;
                else if (feitos.contains(iso)) d.semana[i] = 1;
                else d.semana[i] = (i == idxHoje) ? 2 : 0;
                seg.add(Calendar.DAY_OF_YEAR, 1);
            }
            return d;
        }

        int pct() { return meta > 0 ? Math.min(100, Math.round(hoje * 100f / meta)) : 0; }
        boolean metaBatida() { return meta > 0 && hoje >= meta; }
        boolean emRisco() { return !estudouHoje && seq > 0 && horaAgora >= 18; }

        String frase() {
            if (!temDados) return "Abra o Logic Academy para ligar o widget ✨";
            if (metaBatida()) return "Meta de hoje batida! 🏆 Você está imparável.";
            if (emRisco()) return "🔥 Sua sequência de " + seq + (seq == 1 ? " dia" : " dias") + " acaba hoje! Bora salvar?";
            if (!estudouHoje && seq == 0) return "Comece uma sequência hoje: 25 minutos já valem! 💪";
            if (!estudouHoje) return "Mantenha a chama acesa: " + seq + (seq == 1 ? " dia" : " dias") + " seguidos! 🔥";
            int falta = Math.max(0, meta - hoje);
            return "Boa! Faltam " + tempo(falta) + " para a meta de hoje 🎯";
        }
    }

    static String tempo(int min) {
        if (min < 60) return min + " min";
        int h = min / 60, r = min % 60;
        return r == 0 ? h + "h" : h + "h" + (r < 10 ? "0" : "") + r;
    }

    static RemoteViews montar(Context c, AppWidgetManager m, int id) {
        Dados d = Dados.ler(c);
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> tamanhos = new HashMap<>();
            tamanhos.put(new SizeF(100f, 100f), preencher(c, d, R.layout.widget_pequeno));
            tamanhos.put(new SizeF(240f, 100f), preencher(c, d, R.layout.widget_sequencia));
            tamanhos.put(new SizeF(240f, 190f), preencher(c, d, R.layout.widget_grande));
            return new RemoteViews(tamanhos);
        }
        int larg = 250, alt = 110;
        try {
            Bundle o = m.getAppWidgetOptions(id);
            larg = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, larg);
            alt = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, alt);
        } catch (Exception e) { }
        int layout = larg < 200 ? R.layout.widget_pequeno : (alt >= 190 ? R.layout.widget_grande : R.layout.widget_sequencia);
        return preencher(c, d, layout);
    }

    static final int[] DIAS = {R.id.w_d0, R.id.w_d1, R.id.w_d2, R.id.w_d3, R.id.w_d4, R.id.w_d5, R.id.w_d6};
    static final int[] LETRAS = {R.id.w_l0, R.id.w_l1, R.id.w_l2, R.id.w_l3, R.id.w_l4, R.id.w_l5, R.id.w_l6};

    static RemoteViews preencher(Context c, Dados d, int layout) {
        RemoteViews v = new RemoteViews(c.getPackageName(), layout);
        // fundo conforme a situação: verde (meta batida), laranja (sequência em risco) ou azul
        v.setInt(R.id.w_raiz, "setBackgroundResource",
                d.metaBatida() ? R.drawable.widget_fundo_meta : d.emRisco() ? R.drawable.widget_fundo_risco : R.drawable.widget_fundo);
        v.setImageViewResource(R.id.w_chama, d.estudouHoje ? R.drawable.widget_chama : R.drawable.widget_chama_apagada);
        v.setTextViewText(R.id.w_seq, String.valueOf(d.seq));
        v.setTextViewText(R.id.w_seq_rot, d.seq == 1 ? "dia seguido" : "dias seguidos");
        if (layout != R.layout.widget_pequeno) {
            for (int i = 0; i < 7; i++) {
                int s = d.semana[i];
                v.setImageViewResource(DIAS[i], s == 1 ? R.drawable.widget_dia_feito : s == 2 ? R.drawable.widget_dia_hoje
                        : s == 0 ? R.drawable.widget_dia_vazio : R.drawable.widget_dia_futuro);
                v.setTextColor(LETRAS[i], (s == 2 || (s == 1 && i == hojeIdx(d))) ? 0xFFFFC800 : 0xB3FFFFFF);
            }
            v.setTextViewText(R.id.w_min, d.meta > 0 ? "Meta de hoje · " + tempo(d.hoje) + " de " + tempo(d.meta) : "Meta de hoje");
            v.setTextViewText(R.id.w_msg, d.frase());
            v.setTextViewText(R.id.w_prox, d.proximo.isEmpty() ? (d.metaBatida() ? "Dia concluído ✅" : "Sem blocos pendentes hoje") : "Próximo bloco: " + d.proximo);
            v.setTextViewText(R.id.w_recorde, d.recorde > d.seq ? "Recorde: " + d.recorde + " 🏅" : (d.seq > 0 ? "Seu recorde! 🏅" : ""));
            v.setTextViewText(R.id.w_botao, d.metaBatida() ? "▶ MAIS UM" : "▶ ESTUDAR");
            v.setInt(R.id.w_botao, "setBackgroundResource", d.emRisco() ? R.drawable.widget_botao_claro : R.drawable.widget_botao);
            v.setTextColor(R.id.w_botao, d.emRisco() ? 0xFFEA580C : 0xFFFFFFFF);
            v.setOnClickPendingIntent(R.id.w_botao, abrir(c, "proximo", 4));
        }
        v.setProgressBar(R.id.w_barra, 100, d.pct(), false);
        v.setOnClickPendingIntent(R.id.w_raiz, abrir(c, "inicio", 3));
        return v;
    }

    static int hojeIdx(Dados d) {
        for (int i = 0; i < 7; i++) if (i == 6 || d.semana[i + 1] == -1) return i;
        return 6;
    }

    static PendingIntent abrir(Context c, String tela, int codigo) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra(EXTRA_ABRIR, tela);
        return PendingIntent.getActivity(c, codigo, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
