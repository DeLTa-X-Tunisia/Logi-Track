package com.deltatx.logitrack;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * NsdHelper — Découverte automatique du serveur LogiTrack via mDNS (DNS-SD)
 * Utilise android.net.nsd.NsdManager pour trouver le service _logitrack._tcp
 */
public class NsdHelper {

    private static final String TAG = "NsdHelper";
    private static final String SERVICE_TYPE = "_logitrack._tcp.";

    private NsdManager nsdManager;
    private NsdManager.DiscoveryListener discoveryListener;
    private boolean isDiscovering = false;
    private DiscoveryCallback callback;
    private Handler mainHandler;
    private Handler timeoutHandler;
    private Runnable timeoutRunnable;

    public interface DiscoveryCallback {
        void onServerFound(String host, int port);
        void onDiscoveryFailed();
    }

    public NsdHelper(Context context) {
        nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        mainHandler = new Handler(Looper.getMainLooper());
        timeoutHandler = new Handler(Looper.getMainLooper());
    }

    /**
     * Lancer la découverte mDNS avec un timeout
     */
    public void discoverServer(DiscoveryCallback callback, int timeoutMs) {
        this.callback = callback;

        // Timeout de sécurité
        timeoutRunnable = () -> {
            Log.w(TAG, "Timeout de découverte mDNS (" + timeoutMs + "ms)");
            stopDiscovery();
            if (this.callback != null) {
                this.callback.onDiscoveryFailed();
            }
        };
        timeoutHandler.postDelayed(timeoutRunnable, timeoutMs);

        initializeDiscoveryListener();

        try {
            nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
            isDiscovering = true;
            Log.d(TAG, "Recherche mDNS lancée pour " + SERVICE_TYPE);
        } catch (Exception e) {
            Log.e(TAG, "Erreur au lancement de la découverte mDNS", e);
            cancelTimeout();
            if (callback != null) {
                mainHandler.post(callback::onDiscoveryFailed);
            }
        }
    }

    private void initializeDiscoveryListener() {
        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override
            public void onDiscoveryStarted(String serviceType) {
                Log.d(TAG, "Découverte mDNS démarrée: " + serviceType);
            }

            @Override
            public void onServiceFound(NsdServiceInfo serviceInfo) {
                Log.d(TAG, "Service trouvé: " + serviceInfo.getServiceName());

                if (serviceInfo.getServiceName().contains("LogiTrack")) {
                    // Résoudre pour obtenir l'IP et le port
                    nsdManager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                        @Override
                        public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {
                            Log.e(TAG, "Échec résolution: erreur " + errorCode);
                        }

                        @Override
                        public void onServiceResolved(NsdServiceInfo resolvedInfo) {
                            String host = resolvedInfo.getHost().getHostAddress();
                            int port = resolvedInfo.getPort();
                            Log.i(TAG, "Serveur LogiTrack trouvé: " + host + ":" + port);

                            cancelTimeout();
                            stopDiscovery();

                            mainHandler.post(() -> {
                                if (callback != null) {
                                    callback.onServerFound(host, port);
                                }
                            });
                        }
                    });
                }
            }

            @Override
            public void onServiceLost(NsdServiceInfo serviceInfo) {
                Log.d(TAG, "Service perdu: " + serviceInfo.getServiceName());
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
                Log.d(TAG, "Découverte mDNS arrêtée");
                isDiscovering = false;
            }

            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                Log.e(TAG, "Échec démarrage découverte: erreur " + errorCode);
                isDiscovering = false;
                cancelTimeout();
                mainHandler.post(() -> {
                    if (callback != null) {
                        callback.onDiscoveryFailed();
                    }
                });
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
                Log.e(TAG, "Échec arrêt découverte: erreur " + errorCode);
                isDiscovering = false;
            }
        };
    }

    private void cancelTimeout() {
        if (timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
            timeoutRunnable = null;
        }
    }

    public void stopDiscovery() {
        cancelTimeout();
        if (isDiscovering && discoveryListener != null) {
            try {
                nsdManager.stopServiceDiscovery(discoveryListener);
            } catch (Exception e) {
                Log.w(TAG, "Erreur arrêt découverte (peut être déjà arrêtée)", e);
            }
            isDiscovering = false;
        }
    }
}
