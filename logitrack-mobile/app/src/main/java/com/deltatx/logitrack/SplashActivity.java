package com.deltatx.logitrack;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;

/**
 * SplashActivity — Écran d'accueil avec logo LogiTrack
 * Vérifie si une config serveur existe, sinon redirige vers ConfigActivity
 */
public class SplashActivity extends AppCompatActivity {

    private static final int SPLASH_DURATION = 2000; // 2 secondes

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Splash screen API Android 12+
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        // Masquer la barre de navigation et status bar
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        // Animation fade-in sur le logo
        ImageView logo = findViewById(R.id.splash_logo);
        TextView title = findViewById(R.id.splash_title);
        TextView subtitle = findViewById(R.id.splash_subtitle);

        AlphaAnimation fadeIn = new AlphaAnimation(0.0f, 1.0f);
        fadeIn.setDuration(1000);
        fadeIn.setFillAfter(true);

        logo.startAnimation(fadeIn);

        AlphaAnimation fadeInText = new AlphaAnimation(0.0f, 1.0f);
        fadeInText.setDuration(1000);
        fadeInText.setStartOffset(500);
        fadeInText.setFillAfter(true);

        title.startAnimation(fadeInText);
        subtitle.startAnimation(fadeInText);

        // Rediriger après le splash
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            SharedPreferences prefs = getSharedPreferences("logitrack_config", MODE_PRIVATE);
            String serverUrl = prefs.getString("server_url", null);

            Intent intent;
            if (serverUrl != null && !serverUrl.isEmpty()) {
                // Config existante → aller directement à l'app
                intent = new Intent(SplashActivity.this, MainActivity.class);
            } else {
                // Première utilisation → configurer le serveur
                intent = new Intent(SplashActivity.this, ConfigActivity.class);
            }
            startActivity(intent);
            finish();
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        }, SPLASH_DURATION);
    }
}
