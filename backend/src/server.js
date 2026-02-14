require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');

// Import des routes
const authRoutes = require('./routes/auth');
const tubesRoutes = require('./routes/tubes');
const etapesRoutes = require('./routes/etapes');
const comptesRoutes = require('./routes/comptes');
const bobinesRoutes = require('./routes/bobines');
const couleesRoutes = require('./routes/coulees');
const checklistRoutes = require('./routes/checklist');
const checklistPeriodiqueRoutes = require('./routes/checklistPeriodique');
const dashboardRoutes = require('./routes/dashboard');
const parametresRoutes = require('./routes/parametres');
const projetParametresRoutes = require('./routes/projetParametres');
const languesRoutes = require('./routes/langues');
const fournisseursRoutes = require('./routes/fournisseurs');
const notificationsRoutes = require('./routes/notifications');

// Import du middleware d'authentification
const { authenticateToken } = require('./middleware/auth');

const path = require('path');
const PORT = parseInt(process.env.PORT || '3002', 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);

const app = express();

// HTTPS: charger les certificats SSL s'ils existent
const sslDir = path.join(__dirname, '..', 'ssl');
const hasSSL = fs.existsSync(path.join(sslDir, 'server.key')) && fs.existsSync(path.join(sslDir, 'server.crt'));

// HTTP principal (port 3002) — fonctionne comme avant
const server = http.createServer(app);

// HTTPS additionnel (port 3443) — pour PWA Android
let httpsServer;
if (hasSSL) {
  const sslOptions = {
    key: fs.readFileSync(path.join(sslDir, 'server.key')),
    cert: fs.readFileSync(path.join(sslDir, 'server.crt'))
  };
  httpsServer = https.createServer(sslOptions, app);
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`🔒 HTTPS disponible sur :${HTTPS_PORT}`);
  });
}

// Configuration Socket.io pour notifications temps réel (préparation future)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Rendre io accessible aux routes via req.app.get('io')
app.set('io', io);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers uploadés (photos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Route de santé (publique)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Logi-Track API is running - Certification API 5L',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Routes d'authentification (publiques)
app.use('/api/auth', authRoutes);

// Routes API protégées par authentification
app.use('/api/tubes', authenticateToken, tubesRoutes);
app.use('/api/etapes', authenticateToken, etapesRoutes);
app.use('/api/comptes', comptesRoutes); // Gestion des comptes (auth interne)
app.use('/api/bobines', bobinesRoutes); // Gestion des bobines
app.use('/api/parametres', parametresRoutes); // Paramètres de production
app.use('/api/projet-parametres', projetParametresRoutes); // Paramètres du projet
app.use('/api/langues', languesRoutes); // Gestion des langues & traductions
app.use('/api/coulees', couleesRoutes); // Gestion des coulées (Heats)
app.use('/api/checklist', authenticateToken, checklistRoutes); // Checklist Machine
app.use('/api/checklist-periodique', checklistPeriodiqueRoutes); // Checklists périodiques
app.use('/api/dashboard', authenticateToken, dashboardRoutes); // Dashboard stats
app.use('/api/fournisseurs', fournisseursRoutes); // Gestion des fournisseurs
app.use('/api/notifications', authenticateToken, notificationsRoutes); // Notifications

// Socket.io - Gestion des connexions temps réel
io.on('connection', (socket) => {
  console.log(`🔌 Client connecté: ${socket.id}`);
  
  // Rejoindre une room par étape de production
  socket.on('join_etape', (etapeCode) => {
    socket.join(`etape_${etapeCode}`);
    console.log(`📍 ${socket.id} a rejoint la room etape_${etapeCode}`);
  });
  
  // Quitter une room
  socket.on('leave_etape', (etapeCode) => {
    socket.leave(`etape_${etapeCode}`);
    console.log(`🚪 ${socket.id} a quitté la room etape_${etapeCode}`);
  });
  
  // Notification de mise à jour d'un tube
  socket.on('tube_update', (data) => {
    // Émettre à tous les clients de l'étape concernée
    io.to(`etape_${data.etapeCode}`).emit('tube_updated', data);
    console.log(`📢 Notification tube mis à jour: ${data.tubeId}`);
  });
  
  // Alerte temps réel (préparation pour alertes critiques)
  socket.on('alert', (data) => {
    io.emit('new_alert', data);
    console.log(`🚨 Alerte émise: ${data.message}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ Client déconnecté: ${socket.id}`);
  });
});

// Servir le frontend (build) en production
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // Pour le routing SPA (React Router), renvoyer index.html 
  app.get('*', (req, res) => {
    // Ne pas intercepter les routes API
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ error: 'Route non trouvée' });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Gestion des erreurs 404 (mode dev sans frontend build)
  app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
  });
}

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur:', err.stack);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Démarrage du serveur avec Socket.io
server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  const localIP = Object.values(nets).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║           🏭  LOGI-TRACK API SERVER  🏭                       ║');
  console.log('║                                                               ║');
  console.log('║   Suivi de production et certification API 5L                 ║');
  console.log('║   des tubes spirale                                           ║');
  console.log('║                                                               ║');
  console.log(`║   🚀 http://localhost:${PORT}                                  ║`);
  if (hasSSL) {
    console.log(`║   🔒 https://localhost:${HTTPS_PORT}  (HTTPS/SSL)               ║`);
    console.log(`║   📱 Android: https://${localIP}:${HTTPS_PORT}             ║`);
  }
  console.log('║   🔌 Socket.io activé pour notifications temps réel           ║');
  if (fs.existsSync(frontendDist)) {
    console.log('║   📦 Frontend servi depuis /frontend/dist                     ║');
  }
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = { app, io, server };
