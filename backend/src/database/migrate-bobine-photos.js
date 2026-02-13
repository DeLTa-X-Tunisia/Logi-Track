/**
 * Migration pour créer la table bobine_photos
 * Stockage des photos liées aux bobines (jusqu'à 5 par bobine)
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateBobinePhotos() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'logitrack',
      port: process.env.DB_PORT || 3306
    });

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║           📸 MIGRATION TABLE BOBINE_PHOTOS 📸                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Créer la table bobine_photos
    console.log('📋 Création de la table bobine_photos...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bobine_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bobine_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL COMMENT 'Nom du fichier stocké',
        original_name VARCHAR(255) NOT NULL COMMENT 'Nom original du fichier',
        mimetype VARCHAR(100) NOT NULL,
        size INT NOT NULL COMMENT 'Taille en bytes',
        path VARCHAR(500) NOT NULL COMMENT 'Chemin relatif du fichier',
        uploaded_by INT NULL COMMENT 'ID opérateur qui a uploadé',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bobine_id) REFERENCES bobines(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES operateurs(id) ON DELETE SET NULL,
        INDEX idx_bobine_photos (bobine_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table bobine_photos créée');

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         ✅ MIGRATION BOBINE_PHOTOS TERMINÉE ✅                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur de migration:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  migrateBobinePhotos()
    .then(() => {
      console.log('Migration terminée avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration échouée:', error);
      process.exit(1);
    });
}

module.exports = migrateBobinePhotos;
