package app.logicacademy.estudos;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ChamadaPlugin.class);
        super.onCreate(savedInstanceState);
        // login com Google/Apple passa pelo domínio do Firebase: precisa aceitar os cookies dele
        try {
            CookieManager.getInstance().setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        } catch (Exception e) {
            // segue sem isso; o login por e-mail continua funcionando
        }
    }

    /** "Voltar" na primeira tela só esconde o app (não fecha): a chamada e o cronômetro continuam. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView().canGoBack()) getBridge().getWebView().goBack();
        else moveTaskToBack(true);
    }
}
