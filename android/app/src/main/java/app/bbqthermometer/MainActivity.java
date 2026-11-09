package app.bbqthermometer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AchtergrondPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
