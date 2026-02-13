/**
 * Migration pour ajouter les colonnes créateur directement dans bobines
 * Permet de stocker le nom/prénom du créateur sans dépendre de la FK
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateCreateurDirect() {
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
    console.log('║         📝 MIGRATION CRÉATEUR DIRECT BOBINES 📝               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Vérifier les colonnes existantes
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bobines'
    `, [process.env.DB_NAME || 'logitrack']);

    const existingColumns = columns.map(c => c.COLUMN_NAME);

    // Ajouter createur_nom si manquant
    if (!existingColumns.includes('createur_nom')) {
      console.log('➕ Ajout de la colonne createur_nom...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN createur_nom VARCHAR(100) NULL COMMENT 'Nom du créateur (stockage direct)'
      `);
      console.log('✅ Colonne createur_nom ajoutée');
    }

    // Ajouter createur_prenom si manquant
    if (!existingColumns.includes('createur_prenom')) {
      console.log('➕ Ajout de la colonne createur_prenom...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN createur_prenom VARCHAR(100) NULL COMMENT 'Prénom du créateur (stockage direct)'
      `);
      console.log('✅ Colonne createur_prenom ajoutée');
    }

    // Ajouter modificateur_nom si manquant
    if (!existingColumns.includes('modificateur_nom')) {
      console.log('➕ Ajout de la colonne modificateur_nom...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN modificateur_nom VARCHAR(100) NULL COMMENT 'Nom du modificateur (stockage direct)'
      `);
      console.log('✅ Colonne modificateur_nom ajoutée');
    }

    // Ajouter modificateur_prenom si manquant
    if (!existingColumns.includes('modificateur_prenom')) {
      console.log('➕ Ajout de la colonne modificateur_prenom...');
      await connection.query(`
        ALTER TABLE bobines 
        ADD COLUMN modificateur_prenom VARCHAR(100) NULL COMMENT 'Prénom du modificateur (stockage direct)'
      `);
      console.log('✅ Colonne modificateur_prenom ajoutée');
    }

    // Rendre numero_coulee nullable si ce n'est pas déjà le cas
    console.log('🔄 Modification de numero_coulee pour le rendre nullable...');
    try {
      await connection.query(`
        ALTER TABLE bobines 
        MODIFY COLUMN numero_coulee VARCHAR(50) NULL DEFAULT NULL
      `);
      console.log('✅ numero_coulee modifié (nullable)');
    } catch (e) {
      console.log('ℹ️ numero_coulee déjà nullable ou colonne inexistante');
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║      ✅ MIGRATION CRÉATEUR DIRECT TERMINÉE ✅                  ║');
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
  migrateCreateurDirect()
    .then(() => {
      console.log('Migration terminée avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration échouée:', error);
      process.exit(1);
    });
}

module.exports = migrateCreateurDirect;
