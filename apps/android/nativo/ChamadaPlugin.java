package app.logicacademy.estudos;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Ponte com o site: window.Capacitor.Plugins.Chamada.iniciar({titulo, texto}) e .parar(). */
@CapacitorPlugin(name = "Chamada")
public class ChamadaPlugin extends Plugin {
    @PluginMethod
    public void iniciar(PluginCall call) {
        Intent i = new Intent(getContext(), ChamadaService.class);
        i.putExtra("titulo", call.getString("titulo", "Chamada"));
        i.putExtra("texto", call.getString("texto", "Chamada em andamento no Logic Academy"));
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
            else getContext().startService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível manter a chamada em segundo plano: " + e.getMessage());
        }
    }

    @PluginMethod
    public void parar(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ChamadaService.class));
        call.resolve();
    }
}
