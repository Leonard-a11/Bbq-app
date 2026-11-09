package app.bbqthermometer;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Houdt de app levend tijdens het meten (scherm uit / andere app open):
 * start een voorgrondservice met een vaste melding en een wake lock,
 * en laat de WebView op hoge prioriteit draaien als hij niet zichtbaar is.
 */
@CapacitorPlugin(name = "Achtergrond")
public class AchtergrondPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        Context c = getContext();
        String titel = call.getString("titel", "BBQ Thermometer");
        String tekst = call.getString("tekst", "Meten…");
        if (MeetService.actief) {
            MeetService.toon(c, titel, tekst);
            call.resolve();
            return;
        }
        Intent i = new Intent(c, MeetService.class);
        i.putExtra("titel", titel);
        i.putExtra("tekst", tekst);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
        } catch (Exception e) {
            call.reject("Achtergrond starten mislukt: " + e.getMessage());
            return;
        }
        getActivity().runOnUiThread(() -> {
            WebView wv = getBridge().getWebView();
            if (wv != null && Build.VERSION.SDK_INT >= 26) {
                wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        MeetService.toon(getContext(), call.getString("titel", "BBQ Thermometer"), call.getString("tekst", ""));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), MeetService.class));
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("actief", MeetService.actief);
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        r.put("accuVrij", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(r);
    }

    /** Vraag Android om de app niet te beperken door accubesparing. */
    @PluginMethod
    public void accuVrijgeven(PluginCall call) {
        Context c = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
            } catch (Exception e2) {
                call.reject("Kon instellingen niet openen");
                return;
            }
        }
        call.resolve();
    }
}
