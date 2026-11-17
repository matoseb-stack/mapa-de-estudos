package app.logicacademy.estudos;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;
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
        // atualização por dentro do app: apaga sobras e escuta a resposta do instalador do Android
        Atualizador.limpar(this);
        ContextCompat.registerReceiver(this, new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) {
                int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -99);
                if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                    Intent conf = i.getParcelableExtra(Intent.EXTRA_INTENT);
                    if (conf != null) { conf.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); try { startActivity(conf); } catch (Exception e) { } }
                } else if (st != PackageInstaller.STATUS_SUCCESS) {
                    String m = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
                    String tipo = (st == PackageInstaller.STATUS_FAILURE_CONFLICT || st == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE) ? "assinatura"
                            : st == PackageInstaller.STATUS_FAILURE_ABORTED ? "cancelado" : "erro";
                    avisarAtualizacao(tipo, 0, m == null ? "" : m);
                }
            }
        }, new IntentFilter(Atualizador.ACAO), ContextCompat.RECEIVER_NOT_EXPORTED);
        // Android 13+: pedir para mostrar notificações (lembretes e chamada)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        abrirPedido(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        abrirPedido(getIntent());
    }

    /** Toque no widget (ex.: botão "Estudar"): abre a tela pedida assim que o site estiver pronto e logado. */
    void abrirPedido(Intent intent) {
        if (intent == null) return;
        String tela = intent.getStringExtra(SequenciaWidget.EXTRA_ABRIR);
        if (tela == null || tela.isEmpty() || "inicio".equals(tela)) return;
        intent.removeExtra(SequenciaWidget.EXTRA_ABRIR);
        final String js = "(typeof abrirPorUrl==='function'&&abrirPorUrl('./?abrir='+" + JSONObject.quote(tela) + ")===true)";
        final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());
        final int[] tentativas = {0};
        Runnable tentar = new Runnable() {
            @Override
            public void run() {
                try {
                    getBridge().getWebView().evaluateJavascript(js, r -> {
                        if (!"true".equals(r) && ++tentativas[0] < 60) h.postDelayed(this, 500);
                    });
                } catch (Exception e) { if (++tentativas[0] < 60) h.postDelayed(this, 500); }
            }
        };
        h.postDelayed(tentar, 300);
    }

    /** "Voltar" na primeira tela só esconde o app (não fecha): a chamada e o cronômetro continuam. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null && wv.canGoBack()) wv.goBack();
        else moveTaskToBack(true);
    }

    void avisarAtualizacao(String estado, int pct, String msg) {
        runOnUiThread(() -> {
            try {
                getBridge().getWebView().evaluateJavascript("window.appAtualizacao&&appAtualizacao(" + JSONObject.quote(estado) + "," + pct + "," + JSONObject.quote(msg) + ")", null);
            } catch (Exception e) { }
        });
    }

    private class Ponte {
        /** Baixa o app novo e instala por cima, sem deixar arquivo no aparelho. */
        @JavascriptInterface
        public void atualizarApp(String url) {
            if (url == null || !url.startsWith("https://github.com/")) return;
            if (!Atualizador.podeInstalar(MainActivity.this)) {
                avisarAtualizacao("permissao", 0, "");
                runOnUiThread(() -> {
                    try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); } catch (Exception e) { }
                });
                return;
            }
            Atualizador.iniciar(MainActivity.this, url, MainActivity.this::avisarAtualizacao);
        }

        @JavascriptInterface
        public boolean podeInstalar() { return Atualizador.podeInstalar(MainActivity.this); }

        /** Abre a tela do Android para desinstalar este app (usado só quando a troca é obrigatória). */
        @JavascriptInterface
        public void desinstalar() {
            runOnUiThread(() -> { try { startActivity(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + getPackageName()))); } catch (Exception e) { } });
        }

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

        @JavascriptInterface
        public void notificar(String titulo, String texto) {
            Lembretes.mostrar(MainActivity.this, titulo, texto);
        }

        /** Abre um endereço fora do app (ex.: baixar o app novo pelo navegador do celular). */
        @JavascriptInterface
        public void abrirLink(String url) {
            if (url == null || !url.startsWith("https://")) return;
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception e) { }
        }

        @JavascriptInterface
        public void permitirNotificacoes() {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1));
            }
        }
    }
}
