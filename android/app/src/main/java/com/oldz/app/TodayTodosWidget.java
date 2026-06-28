package com.oldz.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * 今日待办桌面小部件
 *
 * 功能：
 * - 展示今日待办列表（标记为 isTodayTodo 的 + dueDate 为今天的）
 * - 点击小部件打开 App
 * - 每 30 分钟自动刷新
 */
public class TodayTodosWidget extends AppWidgetProvider {

    private static final String TAG = "TodayTodosWidget";
    private static final String PREFS_NAME = "oldz_widget_prefs";
    private static final String KEY_TOKEN = "auth_token";
    private static final String API_BASE = "http://119.45.182.166:3001/api";
    private static final String ACTION_REFRESH = "com.oldz.app.ACTION_WIDGET_REFRESH";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(context, TodayTodosWidget.class));
            for (int id : ids) {
                updateAppWidget(context, mgr, id);
            }
        }
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        // 首次添加小部件时注册定期更新
        ComponentName thisWidget = new ComponentName(context, TodayTodosWidget.class);
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(thisWidget);
        for (int id : ids) {
            updateAppWidget(context, mgr, id);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today_todos);

        // 设置小部件标题
        views.setTextViewText(R.id.widget_title, "今日待办");

        // 点击小部件打开主应用
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        }

        // 设置 ListView 的 RemoteViewsService
        Intent serviceIntent = new Intent(context, WidgetTodoService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.widget_todo_list, serviceIntent);

        // 设置空视图
        views.setEmptyView(R.id.widget_todo_list, R.id.widget_empty_text);

        // 设置点击列表项打开 App 的 PendingIntent 模板
        Intent itemIntent = new Intent(context, TodayTodosWidget.class);
        itemIntent.setAction(ACTION_REFRESH);
        PendingIntent itemPendingIntent = PendingIntent.getBroadcast(
                context, 0, itemIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        views.setPendingIntentTemplate(R.id.widget_todo_list, itemPendingIntent);

        // 强制刷新
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_todo_list);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    /**
     * 从 SharedPreferences 读取 JWT Token
     */
    static String getToken(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_TOKEN, null);
    }

    /**
     * 今日待办数据项
     */
    static class TodoItem {
        String title;
        String priority;
        boolean completed;

        TodoItem(String title, String priority, boolean completed) {
            this.title = title;
            this.priority = priority;
            this.completed = completed;
        }
    }

    /**
     * 从 API 获取今日待办列表（同步方法，在后台线程调用）
     */
    static List<TodoItem> fetchTodayTodos(String token) {
        List<TodoItem> todos = new ArrayList<>();
        HttpURLConnection conn = null;
        try {
            URL url = new URL(API_BASE + "/todos");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                Log.w(TAG, "API returned code: " + responseCode);
                return todos;
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();

            JSONObject response = new JSONObject(sb.toString());
            if (!response.optBoolean("success", false)) {
                return todos;
            }

            JSONArray data = response.optJSONArray("data");
            if (data == null) return todos;

            String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
                    .format(new java.util.Date());

            for (int i = 0; i < data.length(); i++) {
                JSONObject todo = data.getJSONObject(i);
                boolean isTodayTodo = todo.optBoolean("isTodayTodo", false);
                String dueDate = todo.optString("dueDate", null);
                String status = todo.optString("status", "pending");

                // 只展示今日待办：标记了 isTodayTodo 或 dueDate 为今天
                boolean isDueToday = today.equals(dueDate);
                if (isTodayTodo || isDueToday) {
                    todos.add(new TodoItem(
                            todo.optString("title", ""),
                            todo.optString("priority", "medium"),
                            "completed".equals(status)
                    ));
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to fetch todos", e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return todos;
    }

    /**
     * 为 ListView 提供数据的 RemoteViewsService
     */
    public static class WidgetTodoService extends RemoteViewsService {
        @Override
        public RemoteViewsFactory onGetViewFactory(Intent intent) {
            return new TodoRemoteViewsFactory(getApplicationContext());
        }
    }

    /**
     * RemoteViewsFactory：为 ListView 提供数据
     */
    public static class TodoRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

        private final Context context;
        private List<TodoItem> todos = new ArrayList<>();

        TodoRemoteViewsFactory(Context context) {
            this.context = context;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            todos.clear();
            String token = getToken(context);
            if (token == null || token.isEmpty()) {
                return;
            }
            todos = fetchTodayTodos(token);
        }

        @Override
        public void onDestroy() {
            todos.clear();
        }

        @Override
        public int getCount() {
            return todos.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            if (position >= todos.size()) return null;

            RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_todo_item);
            TodoItem todo = todos.get(position);

            // 设置待办标题
            rv.setTextViewText(R.id.widget_item_title, todo.title);

            // 根据优先级设置颜色标记
            int color;
            switch (todo.priority) {
                case "urgent":
                    color = Color.parseColor("#EF4444"); // 红
                    break;
                case "high":
                    color = Color.parseColor("#F97316"); // 橙
                    break;
                case "low":
                    color = Color.parseColor("#22C55E"); // 绿
                    break;
                default: // medium
                    color = Color.parseColor("#EAB308"); // 金
                    break;
            }
            rv.setInt(R.id.widget_item_priority_dot, "setBackgroundColor", color);

            // 已完成的添加删除线
            if (todo.completed) {
                rv.setTextViewText(R.id.widget_item_title, "✓ " + todo.title);
                rv.setInt(R.id.widget_item_title, "setPaintFlags",
                        android.graphics.Paint.STRIKE_THRU_TEXT_FLAG | android.graphics.Paint.ANTI_ALIAS_FLAG);
                rv.setInt(R.id.widget_item_title, "setTextColor", Color.parseColor("#888888"));
            } else {
                rv.setInt(R.id.widget_item_title, "setPaintFlags",
                        android.graphics.Paint.ANTI_ALIAS_FLAG);
                rv.setInt(R.id.widget_item_title, "setTextColor", Color.parseColor("#E8E0D0"));
            }

            // 填充 Intent（点击列表项）
            Intent fillInIntent = new Intent();
            rv.setOnClickFillInIntent(R.id.widget_item_root, fillInIntent);

            return rv;
        }

        @Override
        public RemoteViews getLoadingView() {
            return new RemoteViews(context.getPackageName(), R.layout.widget_todo_item);
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
