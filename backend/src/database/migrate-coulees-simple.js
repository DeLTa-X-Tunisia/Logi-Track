/**
 * Migration simplifiée du module Coulées
 * Coulée = Début de poste/production avec suivi bobine
 */

const pool = require('../config/database');

async function migrateCoulees() {
  const conn = await pool.getConnection();
  
  try {
    console.log('🔄 Simplification du module Coulées...\n');

    // Supprimer les anciennes tables si elles existent
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DROP TABLE IF EXISTS coulee_documents');
    await conn.query('DROP TABLE IF EXISTS coulee_timeline');
    await conn.query('DROP TABLE IF EXISTS coulees');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Anciennes tables supprimées');

    // Table coulees simplifiée
    await conn.query(`
      CREATE TABLE coulees (
        id INT PRIMARY KEY AUTO_INCREMENT,
        numero VARCHAR(20) NOT NULL UNIQUE,
        date_debut DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date_fin DATETIME NULL,
        
        -- Bobine sélectionnée
        bobine_id INT NULL,
        
        -- Statuts étapes
        statut ENUM('en_cours', 'pret_production', 'en_production', 'termine', 'annule') DEFAULT 'en_cours',
        
        -- Étape réception bobine
        bobine_recue BOOLEAN DEFAULT FALSE,
        date_reception DATETIME NULL,
        retard_reception_minutes INT DEFAULT 0,
        motif_retard_reception_id INT NULL,
        commentaire_reception TEXT NULL,
        
        -- Étape installation bobine
        bobine_installee BOOLEAN DEFAULT FALSE,
        date_installation DATETIME NULL,
        retard_installation_minutes INT DEFAULT 0,
        motif_retard_installation_id INT NULL,
        commentaire_installation TEXT NULL,
        
        -- Checklist machine validée
        checklist_validee BOOLEAN DEFAULT FALSE,
        date_checklist DATETIME NULL,
        
        -- Traçabilité
        created_by INT NULL,
        operateur_nom VARCHAR(100) NULL,
        operateur_prenom VARCHAR(100) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (bobine_id) REFERENCES bobines(id) ON DELETE SET NULL,
        FOREIGN KEY (motif_retard_reception_id) REFERENCES motifs_retard(id) ON DELETE SET NULL,
        FOREIGN KEY (motif_retard_installation_id) REFERENCES motifs_retard(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table coulees créée (simplifiée)');

    // Mettre à jour la table bobines pour le lien
    try {
      await conn.query(`ALTER TABLE bobines ADD COLUMN coulee_id INT NULL`);
      await conn.query(`ALTER TABLE bobines ADD CONSTRAINT fk_bobine_coulee FOREIGN KEY (coulee_id) REFERENCES coulees(id) ON DELETE SET NULL`);
      console.log('✅ Colonne coulee_id ajoutée à bobines');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Colonne coulee_id existe déjà dans bobines');
      } else {
        console.log('⚠️ Erreur ajout colonne:', e.message);
      }
    }

    // Vérifier/garder les motifs de retard existants
    const [existingMotifs] = await conn.query('SELECT COUNT(*) as count FROM motifs_retard');
    if (existingMotifs[0].count === 0) {
      // Insérer les motifs de retard
      const motifs = [
        // Réception bobine
        ['reception', 'Bobine en retard livraison', 'logistique', 1],
        ['reception', 'Problème transport', 'logistique', 2],
        ['reception', 'Attente pont roulant', 'logistique', 3],
        ['reception', 'Zone réception encombrée', 'logistique', 4],
        ['reception', 'Personnel indisponible', 'personnel', 5],
        ['reception', 'Documents manquants', 'administratif', 6],
        
        // Installation bobine
        ['installation', 'Dérouleuse occupée', 'technique', 1],
        ['installation', 'Maintenance dérouleuse', 'technique', 2],
        ['installation', 'Réglages machine', 'technique', 3],
        ['installation', 'Changement outillage', 'technique', 4],
        ['installation', 'Attente opérateur', 'personnel', 5],
        ['installation', 'Problème qualité bobine', 'qualite', 6],
        
        // Général
        ['general', 'Pause équipe', 'personnel', 1],
        ['general', 'Réunion production', 'administratif', 2],
        ['general', 'Problème informatique', 'technique', 3],
        ['general', 'Autre raison', 'autre', 10]
      ];

      for (const [etape, libelle, categorie, ordre] of motifs) {
        await conn.query(
          'INSERT INTO motifs_retard (etape, libelle, categorie, ordre) VALUES (?, ?, ?, ?)',
          [etape, libelle, categorie, ordre]
        );
      }
      console.log('✅ Motifs de retard insérés');
    } else {
      console.log('ℹ️ Motifs de retard déjà présents');
    }

    console.log('\n✅ Migration Coulées simplifiée terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrateCoulees();
