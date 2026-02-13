const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateChecklist() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'logitrack'
  });

  try {
    console.log('=== Migration Checklist Machine ===\n');

    // Table des catégories de checklist
    console.log('1. Création table checklist_categories...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checklist_categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL UNIQUE,
        nom VARCHAR(100) NOT NULL,
        ordre INT DEFAULT 0,
        actif BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des items de checklist (modèle)
    console.log('2. Création table checklist_items...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checklist_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        categorie_id INT,
        code VARCHAR(50) NOT NULL UNIQUE,
        libelle VARCHAR(255) NOT NULL,
        description TEXT,
        critique BOOLEAN DEFAULT FALSE,
        ordre INT DEFAULT 0,
        actif BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categorie_id) REFERENCES checklist_categories(id)
      )
    `);

    // Table des validations de checklist par coulée
    console.log('3. Création table checklist_validations...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checklist_validations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        coulee_id INT NOT NULL,
        item_id INT NOT NULL,
        statut ENUM('non_verifie', 'conforme', 'non_conforme', 'corrige') DEFAULT 'non_verifie',
        defaut_detecte TEXT,
        action_corrective TEXT,
        date_verification DATETIME,
        date_correction DATETIME,
        operateur_id INT,
        operateur_correction_id INT,
        commentaire TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (coulee_id) REFERENCES coulees(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES checklist_items(id),
        UNIQUE KEY unique_coulee_item (coulee_id, item_id)
      )
    `);

    // Insérer les catégories
    console.log('4. Insertion des catégories...');
    const categories = [
      { code: 'DEROULAGE', nom: 'Système de Déroulage', ordre: 1 },
      { code: 'FORMAGE', nom: 'Section Formage', ordre: 2 },
      { code: 'SOUDAGE', nom: 'Poste de Soudage', ordre: 3 },
      { code: 'REFROIDISSEMENT', nom: 'Circuit de Refroidissement', ordre: 4 },
      { code: 'CONTROLE', nom: 'Équipements de Contrôle', ordre: 5 },
      { code: 'SECURITE', nom: 'Sécurité & EPI', ordre: 6 }
    ];

    for (const cat of categories) {
      await pool.query(`
        INSERT INTO checklist_categories (code, nom, ordre) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE nom = VALUES(nom), ordre = VALUES(ordre)
      `, [cat.code, cat.nom, cat.ordre]);
    }

    // Récupérer les IDs des catégories
    const [cats] = await pool.query('SELECT id, code FROM checklist_categories');
    const catMap = {};
    cats.forEach(c => catMap[c.code] = c.id);

    // Insérer les items de checklist
    console.log('5. Insertion des items de checklist...');
    const items = [
      // Déroulage
      { cat: 'DEROULAGE', code: 'DER_001', libelle: 'Mandrin de déroulage en bon état', critique: true, ordre: 1 },
      { cat: 'DEROULAGE', code: 'DER_002', libelle: 'Frein de bobine fonctionnel', critique: true, ordre: 2 },
      { cat: 'DEROULAGE', code: 'DER_003', libelle: 'Guides d\'entrée correctement alignés', critique: true, ordre: 3 },
      { cat: 'DEROULAGE', code: 'DER_004', libelle: 'Tension de bande réglée', critique: false, ordre: 4 },
      
      // Formage
      { cat: 'FORMAGE', code: 'FOR_001', libelle: 'Rouleaux de formage en bon état (usure < limite)', critique: true, ordre: 1 },
      { cat: 'FORMAGE', code: 'FOR_002', libelle: 'Pression des rouleaux conforme aux spécifications', critique: true, ordre: 2 },
      { cat: 'FORMAGE', code: 'FOR_003', libelle: 'Lubrification des paliers effectuée', critique: false, ordre: 3 },
      { cat: 'FORMAGE', code: 'FOR_004', libelle: 'Alignement de la cage de formage vérifié', critique: true, ordre: 4 },
      
      // Soudage
      { cat: 'SOUDAGE', code: 'SOU_001', libelle: 'Électrodes/torche en bon état', critique: true, ordre: 1 },
      { cat: 'SOUDAGE', code: 'SOU_002', libelle: 'Paramètres de soudage conformes (intensité, vitesse)', critique: true, ordre: 2 },
      { cat: 'SOUDAGE', code: 'SOU_003', libelle: 'Gaz de protection disponible et débit correct', critique: true, ordre: 3 },
      { cat: 'SOUDAGE', code: 'SOU_004', libelle: 'Système d\'extraction des fumées opérationnel', critique: false, ordre: 4 },
      
      // Refroidissement
      { cat: 'REFROIDISSEMENT', code: 'REF_001', libelle: 'Niveau du bac de refroidissement OK', critique: true, ordre: 1 },
      { cat: 'REFROIDISSEMENT', code: 'REF_002', libelle: 'Température du liquide de refroidissement conforme', critique: true, ordre: 2 },
      { cat: 'REFROIDISSEMENT', code: 'REF_003', libelle: 'Pompes de circulation fonctionnelles', critique: true, ordre: 3 },
      { cat: 'REFROIDISSEMENT', code: 'REF_004', libelle: 'Buses de pulvérisation non obstruées', critique: false, ordre: 4 },
      
      // Contrôle
      { cat: 'CONTROLE', code: 'CTR_001', libelle: 'Calibration du contrôle dimensionnel à jour', critique: true, ordre: 1 },
      { cat: 'CONTROLE', code: 'CTR_002', libelle: 'Équipement de contrôle visuel soudure opérationnel', critique: true, ordre: 2 },
      { cat: 'CONTROLE', code: 'CTR_003', libelle: 'Capteurs de vitesse ligne fonctionnels', critique: false, ordre: 3 },
      { cat: 'CONTROLE', code: 'CTR_004', libelle: 'Système d\'acquisition données actif', critique: false, ordre: 4 },
      
      // Sécurité
      { cat: 'SECURITE', code: 'SEC_001', libelle: 'Arrêts d\'urgence testés et fonctionnels', critique: true, ordre: 1 },
      { cat: 'SECURITE', code: 'SEC_002', libelle: 'Barrières de sécurité en place', critique: true, ordre: 2 },
      { cat: 'SECURITE', code: 'SEC_003', libelle: 'EPI disponibles (gants, lunettes, casque antibruit)', critique: true, ordre: 3 },
      { cat: 'SECURITE', code: 'SEC_004', libelle: 'Zone de travail dégagée et propre', critique: false, ordre: 4 },
      { cat: 'SECURITE', code: 'SEC_005', libelle: 'Extincteur accessible et date de contrôle valide', critique: true, ordre: 5 }
    ];

    for (const item of items) {
      await pool.query(`
        INSERT INTO checklist_items (categorie_id, code, libelle, critique, ordre) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          libelle = VALUES(libelle), 
          critique = VALUES(critique), 
          ordre = VALUES(ordre)
      `, [catMap[item.cat], item.code, item.libelle, item.critique, item.ordre]);
    }

    console.log('\n✅ Migration Checklist terminée avec succès !');
    console.log(`   - ${categories.length} catégories`);
    console.log(`   - ${items.length} items de checklist`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    process.exit(1);
  }
}

migrateChecklist();
