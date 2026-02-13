const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de connexions MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'logitrack',
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test de connexion
pool.getConnection()
  .then(connection => {
    console.log('✅ Connexion à MySQL établie avec succès (LogiTrack)');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Erreur de connexion à MySQL:', err.message);
  });

module.exports = pool;
