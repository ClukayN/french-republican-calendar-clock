package com.clukayn.republicancalendar;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/**
 * 法国共和历 —— Android 外壳。
 *
 * 业务逻辑全部在 assets/www 里的 HTML/CSS/JS；这里只负责：
 *   1. 用 WebView 承载页面
 *   2. 把 https://appassets.androidplatform.net/ 映射到 assets/www（有真实 origin，localStorage 可用）
 *   3. 处理返回键与系统栏配色
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE_URL = "https://" + HOST + "/";

    private WebView web;

    private static final String BACK_JS =
        "(function(){try{return (window.RCApp && RCApp.handleBack) ? RCApp.handleBack() : false;}catch(e){return false;}})()";

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false);
        }

        web.setBackgroundColor(Color.TRANSPARENT);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setWebViewClient(new AssetClient());
        web.addJavascriptInterface(new Bridge(), "AndroidHost");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i("RCWEB", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // 让网页铺到状态栏/导航栏下面，避免纸纹与纯色之间出现接缝
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }

        setContentView(web);

        if (state == null) {
            web.loadUrl(BASE_URL + "index.html");
        } else {
            web.restoreState(state);
        }

        applyBarColors();

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    new android.window.OnBackInvokedCallback() {
                        @Override
                        public void onBackInvoked() {
                            Log.i("RCWEB", "onBackInvoked");
                            handleBack();
                        }
                    });
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    private void handleBack() {
        if (web == null) {
            finish();
            return;
        }
        // 不能用 lambda：编译时只挂 android.jar，没有 core-lambda-stubs
        web.evaluateJavascript(BACK_JS, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                Log.i("RCWEB", "back js -> " + value);
                if (!"true".equals(value)) {
                    if (web.canGoBack()) web.goBack();
                    else finish();
                }
            }
        });
    }

    @Override
    public void onBackPressed() {
        Log.i("RCWEB", "onBackPressed");
        handleBack();
    }

    @Override
    public void onConfigurationChanged(Configuration cfg) {
        super.onConfigurationChanged(cfg);
        applyBarColors();
    }

    /** 网页里的主题选择会通过 Bridge.setTheme 覆盖系统 uiMode。 */
    private Boolean forcedDark = null;

    private boolean isOnUiThread() {
        return Looper.myLooper() == Looper.getMainLooper();
    }

    private boolean isDark() {
        if (forcedDark != null) return forcedDark.booleanValue();
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private void applyBarColors() {
        final boolean dark = isDark();
        if (!isOnUiThread()) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { applyBarColors(); }
            });
            return;
        }
        Window w = getWindow();
        int paper = dark ? Color.parseColor("#12100c") : Color.parseColor("#efe4cd");
        w.setBackgroundDrawable(new ColorDrawable(paper));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
        }
        View decor = w.getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = decor.getWindowInsetsController();
            if (c != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(dark ? 0 : mask, mask);
            }
        } else {
            int flags = decor.getSystemUiVisibility();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = dark ? (flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)
                             : (flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags = dark ? (flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
                             : (flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            }
            decor.setSystemUiVisibility(flags);
        }
    }

    /** 把虚拟主机映射到 assets/www。 */
    private class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            String url = req.getUrl() == null ? "" : req.getUrl().toString();
            if (!url.startsWith(BASE_URL)) return null;
            String path = url.substring(BASE_URL.length());
            int cut = path.indexOf('#');
            if (cut >= 0) path = path.substring(0, cut);
            cut = path.indexOf('?');
            if (cut >= 0) path = path.substring(0, cut);
            if (path.length() == 0) path = "index.html";
            try {
                InputStream in = getAssets().open("www/" + path);
                WebResourceResponse resp = new WebResourceResponse(mimeOf(path), "utf-8", in);
                resp.setStatusCodeAndReasonPhrase(200, "OK");
                return resp;
            } catch (IOException e) {
                Log.e("RCWEB", "asset missing: " + path + " -> " + e);
                return null;
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            Log.i("RCWEB", "page finished: " + url);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, android.webkit.WebResourceError err) {
            Log.e("RCWEB", "error " + err.getErrorCode() + " " + req.getUrl());
        }

        private String mimeOf(String path) {
            if (path.endsWith(".html")) return "text/html";
            if (path.endsWith(".css")) return "text/css";
            if (path.endsWith(".js")) return "application/javascript";
            if (path.endsWith(".json")) return "application/json";
            if (path.endsWith(".svg")) return "image/svg+xml";
            if (path.endsWith(".png")) return "image/png";
            if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
            if (path.endsWith(".woff2")) return "font/woff2";
            if (path.endsWith(".woff")) return "font/woff";
            return "application/octet-stream";
        }
    }

    /** 预留的宿主桥：目前只暴露版本信息。 */
    private class Bridge {
        @JavascriptInterface
        public int statusBarHeight() {
            int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
            int px = id > 0 ? getResources().getDimensionPixelSize(id) : 0;
            return Math.round(px / getResources().getDisplayMetrics().density);
        }

        @JavascriptInterface
        public int navBarHeight() {
            int id = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
            int px = id > 0 ? getResources().getDimensionPixelSize(id) : 0;
            return Math.round(px / getResources().getDisplayMetrics().density);
        }

        @JavascriptInterface
        public boolean edgeToEdge() {
            return true;
        }

        @JavascriptInterface
        public void setTheme(String t) {
            forcedDark = Boolean.valueOf("dark".equals(t));
            applyBarColors();
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        @JavascriptInterface
        public int sdkInt() {
            return Build.VERSION.SDK_INT;
        }
    }
}
