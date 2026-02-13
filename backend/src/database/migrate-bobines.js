/**
 * Migration pour enrichir la table bobines avec les champs demandés
 * - created_by: ID de l'opérateur qui a créé la bobine
 * - norme: Norme API (dropdown)
 * - notes: Commentaires
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateBobines() {
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
    console.log('║              📦 MIGRATION TABLE BOBINES 📦                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Vérifier les colonnes existantes
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bobines'
    `, [process.env.DB_NAME || 'logitrack']);

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    console.log('📋 Colonnes existantes:', existingColumns.join(', '));

    // Ajouter created_by si manquant
    if (!existingColumns.includes('created_by')) {
      console.log('➕ Ajout de la colonne created_by...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN created_by INT NULL COMMENT 'ID opérateur créateur',
        ADD FOREIGN KEY (created_by) REFERENCES operateurs(id) ON DELETE SET NULL
      `);
      console.log('✅ Colonne created_by ajoutée');
    }

    // Ajouter updated_by si manquant
    if (!existingColumns.includes('updated_by')) {
      console.log('➕ Ajout de la colonne updated_by...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN updated_by INT NULL COMMENT 'ID opérateur dernière modification',
        ADD FOREIGN KEY (updated_by) REFERENCES operateurs(id) ON DELETE SET NULL
      `);
      console.log('✅ Colonne updated_by ajoutée');
    }

    // Ajouter norme si manquant
    if (!existingColumns.includes('norme')) {
      console.log('➕ Ajout de la colonne norme...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN norme VARCHAR(50) DEFAULT 'API 5L' COMMENT 'Norme API 5L, etc.'
      `);
      console.log('✅ Colonne norme ajoutée');
    }

    // Ajouter notes si manquant
    if (!existingColumns.includes('notes')) {
      console.log('➕ Ajout de la colonne notes...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN notes TEXT NULL COMMENT 'Notes et commentaires'
      `);
      console.log('✅ Colonne notes ajoutée');
    }

    // Ajouter updated_at si manquant
    if (!existingColumns.includes('updated_at')) {
      console.log('➕ Ajout de la colonne updated_at...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);
      console.log('✅ Colonne updated_at ajoutée');
    }

    // Renommer coulée en numero_coulee si nécessaire (standardisation)
    if (existingColumns.includes('coulée') && !existingColumns.includes('numero_coulee')) {
      console.log('🔄 Renommage de coulée en numero_coulee...');
      await connection.query(`
        ALTER TABLE bobines 
        CHANGE COLUMN coulée numero_coulee VARCHAR(50) NOT NULL
      `);
      console.log('✅ Colonne renommée');
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ MIGRATION BOBINES TERMINÉE ✅                  ║');
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
  migrateBobines()
    .then(() => {
      console.log('Migration terminée avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration échouée:', error);
      process.exit(1);
    });
}

module.exports = migrateBobines;
