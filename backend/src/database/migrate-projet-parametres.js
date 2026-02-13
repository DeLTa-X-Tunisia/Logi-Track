/**
 * Migration: Créer la table projet_parametres
 * Stocke les paramètres généraux du projet (logos, client, projet)
 */

const pool = require('../config/database');

async function migrate() {
  try {
    console.log('🔄 Création de la table projet_parametres...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS projet_parametres (
        id INT PRIMARY KEY DEFAULT 1,
        logo_path VARCHAR(500) DEFAULT NULL COMMENT 'Logo de l\\'entreprise',
        client_logo_path VARCHAR(500) DEFAULT NULL COMMENT 'Logo du client',
        client_nom VARCHAR(255) DEFAULT NULL COMMENT 'Nom du client',
        client_adresse TEXT DEFAULT NULL COMMENT 'Adresse du client',
        projet_nom VARCHAR(255) DEFAULT NULL COMMENT 'Nom du projet',
        projet_adresse TEXT DEFAULT NULL COMMENT 'Adresse du projet',
        projet_code VARCHAR(100) DEFAULT NULL COMMENT 'Code du projet',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT single_row CHECK (id = 1)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insérer la ligne par défaut si elle n'existe pas
    await pool.query(`
      INSERT IGNORE INTO projet_parametres (id) VALUES (1)
    `);

    console.log('✅ Table projet_parametres créée avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

migrate();
