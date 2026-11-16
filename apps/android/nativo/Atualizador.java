package app.logicacademy.estudos;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.ContentValues;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.provider.MediaStore;
import java.util.Arrays;
import android.os.Build;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Atualiza o próprio app por dentro: baixa o app novo para a área temporária do app,
 * entrega ao instalador do Android (que instala por cima, mantendo os dados) e apaga o arquivo.
 * Nada fica em Downloads.
 */
public class Atualizador {
    static final String ACAO = "app.logicacademy.estudos.INSTALACAO";
    static final String ARQUIVO = "atualizacao.apk";

    interface Aviso { void enviar(String estado, int pct, String msg); }

    static boolean podeInstalar(Context c) {
        return Build.VERSION.SDK_INT < 26 || c.getPackageManager().canRequestPackageInstalls();
    }

    static void limpar(Context c) {
        try { new File(c.getCacheDir(), ARQUIVO).delete(); } catch (Exception e) { }
    }

    private static byte[] chave(PackageInfo p) {
        if (p == null) return null;
        Signature[] s = null;
        if (Build.VERSION.SDK_INT >= 28 && p.signingInfo != null) s = p.signingInfo.getApkContentsSigners();
        else s = p.signatures;
        return s != null && s.length > 0 ? s[0].toByteArray() : null;
    }
    @SuppressWarnings("deprecation")
    static boolean mesmaAssinatura(Context c, String apk) {
        try {
            PackageManager pm = c.getPackageManager();
            int fl = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            byte[] novo = chave(pm.getPackageArchiveInfo(apk, fl)), atual = chave(pm.getPackageInfo(c.getPackageName(), fl));
            if (novo == null || atual == null) return true;   // sem como saber: tenta instalar
            return Arrays.equals(novo, atual);
        } catch (Exception e) { return true; }
    }
    /** Copia o app novo para a pasta Downloads (para instalar depois de desinstalar o antigo). */
    static String guardarEmDownloads(Context c, File f) {
        if (Build.VERSION.SDK_INT < 29) return null;
        try {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, "LogicAcademy-novo.apk");
            v.put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.android.package-archive");
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download");
            Uri u = c.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (u == null) return null;
            try (OutputStream o = c.getContentResolver().openOutputStream(u); InputStream in = new FileInputStream(f)) {
                byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n);
            }
            return "Download/LogicAcademy-novo.apk";
        } catch (Exception e) { return null; }
    }

    static void iniciar(Context c, String url, Aviso aviso) {
        new Thread(() -> {
            File f = new File(c.getCacheDir(), ARQUIVO);
            try {
                // baixa (o GitHub redireciona para outro endereço https; seguimos até 5 vezes)
                HttpURLConnection con = null;
                String atual = url;
                for (int i = 0; i < 5; i++) {
                    con = (HttpURLConnection) new URL(atual).openConnection();
                    con.setInstanceFollowRedirects(false);
                    con.setConnectTimeout(20000);
                    con.setReadTimeout(30000);
                    int st = con.getResponseCode();
                    if (st >= 300 && st < 400) { atual = con.getHeaderField("Location"); con.disconnect(); continue; }
                    if (st != 200) throw new Exception("o servidor respondeu " + st);
                    break;
                }
                long total = con.getContentLengthLong(), lido = 0;
                int ult = -1;
                try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(f)) {
                    byte[] b = new byte[65536];
                    int n;
                    while ((n = in.read(b)) > 0) {
                        out.write(b, 0, n);
                        lido += n;
                        int p = total > 0 ? (int) (lido * 100 / total) : 0;
                        if (p != ult && p % 5 == 0) { ult = p; aviso.enviar("baixando", p, ""); }
                    }
                }
                // a chave do app novo é a mesma deste? Se não for, o Android recusaria: guarda o app novo em Downloads e guia a troca
                if (!mesmaAssinatura(c, f.getAbsolutePath())) {
                    String onde = guardarEmDownloads(c, f);
                    f.delete();
                    aviso.enviar("trocar", 0, onde == null ? "" : onde);
                    return;
                }
                aviso.enviar("instalando", 100, "");
                // entrega ao instalador do Android
                PackageInstaller pi = c.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                sp.setAppPackageName(c.getPackageName());
                if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                int id = pi.createSession(sp);
                try (PackageInstaller.Session s = pi.openSession(id)) {
                    try (OutputStream o = s.openWrite("app", 0, f.length()); InputStream in = new FileInputStream(f)) {
                        byte[] b = new byte[65536];
                        int n;
                        while ((n = in.read(b)) > 0) o.write(b, 0, n);
                        s.fsync(o);
                    }
                    f.delete();
                    Intent it = new Intent(ACAO).setPackage(c.getPackageName());
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    s.commit(PendingIntent.getBroadcast(c, id, it, flags).getIntentSender());
                }
            } catch (Exception e) {
                f.delete();
                aviso.enviar("erro", 0, e.getMessage() == null ? "falha" : e.getMessage());
            }
        }).start();
    }
}
