# Logi-Track

**Suivi de production et certification API 5L des tubes spirale**

![Logi-Track](frontend/public/logo.png)

## 🎯 Objectif

Logi-Track est une application web de gestion de production pour les tubes spirale, avec traçabilité complète et génération de rapports conformes aux standards **API 5L**.

## 🏭 Étapes de Production

1. **Formage** - Formage du tube spirale à partir de la bobine
2. **Contrôle Visuel** - Inspection visuelle du tube formé
3. **Soudage** - Soudage de la soudure spirale (intérieur et extérieur)
4. **X-Ray** - Radiographie des soudures selon API 5L
5. **Chanfreinage** - Usinage des extrémités du tube
6. **Test Hydraulique** - Épreuve hydrostatique selon API 5L
7. **Contrôle Final** - Vérification finale et marquage
8. **Certification** - Émission du certificat API 5L

## 🛠️ Technologies

### Backend
- **Node.js** avec Express.js
- **MySQL** (Laragon)
- **Socket.io** pour les notifications temps réel
- **JWT** pour l'authentification
- Préparé pour **WebRTC** (communication vidéo future)

### Frontend
- **React.js** avec Vite
- **Tailwind CSS** pour le design
- **Lucide Icons** pour les icônes
- **Socket.io-client** pour les notifications temps réel

## 🚀 Installation

### Prérequis
- Node.js 18+
- MySQL (Laragon recommandé)

### Backend
```bash
cd backend
npm install
npm run init-db   # Initialiser la base de données
npm run dev       # Démarrer le serveur (port 3002)
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # Démarrer le frontend (port 5173)
```

## 🔐 Connexion

### Admin
- **Username**: `admin`
- **Password**: `admin123`

### Opérateurs (code à 6 chiffres)
- `123456` - Jean Martin (Formage)
- `234567` - Pierre Dubois (Soudage)
- `345678` - Marie Bernard (Contrôle)
- `456789` - Paul Petit (X-Ray)
- `567890` - Sophie Robert (Hydraulique)

## 📁 Structure du Projet

```
LogiTrack/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration (DB)
│   │   ├── database/       # Scripts d'initialisation
│   │   ├── middleware/     # Auth JWT
│   │   ├── routes/         # Routes API
│   │   └── server.js       # Point d'entrée
│   ├── .env                # Variables d'environnement
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Composants React
│   │   ├── context/        # Context (Auth)
│   │   ├── pages/          # Pages de l'application
│   │   ├── services/       # API & Socket
│   │   └── App.jsx         # Point d'entrée React
│   ├── index.html
│   └── package.json
├── logo.png
└── README.md
```

## 🔮 Fonctionnalités Futures

- [ ] Intégration WebRTC pour suivi vidéo temps réel
- [ ] Alertes push avec SignalR/Socket.io
- [ ] Dashboard analytics avancé
- [ ] Export PDF des certificats API 5L
- [ ] Application mobile (React Native)

## 👨‍💻 Auteur

**Coded with ❤️ by Azizi Mounir – Février 2026**

---

## 📋 Version & Changelog

### v1.2.0 — 13 Février 2026
- **Coulées** : ouverture directe du modal détail après création d'une coulée
- **Coulées** : affichage "Coulée démarrée le [date/heure]" dans l'étape 1 pour traçabilité du temps perdu
- **Sidebar** : titre simplifié "PROJET – Nom du Client"

### v1.1.0 — 13 Février 2026
- **Sidebar** : restructuration — section "Projet" (Dashboard, Checklists) + section "Étapes de Production" (Bobines, Paramètres, Coulées, etc.)
- **Paramètres de Production** : sélection du diamètre du tube (8" à 82") avec numérotation `PAR-{diamètre}-{seq}` et groupement par diamètre
- **Fournisseurs** : gestion complète dans le formulaire Bobines — liste déroulante, ajout, suppression avec confirmation professionnelle

### v1.0.0 — 13 Février 2026
- **Initial release** : LogiTrack ERP complet
- **Modules** : Dashboard, Bobines, Coulées (workflow 12 étapes), Tubes, Checklists (début de quart, hebdomadaire, mensuelle), Checklist Machine, Paramètres de Production
- **Système i18n** : 4 langues (FR, EN, IT, AR) avec support RTL
- **Authentification** : JWT, admin + opérateurs par code 6 chiffres
- **PDF** : génération de rapports bobines
- **Temps réel** : notifications Socket.io
- **Paramètres du Projet** : logos, infos client, configuration globale
- **LogiTrack-Launcher** : application bureau C# WinForms (.NET 8)

---

*Inspiré de PipeTrack, adapté pour le flux de production API 5L*
