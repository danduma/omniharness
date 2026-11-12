package dev.omniharness.app;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OmniNativeRuntimePlugin.class);
        super.onCreate(savedInstanceState);
        // Back always belongs to the internal UI, including at the root screen.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null) return;
                getBridge().getWebView().evaluateJavascript(
                    "window.dispatchEvent(new Event('omni:back'))", null);
            }
        });
    }
}
