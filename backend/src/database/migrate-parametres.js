/**
 * Migration: Paramètres de Production
 * Tables: parametres_production + parametres_soudure_heads
 */

const pool = require('../config/database');

async function migrate() {
  const conn = await pool.getConnection();

  try {
    console.log('🔧 Migration Paramètres de Production...\n');

    // =============================================
    // Table principale: parametres_production
    // =============================================
    await conn.query(`
      CREATE TABLE IF NOT EXISTS parametres_production (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numero VARCHAR(20) NOT NULL UNIQUE,

        -- Section 1: Formage
        strip_vitesse_m INT DEFAULT 0 COMMENT 'Vitesse strip - mètres (1-9)',
        strip_vitesse_cm INT DEFAULT 0 COMMENT 'Vitesse strip - centimètres (0-99)',
        milling_edge_gauche DECIMAL(5,1) DEFAULT 0 COMMENT 'Milling edge gauche en degrés',
        milling_edge_droit DECIMAL(5,1) DEFAULT 0 COMMENT 'Milling edge droit en degrés',
        pression_rouleaux DECIMAL(8,2) DEFAULT NULL COMMENT 'Pression rouleaux (optionnel, tonnes/bar)',
        pression_rouleaux_unite ENUM('tonnes','bar') DEFAULT 'tonnes',

        -- Section 2: Tackwelding (Machine Offline)
        tack_amperage DECIMAL(8,1) DEFAULT 0 COMMENT 'Ampérage tackwelding (Amps)',
        tack_voltage DECIMAL(8,1) DEFAULT 0 COMMENT 'Voltage tackwelding (Volts)',
        tack_vitesse_m INT DEFAULT 0 COMMENT 'Vitesse soudure tack - mètres',
        tack_vitesse_cm INT DEFAULT 0 COMMENT 'Vitesse soudure tack - centimètres',
        tack_frequence DECIMAL(8,1) DEFAULT NULL COMMENT 'Fréquence HF (Hz)',
        tack_type_gaz ENUM('CO2','Argon_CO2','Argon_O2','Argon_pur','Autre') DEFAULT 'CO2',
        tack_debit_gaz DECIMAL(8,1) DEFAULT NULL COMMENT 'Débit de gaz (L/min, optionnel)',

        -- Section 3: Soudure Finale (vitesse + fil + flux)
        soudure_vitesse_m INT DEFAULT 0 COMMENT 'Vitesse soudure finale - mètres',
        soudure_vitesse_cm INT DEFAULT 0 COMMENT 'Vitesse soudure finale - centimètres',
        soudure_type_fil ENUM('1.0mm','1.2mm','1.6mm','2.0mm','2.4mm','3.2mm','4.0mm') DEFAULT '1.6mm',
        soudure_type_flux ENUM('SAW','FCAW','GMAW','Autre') DEFAULT 'SAW',

        -- Métadonnées
        notes TEXT DEFAULT NULL,
        created_by INT DEFAULT NULL,
        createur_nom VARCHAR(100) DEFAULT NULL,
        createur_prenom VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table parametres_production créée');

    // =============================================
    // Table têtes de soudure: parametres_soudure_heads
    // =============================================
    await conn.query(`
      CREATE TABLE IF NOT EXISTS parametres_soudure_heads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parametre_id INT NOT NULL,
        type ENUM('ID','OD') NOT NULL COMMENT 'ID = intérieur, OD = extérieur',
        numero INT NOT NULL COMMENT 'Numéro de tête (1, 2, 3)',
        actif TINYINT(1) DEFAULT 0 COMMENT '1 = Oui, 0 = Non',
        amperage DECIMAL(8,1) DEFAULT 0,
        voltage DECIMAL(8,1) DEFAULT 0,
        FOREIGN KEY (parametre_id) REFERENCES parametres_production(id) ON DELETE CASCADE,
        UNIQUE KEY unique_head (parametre_id, type, numero)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table parametres_soudure_heads créée');

    // =============================================
    // Ajouter colonne parametre_id à coulees
    // =============================================
    const [cols] = await conn.query(`SHOW COLUMNS FROM coulees WHERE Field = 'parametre_id'`);
    if (cols.length === 0) {
      await conn.query(`
        ALTER TABLE coulees 
        ADD COLUMN parametre_id INT DEFAULT NULL,
        ADD CONSTRAINT fk_coulee_parametre FOREIGN KEY (parametre_id) REFERENCES parametres_production(id) ON DELETE SET NULL
      `);
      console.log('✅ Colonne parametre_id ajoutée à coulees');
    } else {
      console.log('ℹ️  Colonne parametre_id déjà présente dans coulees');
    }

    // =============================================
    // Insérer un preset exemple (PAR-001)
    // =============================================
    const [existing] = await conn.query(`SELECT id FROM parametres_production LIMIT 1`);
    if (existing.length === 0) {
      const [result] = await conn.query(`
        INSERT INTO parametres_production (
          numero,
          strip_vitesse_m, strip_vitesse_cm,
          milling_edge_gauche, milling_edge_droit,
          tack_amperage, tack_voltage, tack_vitesse_m, tack_vitesse_cm,
          tack_type_gaz,
          soudure_vitesse_m, soudure_vitesse_cm,
          soudure_type_fil, soudure_type_flux,
          notes, createur_nom, createur_prenom
        ) VALUES (
          'PAR-001',
          4, 25,
          40.0, 40.0,
          350, 28, 2, 50,
          'CO2',
          1, 80,
          '1.6mm', 'SAW',
          'Paramètres par défaut - Configuration initiale',
          'Administrateur', 'LogiTrack'
        )
      `);

      const presetId = result.insertId;

      // ID Heads (3 têtes intérieures)
      await conn.query(`
        INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage) VALUES
        (?, 'ID', 1, 1, 750, 35),
        (?, 'ID', 2, 1, 550, 35),
        (?, 'ID', 3, 0, 0, 0)
      `, [presetId, presetId, presetId]);

      // OD Heads (2 têtes extérieures)
      await conn.query(`
        INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage) VALUES
        (?, 'OD', 1, 1, 920, 29),
        (?, 'OD', 2, 1, 500, 34)
      `, [presetId, presetId]);

      console.log('✅ Preset exemple PAR-001 créé avec 5 têtes de soudure');
    }

    console.log('\n✅ Migration Paramètres de Production terminée avec succès!');
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
