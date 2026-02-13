/**
 * Migration: Système de suivi des tubes de production
 * - Refonte de la table tubes (ajout coulee_id, diametre_pouce, etape_courante)
 * - Refonte de tube_etapes (ex suivi_tubes) pour 12 étapes
 * - Mise à jour etapes_production (12 étapes au lieu de 8)
 */

const pool = require('../config/database');

async function migrate() {
  const conn = await pool.getConnection();
  
  try {
    console.log('🔧 Migration Tubes - Système de suivi production...\n');

    // =============================================
    // 1. Supprimer les anciennes tables (vides)
    // =============================================
    console.log('1️⃣  Nettoyage anciennes tables...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DROP TABLE IF EXISTS suivi_tubes');
    await conn.query('DROP TABLE IF EXISTS tube_etapes');
    await conn.query('DROP TABLE IF EXISTS tubes');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('   ✅ Tables supprimées\n');

    // =============================================
    // 2. Créer la nouvelle table tubes
    // =============================================
    console.log('2️⃣  Création table tubes...');
    await conn.query(`
      CREATE TABLE tubes (
        id INT NOT NULL AUTO_INCREMENT,
        coulee_id INT NOT NULL,
        numero VARCHAR(50) NOT NULL,
        diametre_mm DECIMAL(8,2) NOT NULL,
        diametre_pouce VARCHAR(10) DEFAULT NULL,
        longueur DECIMAL(8,2) DEFAULT NULL,
        epaisseur DECIMAL(6,2) DEFAULT NULL,
        poids DECIMAL(10,2) DEFAULT NULL,
        etape_courante SMALLINT DEFAULT 1,
        statut ENUM('en_production','termine','rebut','en_attente') DEFAULT 'en_production',
        operateur_id INT DEFAULT NULL,
        operateur_nom VARCHAR(100) DEFAULT NULL,
        operateur_prenom VARCHAR(100) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_coulee (coulee_id),
        KEY idx_statut (statut),
        KEY idx_etape (etape_courante),
        FOREIGN KEY (coulee_id) REFERENCES coulees(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Table tubes créée\n');
    console.log('   ✅ Table tubes créée\n');

    // =============================================
    // 3. Créer la table tube_etapes
    // =============================================
    console.log('3️⃣  Création table tube_etapes...');
    await conn.query(`
      CREATE TABLE tube_etapes (
        id INT NOT NULL AUTO_INCREMENT,
        tube_id INT NOT NULL,
        etape_numero SMALLINT NOT NULL,
        etape_code VARCHAR(50) NOT NULL,
        statut ENUM('en_attente','en_cours','valide','non_conforme','saute') DEFAULT 'en_attente',
        operateur_id INT DEFAULT NULL,
        operateur_nom VARCHAR(100) DEFAULT NULL,
        operateur_prenom VARCHAR(100) DEFAULT NULL,
        commentaire TEXT DEFAULT NULL,
        started_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        offline TINYINT(1) DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY unique_tube_etape (tube_id, etape_numero),
        KEY idx_tube (tube_id),
        KEY idx_statut (statut),
        FOREIGN KEY (tube_id) REFERENCES tubes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Table tube_etapes créée\n');

    // =============================================
    // 4. Mettre à jour etapes_production (12 étapes)
    // =============================================
    console.log('4️⃣  Mise à jour etapes_production (12 étapes)...');
    await conn.query('DELETE FROM etapes_production');
    await conn.query(`
      INSERT INTO etapes_production (id, code, nom, description, ordre, obligatoire, duree_estimee, icon, color) VALUES
      (1,  'FORMAGE',         'Formage',                        'Formage du tube spirale à partir de la bobine',            1,  1, 30, 'Cylinder',    'blue'),
      (2,  'POINTAGE',        'Pointage (GMAW)',                'Soudage de pointage GMAW',                                 2,  1, 20, 'Flame',       'orange'),
      (3,  'CV_POINTAGE',     'Contrôle visuel pointage',       'Inspection visuelle du pointage',                          3,  1, 10, 'Eye',         'purple'),
      (4,  'SAW_ID_OD',       'SAW ID/OD',                      'Soudage SAW intérieur/extérieur (offline)',                4,  1, 45, 'Flame',       'amber'),
      (5,  'CV_CORDON',       'Contrôle visuel cordon',         'Inspection visuelle du cordon de soudure',                 5,  1, 10, 'Eye',         'purple'),
      (6,  'COUPE',           'Coupe',                          'Coupe du tube à la longueur voulue',                       6,  1, 15, 'Scissors',    'green'),
      (7,  'CND',             'CND (Xray/UT)',                  'Contrôle non destructif par radiographie ou ultrasons',    7,  1, 20, 'Scan',        'red'),
      (8,  'CV_APRES_CND',    'Contrôle visuel après CND',      'Inspection visuelle après contrôle non destructif',       8,  1, 10, 'Eye',         'purple'),
      (9,  'HYDROTEST',       'Hydrotest',                      'Épreuve hydrostatique selon API 5L',                       9,  1, 30, 'Droplet',     'cyan'),
      (10, 'CV_FUITE',        'Contrôle visuel fuite/déform.',  'Inspection visuelle fuite et déformation',                10,  1, 10, 'Eye',         'purple'),
      (11, 'CHANFREIN',       'Chanfrein',                      'Usinage des extrémités du tube',                          11,  1, 15, 'Scissors',    'green'),
      (12, 'CV_CHANFREIN',    'Contrôle visuel chanfrein',      'Inspection visuelle du chanfrein',                        12,  1, 10, 'Eye',         'purple')
    `);
    console.log('   ✅ 12 étapes de production insérées\n');

    // =============================================
    // Vérification finale
    // =============================================
    console.log('📋 Vérification...');
    const [tables] = await conn.query("SHOW TABLES LIKE 'tube%'");
    console.log(`   Tables tube*: ${tables.map(t => Object.values(t)[0]).join(', ')}`);
    
    const [etapes] = await conn.query('SELECT id, code, nom FROM etapes_production ORDER BY ordre');
    console.log(`   Étapes de production: ${etapes.length}`);
    etapes.forEach(e => console.log(`     ${e.id}. [${e.code}] ${e.nom}`));

    console.log('\n✅ Migration tubes terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
