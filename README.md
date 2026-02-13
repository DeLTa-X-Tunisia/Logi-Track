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

*Inspiré de PipeTrack, adapté pour le flux de production API 5L*
