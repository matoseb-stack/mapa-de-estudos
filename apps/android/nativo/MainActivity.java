package app.logicacademy.estudos;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView wv = getBridge().getWebView();
        // login com Google/Apple passa pelo domínio do Firebase: precisa aceitar os cookies dele
        try { CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true); } catch (Exception e) { }
        // ponte com o site: window.LogicAndroid (chamada em segundo plano, widget, notificações agendadas, versão)
        wv.addJavascriptInterface(new Ponte(), "LogicAndroid");
        // Android 13+: pedir para mostrar notificações (lembretes e chamada)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    /** "Voltar" na primeira tela só esconde o app (não fecha): a chamada e o cronômetro continuam. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null && wv.canGoBack()) wv.goBack();
        else moveTaskToBack(true);
    }

    private class Ponte {
        @JavascriptInterface
        public String versao() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void chamada(boolean ativa, String titulo) {
            Intent i = new Intent(MainActivity.this, ChamadaService.class);
            if (ativa) {
                i.putExtra("titulo", titulo == null || titulo.isEmpty() ? "Chamada" : titulo);
                i.putExtra("texto", "Chamada em andamento no Logic Academy");
                try {
                    if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
                } catch (Exception e) { }
            } else {
                stopService(i);
            }
        }

        @JavascriptInterface
        public void widget(String json) {
            getSharedPreferences("logic", MODE_PRIVATE).edit().putString("widget", json).apply();
            SequenciaWidget.atualizarTodos(MainActivity.this);
        }

        @JavascriptInterface
        public void agendar(String json) {
            Lembretes.agendar(MainActivity.this, json);
        }
    }
}
