# LogiTrack Mobile — Android WebView APK

Application Android native qui charge LogiTrack en WebView plein écran, avec découverte automatique du serveur via mDNS.

## Fonctionnalités

- 🏭 **WebView plein écran** — Interface LogiTrack sans barre de navigateur
- 📡 **mDNS auto-discovery** — Trouve automatiquement le serveur sur le réseau local
- ⚙️ **Config manuelle** — Saisie IP/port en secours si mDNS ne fonctionne pas
- 🔔 **Notifications WebSocket** — Recoit les notifications en temps réel (via l'app web)
- 🎨 **Splash screen** — Logo LogiTrack animé au démarrage
- 📱 **Icône adaptative** — Logo usine/tube sur fond bleu
- 🔒 **Réseau local uniquement** — Config réseau sécurisée pour LAN

## Prérequis pour compiler

1. **Android Studio** (Hedgehog 2023.1.1 ou plus récent)
2. **JDK 17** (inclus dans Android Studio)
3. **Android SDK 34** (API 34)

## Comment compiler l'APK

### Via Android Studio (recommandé)

1. Ouvrir Android Studio
2. **File** → **Open** → Sélectionner le dossier `logitrack-mobile/`
3. Attendre la synchronisation Gradle
4. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
5. L'APK sera généré dans `app/build/outputs/apk/debug/app-debug.apk`

### Via ligne de commande

```bash
cd logitrack-mobile
./gradlew assembleDebug
```

L'APK se trouvera dans `app/build/outputs/apk/debug/`.

### APK Release (signée)

Pour une APK de production signée :

```bash
# Créer un keystore (une seule fois)
keytool -genkey -v -keystore logitrack.keystore -alias logitrack -keyalg RSA -keysize 2048 -validity 10000

# Compiler en release
./gradlew assembleRelease
```

## Installation sur un appareil Android

### Via USB
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Via partage fichier
1. Copier l'APK sur le téléphone (USB, partage réseau, etc.)
2. Ouvrir le fichier APK sur le téléphone
3. Autoriser l'installation depuis cette source si demandé
4. Installer

## Configuration réseau

### Côté serveur (backend)
Le serveur LogiTrack annonce automatiquement son service via mDNS (Bonjour/Zeroconf).
Le package `bonjour-service` est déjà intégré dans le backend.

### Côté Android
L'app utilise `NsdManager` (Network Service Discovery, natif Android) pour détecter le service `_logitrack._tcp` sur le réseau local.

### Si mDNS ne fonctionne pas
1. L'utilisateur peut saisir manuellement l'IP du serveur
2. L'IP est affichée dans la console de démarrage du backend
3. Le port par défaut est `3002`

## Architecture

```
logitrack-mobile/
├── app/
│   ├── build.gradle                    # Dépendances & config Android
│   ├── src/main/
│   │   ├── AndroidManifest.xml         # Permissions & activités
│   │   ├── java/.../
│   │   │   ├── SplashActivity.java     # Écran d'accueil animé
│   │   │   ├── ConfigActivity.java     # Config serveur (auto + manuelle)
│   │   │   ├── MainActivity.java       # WebView plein écran
│   │   │   └── NsdHelper.java          # Découverte mDNS
│   │   └── res/
│   │       ├── layout/                 # Layouts XML
│   │       ├── drawable/               # Icônes, boutons, fonds
│   │       ├── mipmap-anydpi-v26/      # Icône adaptative
│   │       ├── values/                 # Couleurs, strings, thèmes
│   │       └── xml/                    # Config sécurité réseau
├── build.gradle                        # Config Gradle racine
├── settings.gradle                     # Modules
└── README.md                           # Ce fichier
```

## Compatibilité

- **Android minimum** : API 24 (Android 7.0 Nougat)
- **Android cible** : API 34 (Android 14)
- **Testé sur** : Tablettes et smartphones Android

## Auteur

DeLTa-X Tunisia — Azizi Mounir
