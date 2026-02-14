/**
 * Migration: Table notifications
 * Stocke les notifications temps réel (décisions finales, alertes, etc.)
 */
const pool = require('../config/database');

async function migrate() {
  try {
    console.log('🔔 Création de la table notifications...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL DEFAULT 'decision',
        titre VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        tube_id INT NULL,
        tube_numero INT NULL,
        decision VARCHAR(50) NULL,
        created_by VARCHAR(100) NULL,
        lu TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lu (lu),
        INDEX idx_created_at (created_at),
        INDEX idx_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Table notifications créée avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur migration notifications:', error);
    process.exit(1);
  }
}

migrate();
