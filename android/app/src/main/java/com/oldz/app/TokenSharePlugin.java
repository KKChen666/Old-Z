package com.oldz.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor 插件：在 WebView (localStorage) 与原生 SharedPreferences 之间共享 JWT Token。
 * Android 桌面小部件（原生代码）通过 SharedPreferences 读取 Token 来访问 API。
 */
@CapacitorPlugin(name = "TokenShare")
public class TokenSharePlugin extends Plugin {

    private static final String PREFS_NAME = "oldz_widget_prefs";
    private static final String KEY_TOKEN = "auth_token";

    @PluginMethod
    public void saveToken(PluginCall call) {
        String token = call.getString("token", "");
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_TOKEN, token).apply();
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void clearToken(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().remove(KEY_TOKEN).apply();
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getToken(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String token = prefs.getString(KEY_TOKEN, null);
        JSObject result = new JSObject();
        result.put("token", token);
        call.resolve(result);
    }
}
