/**
 * Migration pour le module Coulées
 * Crée les tables: coulees, coulee_timeline, motifs_retard, coulee_documents
 */

const pool = require('../config/database');

async function migrateCoulees() {
  console.log('🔄 Début migration Coulées...\n');

  try {
    // 1. Table des motifs de retard (référentiel)
    console.log('📋 Création table motifs_retard...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS motifs_retard (
        id INT AUTO_INCREMENT PRIMARY KEY,
        categorie ENUM('personnel', 'logistique', 'technique', 'qualite', 'administratif', 'autre') NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        libelle VARCHAR(255) NOT NULL,
        description TEXT,
        actif BOOLEAN DEFAULT TRUE,
        ordre INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Table motifs_retard créée');

    // 2. Table principale des coulées
    console.log('📋 Création table coulees...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coulees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numero_coulee VARCHAR(100) NOT NULL UNIQUE,
        
        -- Informations générales
        fournisseur VARCHAR(255),
        acierie VARCHAR(255),
        pays_origine VARCHAR(100),
        date_production DATE,
        date_reception DATE,
        
        -- Grade et norme
        steel_grade_id INT,
        norme VARCHAR(50) DEFAULT 'API 5L',
        niveau_specification ENUM('PSL1', 'PSL2') DEFAULT 'PSL2',
        
        -- Composition chimique (%)
        c_carbone DECIMAL(6,4),
        mn_manganese DECIMAL(6,4),
        si_silicium DECIMAL(6,4),
        p_phosphore DECIMAL(6,4),
        s_soufre DECIMAL(6,4),
        cr_chrome DECIMAL(6,4),
        ni_nickel DECIMAL(6,4),
        mo_molybdene DECIMAL(6,4),
        cu_cuivre DECIMAL(6,4),
        v_vanadium DECIMAL(6,4),
        nb_niobium DECIMAL(6,4),
        ti_titane DECIMAL(6,4),
        al_aluminium DECIMAL(6,4),
        n_azote DECIMAL(6,4),
        b_bore DECIMAL(6,5),
        ce_iiw DECIMAL(6,4),
        ce_pcm DECIMAL(6,4),
        
        -- Propriétés mécaniques
        limite_elastique DECIMAL(10,2),
        resistance_traction DECIMAL(10,2),
        ratio_ys_ts DECIMAL(5,3),
        allongement DECIMAL(5,2),
        resilience_charpy DECIMAL(10,2),
        temperature_charpy INT,
        
        -- Statut et timeline
        statut ENUM('nouveau', 'en_preparation', 'pret_production', 'en_production', 'termine', 'annule') DEFAULT 'nouveau',
        etape_actuelle VARCHAR(50) DEFAULT 'creation',
        temps_standard_minutes INT DEFAULT 240,
        
        -- Notes
        notes TEXT,
        
        -- Traçabilité
        created_by INT,
        createur_nom VARCHAR(100),
        createur_prenom VARCHAR(100),
        updated_by INT,
        modificateur_nom VARCHAR(100),
        modificateur_prenom VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (steel_grade_id) REFERENCES steel_grades(id) ON DELETE SET NULL,
        INDEX idx_numero_coulee (numero_coulee),
        INDEX idx_statut (statut),
        INDEX idx_fournisseur (fournisseur)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Table coulees créée');

    // 3. Table timeline des étapes
    console.log('📋 Création table coulee_timeline...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coulee_timeline (
        id INT AUTO_INCREMENT PRIMARY KEY,
        coulee_id INT NOT NULL,
        
        -- Étape
        etape_code VARCHAR(50) NOT NULL,
        etape_nom VARCHAR(255) NOT NULL,
        ordre INT DEFAULT 0,
        
        -- Timestamps
        date_debut TIMESTAMP NULL,
        date_fin TIMESTAMP NULL,
        duree_minutes INT,
        
        -- Retard
        temps_standard_minutes INT DEFAULT 30,
        retard_minutes INT DEFAULT 0,
        est_en_retard BOOLEAN DEFAULT FALSE,
        motif_retard_id INT,
        commentaire_retard TEXT,
        
        -- Statut
        statut ENUM('en_attente', 'en_cours', 'termine', 'bloque') DEFAULT 'en_attente',
        
        -- Opérateur
        operateur_id INT,
        operateur_nom VARCHAR(100),
        operateur_prenom VARCHAR(100),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (coulee_id) REFERENCES coulees(id) ON DELETE CASCADE,
        FOREIGN KEY (motif_retard_id) REFERENCES motifs_retard(id) ON DELETE SET NULL,
        INDEX idx_coulee_timeline (coulee_id, ordre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Table coulee_timeline créée');

    // 4. Table documents (certificats MTR, etc.)
    console.log('📋 Création table coulee_documents...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coulee_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        coulee_id INT NOT NULL,
        
        type_document ENUM('mtr', 'certificat', 'analyse', 'photo', 'autre') DEFAULT 'autre',
        titre VARCHAR(255),
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        mimetype VARCHAR(100),
        size INT,
        path VARCHAR(500) NOT NULL,
        
        uploaded_by INT,
        uploader_nom VARCHAR(100),
        uploader_prenom VARCHAR(100),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (coulee_id) REFERENCES coulees(id) ON DELETE CASCADE,
        INDEX idx_coulee_documents (coulee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Table coulee_documents créée');

    // 5. Ajouter colonne coulee_id à la table bobines
    console.log('📋 Ajout colonne coulee_id à bobines...');
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bobines' AND COLUMN_NAME = 'coulee_id'
    `);
    
    if (columns.length === 0) {
      await pool.query(`
        ALTER TABLE bobines 
        ADD COLUMN coulee_id INT,
        ADD FOREIGN KEY (coulee_id) REFERENCES coulees(id) ON DELETE SET NULL
      `);
      console.log('   ✅ Colonne coulee_id ajoutée à bobines');
    } else {
      console.log('   ℹ️ Colonne coulee_id existe déjà');
    }

    // 6. Insérer les motifs de retard par défaut
    console.log('📋 Insertion motifs de retard...');
    const motifsRetard = [
      // Personnel
      ['personnel', 'MANQUE_EFFECTIF', 'Manque d\'effectif', 1],
      ['personnel', 'ABSENCE_OPERATEUR', 'Absence opérateur', 2],
      ['personnel', 'FORMATION_COURS', 'Formation en cours', 3],
      ['personnel', 'PAUSE_COLLECTIVE', 'Pause collective', 4],
      
      // Logistique
      ['logistique', 'RUPTURE_STOCK', 'Rupture de stock', 1],
      ['logistique', 'RETARD_TRANSPORT', 'Retard de transport', 2],
      ['logistique', 'PROBLEME_LIVRAISON', 'Problème de livraison', 3],
      ['logistique', 'BOBINE_NON_DISPO', 'Bobine non disponible', 4],
      
      // Technique
      ['technique', 'PANNE_MACHINE', 'Panne machine', 1],
      ['technique', 'MAINTENANCE', 'Maintenance en cours', 2],
      ['technique', 'OUTILLAGE_MANQUANT', 'Outillage manquant', 3],
      ['technique', 'REGLAGE_MACHINE', 'Réglage machine', 4],
      
      // Qualité
      ['qualite', 'NON_CONFORMITE', 'Non-conformité détectée', 1],
      ['qualite', 'ATTENTE_VALIDATION', 'Attente validation qualité', 2],
      ['qualite', 'RETEST_REQUIS', 'Re-test requis', 3],
      ['qualite', 'CERTIFICAT_ABSENT', 'Certificat absent', 4],
      
      // Administratif
      ['administratif', 'DOCUMENT_MANQUANT', 'Document manquant', 1],
      ['administratif', 'ATTENTE_APPROBATION', 'Attente approbation', 2],
      ['administratif', 'ORDRE_TRAVAIL', 'Attente ordre de travail', 3],
      
      // Autre
      ['autre', 'AUTRE', 'Autre (voir commentaire)', 1]
    ];

    for (const [categorie, code, libelle, ordre] of motifsRetard) {
      await pool.query(`
        INSERT IGNORE INTO motifs_retard (categorie, code, libelle, ordre)
        VALUES (?, ?, ?, ?)
      `, [categorie, code, libelle, ordre]);
    }
    console.log('   ✅ Motifs de retard insérés');

    console.log('\n✅ Migration Coulées terminée avec succès!');
    console.log('\n📊 Tables créées:');
    console.log('   - motifs_retard (référentiel des causes de retard)');
    console.log('   - coulees (coulées/heats)');
    console.log('   - coulee_timeline (suivi des étapes)');
    console.log('   - coulee_documents (certificats MTR, etc.)');
    console.log('   - bobines.coulee_id (liaison bobine → coulée)');

  } catch (error) {
    console.error('❌ Erreur migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateCoulees();
