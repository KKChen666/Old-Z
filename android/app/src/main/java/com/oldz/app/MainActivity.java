package com.oldz.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册 TokenShare 插件，用于在 WebView 和原生 SharedPreferences 之间共享 JWT Token
        registerPlugin(TokenSharePlugin.class);
        super.onCreate(savedInstanceState);
        applySystemBarInsets();
    }

    private void applySystemBarInsets() {
        View webView = getBridge().getWebView();
        if (webView == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
