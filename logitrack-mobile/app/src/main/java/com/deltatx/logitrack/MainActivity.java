package com.deltatx.logitrack;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

/**
 * MainActivity — Affiche LogiTrack en WebView plein écran
 * Gère la connectivité, le retry automatique et la reconfiguration
 */
public class MainActivity extends AppCompatActivity {

    private static final String TAG = "LogiTrack";

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar loadingBar;

    private String serverUrl;
    private boolean isPageLoaded = false;
    private boolean isShowingError = false;
    private String lastErrorMessage = "";
    private NsdHelper nsdHelper;
    private Handler retryHandler;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Plein écran immersif
        enableImmersiveMode();

        // Garder l'écran allumé (usage industriel)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        retryHandler = new Handler(Looper.getMainLooper());

        initViews();
        setupWebView();

        // Charger l'URL du serveur
        SharedPreferences prefs = getSharedPreferences("logitrack_config", MODE_PRIVATE);
        serverUrl = prefs.getString("server_url", null);

        if (serverUrl == null || serverUrl.isEmpty()) {
            goToConfig();
            return;
        }

        loadApp();

        // Swipe-to-refresh
        swipeRefresh.setOnRefreshListener(() -> {
            if (isShowingError) {
                loadApp();
            } else {
                webView.reload();
            }
        });
    }

    private void initViews() {
        webView = findViewById(R.id.webview);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        loadingBar = findViewById(R.id.loading_bar);

        swipeRefresh.setColorSchemeColors(
            getResources().getColor(R.color.primary_500, getTheme()),
            getResources().getColor(R.color.primary_700, getTheme())
        );
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();

        // Activer JavaScript (obligatoire pour React)
        settings.setJavaScriptEnabled(true);

        // Stockage local (localStorage, sessionStorage)
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        // Cache
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(true);

        // Responsive
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // Zoom
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);

        // Performance
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);

        // Autoriser le contenu mixte
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // User-Agent personnalisé pour que le frontend puisse détecter l'app Android
        String ua = settings.getUserAgentString();
        settings.setUserAgentString(ua + " LogiTrack-Android/2.0.0");

        // JavaScript bridge pour communication error page ↔ Android
        webView.addJavascriptInterface(new LogiTrackBridge(), "LogiTrackBridge");

        // WebViewClient pour gérer la navigation
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                // Ne pas afficher la loading bar si on charge la page d'erreur locale
                if (!url.startsWith("file:///android_asset/")) {
                    loadingBar.setVisibility(View.VISIBLE);
                }
                isPageLoaded = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                loadingBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);

                if (url.startsWith("file:///android_asset/error.html")) {
                    // Page d'erreur chargée → injecter les infos d'erreur et les checks
                    isShowingError = true;
                    updateErrorPageChecks();
                } else {
                    // Page LogiTrack chargée avec succès
                    isShowingError = false;
                    isPageLoaded = true;
                    injectMobileOptimizations();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    lastErrorMessage = error.getDescription().toString();
                    Log.w(TAG, "WebView error: " + lastErrorMessage);
                    showCustomErrorPage(lastErrorMessage);
                }
            }
        });

        // WebChromeClient pour les dialogues JS et la console
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("LogiTrack")
                    .setMessage(message)
                    .setPositiveButton("OK", (dialog, which) -> result.confirm())
                    .setCancelable(false)
                    .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("LogiTrack")
                    .setMessage(message)
                    .setPositiveButton("Oui", (dialog, which) -> result.confirm())
                    .setNegativeButton("Non", (dialog, which) -> result.cancel())
                    .setCancelable(false)
                    .show();
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[WebView] " + consoleMessage.message() +
                    " (ligne " + consoleMessage.lineNumber() + ")");
                return true;
            }
        });
    }

    /**
     * JavaScript bridge — permet à la page d'erreur HTML d'appeler des méthodes Android
     */
    private class LogiTrackBridge {
        @JavascriptInterface
        public void retry() {
            retryHandler.post(() -> loadApp());
        }

        @JavascriptInterface
        public void reconfigure() {
            retryHandler.post(() -> {
                SharedPreferences prefs = getSharedPreferences("logitrack_config", MODE_PRIVATE);
                prefs.edit().remove("server_url").apply();
                goToConfig();
            });
        }
    }

    /**
     * Affiche la page d'erreur personnalisée dans le WebView
     */
    private void showCustomErrorPage(String errorMessage) {
        isShowingError = true;
        loadingBar.setVisibility(View.GONE);
        swipeRefresh.setRefreshing(false);

        // Charger la page d'erreur depuis les assets
        webView.stopLoading();
        webView.loadUrl("file:///android_asset/error.html");

        // Après chargement, injecter les détails
        retryHandler.postDelayed(() -> updateErrorPageChecks(), 800);
    }

    /**
     * Met à jour les indicateurs de la page d'erreur (WiFi, serveur, réseau)
     */
    private void updateErrorPageChecks() {
        boolean hasWifi = isNetworkAvailable();
        String wifiStatus = hasWifi ? "ok" : "fail";
        String serverStatus = "fail";
        String networkStatus = hasWifi ? "pending" : "fail";

        String safeUrl = serverUrl != null ? serverUrl.replace("'", "\\'") : "";
        String safeError = lastErrorMessage != null ? lastErrorMessage.replace("'", "\\'") : "";

        String js = String.format(
            "setCheckStatus('check-wifi', '%s');" +
            "setCheckStatus('check-server', '%s');" +
            "setCheckStatus('check-network', '%s');" +
            "setErrorInfo('%s', '%s');",
            wifiStatus, serverStatus, networkStatus, safeError, safeUrl
        );

        webView.evaluateJavascript(js, null);
    }

    /**
     * Injecte des optimisations CSS pour l'affichage mobile
     */
    private void injectMobileOptimizations() {
        String css = "body { " +
            "-webkit-touch-callout: none; " +
            "-webkit-user-select: none; " +
            "user-select: none; " +
            "overscroll-behavior: none; " +
            "}";

        webView.evaluateJavascript(
            "(function() { " +
                "var style = document.createElement('style'); " +
                "style.innerHTML = '" + css + "'; " +
                "document.head.appendChild(style); " +
            "})()", null);
    }

    private void loadApp() {
        if (serverUrl != null) {
            isShowingError = false;
            loadingBar.setVisibility(View.VISIBLE);

            // Vérifier la connectivité WiFi d'abord
            if (!isNetworkAvailable()) {
                showCustomErrorPage("Pas de connexion réseau WiFi");
                return;
            }

            webView.loadUrl(serverUrl);
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;

        Network network = cm.getActiveNetwork();
        if (network == null) return false;

        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && (
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        );
    }

    private void goToConfig() {
        Intent intent = new Intent(this, ConfigActivity.class);
        startActivity(intent);
        finish();
    }

    private void enableImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveMode();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            // Demander confirmation avant de quitter
            new AlertDialog.Builder(this)
                .setTitle("Quitter LogiTrack ?")
                .setMessage("Voulez-vous quitter l'application ?")
                .setPositiveButton("Oui", (dialog, which) -> finish())
                .setNegativeButton("Non", null)
                .show();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        enableImmersiveMode();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webView != null) {
            webView.destroy();
        }
        if (nsdHelper != null) {
            nsdHelper.stopDiscovery();
        }
    }
}
