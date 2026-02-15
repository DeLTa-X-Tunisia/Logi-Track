# LogiTrack v2.1.0

**ERP de suivi de production et certification API 5L des tubes spirale**

<img width="200" height="200" alt="logo" src="https://github.com/user-attachments/assets/b51077ec-a29c-4b6d-b0a1-609d067ab09a" />

## 🎯 Objectif

LogiTrack est une application web ERP complète de gestion de production pour les tubes spirale, avec traçabilité complète du processus de fabrication (12 étapes), génération de rapports PDF et certificats conformes aux standards **API 5L** et **Hydraulique**.

## 🏭 Pipeline de Production — 12 Étapes API 5L

| # | Étape | Description |
|---|-------|-------------|
| 1 | **Déroulage** | Déroulage de la bobine d'acier |
| 2 | **Redressage** | Redressage de la bande |
| 3 | **Formage** | Formage du tube spirale |
| 4 | **Soudage INT** | Soudage intérieur de la soudure spirale |
| 5 | **Soudage EXT** | Soudage extérieur de la soudure spirale |
| 6 | **X-Ray** | Radiographie des soudures (contrôle non destructif) |
| 7 | **Chanfreinage** | Usinage des extrémités du tube |
| 8 | **Test Hydraulique** | Épreuve hydrostatique selon API 5L |
| 9 | **Contrôle Visuel** | Inspection visuelle du tube |
| 10 | **Contrôle Dimensionnel** | Vérification des dimensions (longueur, diamètre, épaisseur) |
| 11 | **Pesage** | Pesage du tube fini |
| 12 | **Marquage** | Marquage réglementaire sur le tube |

## ✨ Fonctionnalités Principales

### Gestion de Production
- **Coulées** : workflow complet de gestion des coulées d'acier avec métadonnées (grade, nuance, fournisseur)
- **Bobines** : gestion des bobines avec photos, dimensions, fournisseurs, et rapports PDF
- **Tubes** : suivi individuel de chaque tube à travers les 12 étapes de production
- **Paramètres de Production** : diamètre du tube (8" à 82"), numérotation automatique, groupement par diamètre
- **Paramètres de Soudage** : configuration des paramètres de soudage par coulée

### Rapports PDF
- **Rapport Tube** : rapport complet multi-pages avec en-tête logos, paramètres de soudage, détail des 12 étapes, photos d'étapes, analyse des temps et délais inter-étapes, et encadré Décision Finale premium thématisé
- **Rapport Bobine** : fiche détaillée avec photos et métadonnées
- **Certificat API 5L** : certificat de conformité fond blanc, accents or/doré, double cadre, ornements d'angle, sceau, zones de signature
- **Certificat Hydraulique** : certificat de conformité fond blanc, accents bleu, même design premium

### Décision Finale
- **Certifié API 5L** : tube conforme au standard API 5L (thème or/marine)
- **Certifié Hydraulique** : tube conforme pour usage hydraulique (thème cyan/bleu)
- **Déclassé** : tube non conforme (thème orange/brique)

### Contrôle Qualité
- **Checklists** : début de quart, hebdomadaire, mensuelle
- **Checklist Machine** : vérification de l'état des machines
- **Checklist Périodique** : récurrence configurable avec suivi de validité
- **Photos d'étapes** : prise de photos à chaque étape avec stockage serveur

### Dashboard & Analytics
- **Dashboard** : vue d'ensemble de la production (tubes en cours, terminés, statistiques) — requêtes parallélisées
- **Analyse des temps** : temps passé par étape, délais inter-étapes, identification des goulots d'étranglement
- **Audit trail** : journal complet des actions (login, création, validation, décision)

### Sécurité & Performance (v2.1.0)
- **Helmet** : headers HTTP sécurisés
- **Rate limiting** : protection contre les abus (20 auth/15min, 300 API/15min)
- **CORS restrictif** : origines configurables via variable d'environnement
- **Uploads protégés** : authentification requise pour accéder aux fichiers
- **JWT encapsulé** : secret non exporté, `signToken()` centralisé
- **13 index DB** : performances optimisées sur les requêtes critiques
- **Fix N+1** : requêtes batch `IN()` (tubes, paramètres, checklists périodiques)
- **Pagination API** : support `?page=&limit=` avec metadata
- **Health check** : vérifie la DB, retourne version/uptime/status
- **Code splitting** : React.lazy + Suspense (13 chunks séparés)
- **Error Boundary** : capture des crashs composants avec UI de récupération

### Gestion des Utilisateurs
- **Admin** : accès complet avec gestion des comptes
- **Opérateurs** : connexion par code à 6 chiffres, accès limité par rôle
- **Direction** : accès en lecture aux rapports et dashboard

### Internationalisation (i18n)
- 🇫🇷 Français
- 🇬🇧 English
- 🇮🇹 Italiano
- 🇸🇦 العربية (support RTL complet)

### PWA & Mobile
- **Progressive Web App** : installation sur mobile/desktop
- **Application Android** : WebView native avec découverte mDNS
- **Responsive** : interface adaptée à tous les écrans
- **Mode fullscreen** : sans barre de navigation sur mobile

## 🛠️ Technologies

### Backend
- **Node.js** avec Express.js
- **MySQL 8.0** (Laragon)
- **Socket.io** pour les notifications temps réel
- **JWT** pour l'authentification
- **Helmet** + **express-rate-limit** pour la sécurité
- **PDFKit** pour la génération de rapports et certificats PDF
- **Multer** pour l'upload de photos
- **HTTPS** (port 3443) + HTTP (port 3002)
- **mDNS** (bonjour-service) pour la découverte réseau

### Frontend
- **React 18** avec Vite 5.4
- **Tailwind CSS** pour le design
- **Lucide React** pour les icônes
- **Socket.io-client** pour le temps réel
- **React.lazy** + **Suspense** pour le code splitting
- **ErrorBoundary** pour la résilience

### Application Desktop
- **LogiTrack Launcher** v2.1.0 : application C# WinForms (.NET 8)
  - 3 services : MySQL + Backend + Frontend
  - Health check enrichi (version, DB, uptime)
  - System tray avec menu contextuel
  - Détection automatique MySQL

### Application Mobile
- **LogiTrack Android** : WebView Java avec découverte mDNS (NsdManager)
- APK téléchargeable depuis l'application web

## 🚀 Installation

### Prérequis
- Node.js 18+
- MySQL 8.0 (Laragon recommandé)
- .NET 8 SDK (pour le Launcher)

### Backend
```bash
cd backend
npm install
npm run init-db   # Initialiser la base de données
npm run dev       # Démarrer le serveur (HTTP:3002 + HTTPS:3443)
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # Démarrer le frontend (port 5173)
npm run build     # Build de production
```

### Launcher (Desktop)
```bash
cd LogiTrack-Launcher
dotnet build
dotnet run        # Ou: dotnet publish -c Release -o publish
```

## 🔐 Connexion

### Admin
- **Username** : `admin`
- **Password** : `admin123`

### Opérateurs (code à 6 chiffres)
Chaque opérateur se connecte avec son code personnel à 6 chiffres.

## 📁 Structure du Projet

```
LogiTrack/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration (DB, upload)
│   │   ├── database/        # Scripts d'initialisation & migrations
│   │   ├── middleware/      # Auth JWT (authenticateToken, signToken)
│   │   ├── routes/          # 15 routes API (auth, tubes, bobines, coulees, etapes,
│   │   │                    #   checklist, checklistPeriodique, comptes, dashboard,
│   │   │                    #   parametres, projetParametres, langues, fournisseurs,
│   │   │                    #   notifications, audit)
│   │   ├── utils/           # Utilitaires (audit trail)
│   │   └── server.js        # Point d'entrée (HTTP + HTTPS + Socket.io + mDNS)
│   ├── uploads/             # Photos (bobines, coulees)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout, Toast, ConfirmModal, ProtectedRoute,
│   │   │                    # ErrorBoundary, ChecklistAlert
│   │   ├── context/         # AuthContext, I18nContext
│   │   ├── pages/           # 14 pages (Dashboard, Bobines, Coulees, Tubes,
│   │   │                    #   Checklists, ChecklistPeriodique, HistoriqueChecklist,
│   │   │                    #   ChecklistMachine, ChecklistGenerale, Login,
│   │   │                    #   GestionComptes, ParametresProduction,
│   │   │                    #   ParametresProjet, ParametresLangue)
│   │   ├── services/        # API & Socket
│   │   └── App.jsx          # Point d'entrée React (lazy loading)
│   ├── public/              # Assets statiques, manifest PWA, SW
│   └── package.json
├── LogiTrack-Launcher/      # Launcher Desktop C# .NET 8
├── logitrack-mobile/        # App Android WebView (Java, Gradle)
├── AndroidLogitrack/        # APK release
├── assets/                  # Icônes et sons
├── CHANGELOG.md
└── README.md
```

## 🔮 Fonctionnalités Futures

- [ ] Cache serveur (traductions, grades acier, stats dashboard avec TTL)
- [ ] Thumbnails/redimensionnement images pour les listes
- [ ] State management global (Zustand/Redux)
- [ ] Export Excel/CSV (exceljs)
- [ ] Opérations batch (marquage/export en masse)
- [ ] Recherche globale cross-entités
- [ ] Logging structuré (Winston/Pino)
- [ ] Docker/PM2 configuration
- [ ] CI/CD pipeline
- [ ] Tests automatisés

## 👨‍💻 Auteur

**Coded with ❤️ by Azizi Mounir – Février 2026**

---

Voir [CHANGELOG.md](CHANGELOG.md) pour l'historique détaillé des versions.

---

*Système ERP de production API 5L — LogiTrack v2.1.0*
