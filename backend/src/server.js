require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
const auditRoutes = require('./routes/audit');

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
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3002'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Rendre io accessible aux routes via req.app.get('io')
app.set('io', io);

// Sécurité HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour compatibilité frontend SPA
  crossOriginEmbedderPolicy: false
}));

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    callback(new Error('CORS non autorisé'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting global
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_API || '300'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans quelques minutes' }
});

// Rate limiting strict pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH || '20'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' }
});

// Appliquer rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Servir les fichiers uploadés (photos) - protégés par auth
app.use('/uploads', authenticateToken, express.static(path.join(__dirname, '../uploads')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Route de santé (publique) - vérifie la DB
app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try {
    const pool = require('./config/database');
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    dbOk = true;
  } catch (e) { /* DB down */ }

  const status = dbOk ? 'OK' : 'DEGRADED';
  res.status(dbOk ? 200 : 503).json({ 
    status, 
    message: 'Logi-Track API is running - Certification API 5L',
    version: '2.1.0',
    database: dbOk ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
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
app.use('/api/audit', auditRoutes); // Journal d'audit (auth interne)

// Téléchargement APK Android (publique)
const apkPath = path.join(__dirname, '../../AndroidLogitrack/app-release.apk');
app.get('/api/download/android', (req, res) => {
  if (fs.existsSync(apkPath)) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="LogiTrack.apk"');
    res.sendFile(apkPath);
  } else {
    res.status(404).json({ error: 'APK non disponible' });
  }
});

// Info APK (version, taille, disponibilité)
app.get('/api/download/android/info', (req, res) => {
  if (fs.existsSync(apkPath)) {
    const stats = fs.statSync(apkPath);
    res.json({
      available: true,
      filename: 'LogiTrack.apk',
      size: stats.size,
      sizeFormatted: (stats.size / (1024 * 1024)).toFixed(1) + ' MB',
      lastModified: stats.mtime
    });
  } else {
    res.json({ available: false });
  }
});

// Route de découverte pour l'app Android (fallback HTTP, publique)
app.get('/api/discover', (req, res) => {
  const os = require('os');
  const nets = os.networkInterfaces();
  const localIP = Object.values(nets).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
  res.json({ 
    service: 'LogiTrack', 
    version: '2.0.0', 
    ip: localIP, 
    port: PORT,
    httpsPort: hasSSL ? HTTPS_PORT : null 
  });
});

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

// --- mDNS / Bonjour : annonce du service LogiTrack sur le réseau local ---
const { Bonjour } = require('bonjour-service');
const bonjour = new Bonjour();

function publishMdns() {
  bonjour.publish({
    name: 'LogiTrack-Server',
    type: 'logitrack',
    protocol: 'tcp',
    port: PORT,
    txt: { version: '2.0.0', path: '/' }
  });
  console.log('📡 mDNS: service _logitrack._tcp publié sur le réseau local');
}

// Démarrage du serveur avec Socket.io
server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  const localIP = Object.values(nets).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
  
  // Publier le service mDNS après démarrage
  publishMdns();
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║           🏭  LOGI-TRACK API SERVER  🏭                       ║');
  console.log('║                                                               ║');
  console.log('║   Suivi de production et certification API 5L                 ║');
  console.log('║   des tubes spirale                                           ║');
  console.log('║                                                               ║');
  console.log(`║   🚀 http://localhost:${PORT}                                  ║`);
  console.log(`║   📡 mDNS: _logitrack._tcp (découverte auto Android)          ║`);
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
