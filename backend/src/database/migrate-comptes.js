/**
 * Migration pour ajouter les nouveaux champs de gestion des comptes
 * Téléphone, Département, Qualification, Direction
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
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
    console.log('║       🔄 MIGRATION GESTION DES COMPTES LOGITRACK 🔄           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Ajouter les nouveaux champs à la table operateurs
    console.log('📋 Ajout des colonnes à la table operateurs...');
    
    const columnsToAdd = [
      { name: 'email', definition: "VARCHAR(100) DEFAULT NULL COMMENT 'Email de l\\'opérateur'" },
      { name: 'telephone', definition: "VARCHAR(20) DEFAULT NULL COMMENT 'Numéro de téléphone'" },
      { name: 'departement', definition: "ENUM('production', 'qualite', 'maintenance', 'logistique', 'direction', 'hse') DEFAULT 'production'" },
      { name: 'qualification', definition: "VARCHAR(100) DEFAULT NULL COMMENT 'Qualification professionnelle'" },
      { name: 'direction_role', definition: "ENUM('chef_projet', 'chef_chantier', 'none') DEFAULT 'none' COMMENT 'Rôle dans la direction'" },
      { name: 'is_admin', definition: "BOOLEAN DEFAULT FALSE COMMENT 'Droits administrateur'" }
    ];

    for (const col of columnsToAdd) {
      try {
        await connection.query(`ALTER TABLE operateurs ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`  ✅ Colonne '${col.name}' ajoutée`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⏭️  Colonne '${col.name}' existe déjà`);
        } else {
          throw error;
        }
      }
    }

    // Créer la table des départements
    console.log('📋 Création de la table departements...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS departements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        nom VARCHAR(100) NOT NULL,
        description TEXT,
        actif BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insérer les départements par défaut
    console.log('📥 Insertion des départements...');
    await connection.query(`
      INSERT IGNORE INTO departements (code, nom, description) VALUES
      ('PROD', 'Production', 'Département de production des tubes'),
      ('QUAL', 'Qualité', 'Département contrôle qualité et certification'),
      ('MAINT', 'Maintenance', 'Département maintenance industrielle'),
      ('LOG', 'Logistique', 'Département logistique et approvisionnement'),
      ('DIR', 'Direction', 'Direction et management'),
      ('HSE', 'HSE', 'Hygiène, Sécurité et Environnement')
    `);

    // Créer la table des qualifications
    console.log('📋 Création de la table qualifications...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS qualifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        nom VARCHAR(100) NOT NULL,
        niveau INT DEFAULT 1 COMMENT 'Niveau de compétence 1-5',
        description TEXT,
        actif BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insérer les qualifications par défaut
    console.log('📥 Insertion des qualifications...');
    await connection.query(`
      INSERT IGNORE INTO qualifications (code, nom, niveau, description) VALUES
      ('OP1', 'Opérateur Niveau 1', 1, 'Opérateur débutant'),
      ('OP2', 'Opérateur Niveau 2', 2, 'Opérateur confirmé'),
      ('OP3', 'Opérateur Niveau 3', 3, 'Opérateur expert'),
      ('TECH', 'Technicien', 3, 'Technicien qualifié'),
      ('CTRLQ', 'Contrôleur Qualité', 3, 'Contrôleur qualité certifié'),
      ('SOUD', 'Soudeur Certifié', 3, 'Soudeur certifié API'),
      ('XRAY', 'Technicien Radiographie', 4, 'Technicien radiographie niveau 2'),
      ('RESP', 'Responsable', 4, 'Responsable d\\'équipe'),
      ('ING', 'Ingénieur', 5, 'Ingénieur qualifié'),
      ('CP', 'Chef de Projet', 5, 'Chef de projet'),
      ('CC', 'Chef de Chantier', 5, 'Chef de chantier')
    `);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     ✅  MIGRATION TERMINÉE AVEC SUCCÈS  ✅                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

migrate();
