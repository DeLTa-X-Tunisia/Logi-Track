/**
 * Migration: Créer la table tube_etape_photos
 * Photos associées aux étapes de production des tubes
 */

const pool = require('../config/database');

async function migrate() {
  try {
    console.log('🔄 Migration tube_etape_photos...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tube_etape_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tube_id INT NOT NULL,
        etape_numero SMALLINT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        mimetype VARCHAR(100),
        size INT,
        path VARCHAR(500) NOT NULL,
        description VARCHAR(500),
        uploaded_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tube_id) REFERENCES tubes(id) ON DELETE CASCADE,
        INDEX idx_tube_etape (tube_id, etape_numero)
      )
    `);

    console.log('✅ Table tube_etape_photos créée');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    process.exit(1);
  }
}

migrate();
