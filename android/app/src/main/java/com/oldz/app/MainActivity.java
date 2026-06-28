package com.oldz.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册 TokenShare 插件，用于在 WebView 和原生 SharedPreferences 之间共享 JWT Token
        registerPlugin(TokenSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
