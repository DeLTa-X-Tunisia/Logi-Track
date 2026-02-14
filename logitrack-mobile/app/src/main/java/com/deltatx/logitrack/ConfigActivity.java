package com.deltatx.logitrack;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * ConfigActivity — Configuration initiale du serveur LogiTrack
 * 1. Tente la découverte automatique via mDNS
 * 2. Propose la configuration manuelle en secours
 */
public class ConfigActivity extends AppCompatActivity {

    private static final int MDNS_TIMEOUT = 8000; // 8 secondes de recherche

    private NsdHelper nsdHelper;

    // UI components
    private LinearLayout discoverySection;
    private LinearLayout manualSection;
    private ProgressBar progressDiscovery;
    private TextView tvDiscoveryStatus;
    private TextView tvFoundServer;
    private Button btnUseFound;
    private Button btnRetry;
    private Button btnManual;
    private EditText etServerIp;
    private EditText etServerPort;
    private Button btnConnect;
    private Button btnBackToAuto;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_config);

        initViews();
        nsdHelper = new NsdHelper(this);

        // Démarrer la découverte automatique
        startDiscovery();

        btnManual.setOnClickListener(v -> showManualConfig());
        btnBackToAuto.setOnClickListener(v -> {
            manualSection.setVisibility(View.GONE);
            discoverySection.setVisibility(View.VISIBLE);
            startDiscovery();
        });

        btnRetry.setOnClickListener(v -> startDiscovery());
        btnUseFound.setOnClickListener(v -> {
            String url = (String) btnUseFound.getTag();
            if (url != null) {
                testAndSaveServer(url);
            }
        });

        btnConnect.setOnClickListener(v -> {
            String ip = etServerIp.getText().toString().trim();
            String portStr = etServerPort.getText().toString().trim();

            if (ip.isEmpty()) {
                etServerIp.setError("Adresse IP requise");
                return;
            }

            int port = 3002;
            if (!portStr.isEmpty()) {
                try {
                    port = Integer.parseInt(portStr);
                } catch (NumberFormatException e) {
                    etServerPort.setError("Port invalide");
                    return;
                }
            }

            String url = "http://" + ip + ":" + port;
            testAndSaveServer(url);
        });
    }

    private void initViews() {
        discoverySection = findViewById(R.id.discovery_section);
        manualSection = findViewById(R.id.manual_section);
        progressDiscovery = findViewById(R.id.progress_discovery);
        tvDiscoveryStatus = findViewById(R.id.tv_discovery_status);
        tvFoundServer = findViewById(R.id.tv_found_server);
        btnUseFound = findViewById(R.id.btn_use_found);
        btnRetry = findViewById(R.id.btn_retry);
        btnManual = findViewById(R.id.btn_manual);
        etServerIp = findViewById(R.id.et_server_ip);
        etServerPort = findViewById(R.id.et_server_port);
        btnConnect = findViewById(R.id.btn_connect);
        btnBackToAuto = findViewById(R.id.btn_back_to_auto);
    }

    private void startDiscovery() {
        progressDiscovery.setVisibility(View.VISIBLE);
        tvDiscoveryStatus.setText("Recherche du serveur LogiTrack sur le réseau...");
        tvFoundServer.setVisibility(View.GONE);
        btnUseFound.setVisibility(View.GONE);
        btnRetry.setVisibility(View.GONE);

        nsdHelper.discoverServer(new NsdHelper.DiscoveryCallback() {
            @Override
            public void onServerFound(String host, int port) {
                progressDiscovery.setVisibility(View.GONE);
                tvDiscoveryStatus.setText("✅ Serveur trouvé !");
                tvFoundServer.setVisibility(View.VISIBLE);
                tvFoundServer.setText(host + ":" + port);

                String url = "http://" + host + ":" + port;
                btnUseFound.setTag(url);
                btnUseFound.setVisibility(View.VISIBLE);
                btnRetry.setVisibility(View.GONE);
            }

            @Override
            public void onDiscoveryFailed() {
                progressDiscovery.setVisibility(View.GONE);
                tvDiscoveryStatus.setText("❌ Serveur non trouvé automatiquement");
                tvFoundServer.setVisibility(View.GONE);
                btnUseFound.setVisibility(View.GONE);
                btnRetry.setVisibility(View.VISIBLE);
            }
        }, MDNS_TIMEOUT);
    }

    private void showManualConfig() {
        nsdHelper.stopDiscovery();
        discoverySection.setVisibility(View.GONE);
        manualSection.setVisibility(View.VISIBLE);

        // Pré-remplir avec les dernières valeurs connues
        SharedPreferences prefs = getSharedPreferences("logitrack_config", MODE_PRIVATE);
        String lastIp = prefs.getString("last_ip", "");
        int lastPort = prefs.getInt("last_port", 3002);
        if (!lastIp.isEmpty()) {
            etServerIp.setText(lastIp);
        }
        etServerPort.setText(String.valueOf(lastPort));
    }

    /**
     * Teste la connexion au serveur puis sauvegarde si OK
     */
    private void testAndSaveServer(String baseUrl) {
        btnConnect.setEnabled(false);
        btnUseFound.setEnabled(false);

        new Thread(() -> {
            try {
                URL url = new URL(baseUrl + "/api/health");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);

                int code = conn.getResponseCode();
                if (code == 200) {
                    BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream())
                    );
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    String response = sb.toString();
                    if (response.contains("LogiTrack") || response.contains("Logi-Track") || response.contains("OK")) {
                        // Serveur vérifié !
                        runOnUiThread(() -> {
                            saveServerConfig(baseUrl);
                            Toast.makeText(this, "✅ Connecté à LogiTrack", Toast.LENGTH_SHORT).show();
                            navigateToMain();
                        });
                        return;
                    }
                }
                conn.disconnect();

                runOnUiThread(() -> {
                    Toast.makeText(this, "❌ Le serveur n'est pas un serveur LogiTrack", Toast.LENGTH_LONG).show();
                    btnConnect.setEnabled(true);
                    btnUseFound.setEnabled(true);
                });

            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this, "❌ Impossible de joindre le serveur:\n" + e.getMessage(), Toast.LENGTH_LONG).show();
                    btnConnect.setEnabled(true);
                    btnUseFound.setEnabled(true);
                });
            }
        }).start();
    }

    private void saveServerConfig(String serverUrl) {
        SharedPreferences prefs = getSharedPreferences("logitrack_config", MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("server_url", serverUrl);

        // Extraire IP et port pour le mode manuel
        try {
            URL url = new URL(serverUrl);
            editor.putString("last_ip", url.getHost());
            editor.putInt("last_port", url.getPort());
        } catch (Exception ignored) {}

        editor.apply();
    }

    private void navigateToMain() {
        Intent intent = new Intent(this, MainActivity.class);
        startActivity(intent);
        finish();
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (nsdHelper != null) {
            nsdHelper.stopDiscovery();
        }
    }
}
