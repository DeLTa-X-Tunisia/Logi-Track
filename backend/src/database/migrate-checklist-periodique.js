/**
 * Migration : Checklists Périodiques
 * Tables pour les checklists de début de quart, hebdomadaires, mensuelles
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'logitrack',
    port: process.env.DB_PORT || 3306
  });

  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     📋 MIGRATION CHECKLISTS PÉRIODIQUES               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  // ─── Table types de checklists périodiques ───
  console.log('📋 Création table checklist_periodique_types...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS checklist_periodique_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      nom VARCHAR(100) NOT NULL,
      description TEXT,
      frequence ENUM('debut_quart', 'hebdomadaire', 'mensuelle') NOT NULL,
      duree_validite_heures INT NOT NULL DEFAULT 12 COMMENT 'Durée de validité en heures',
      ordre INT DEFAULT 0,
      actif BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Table checklist_periodique_types créée');

  // ─── Table catégories périodiques ───
  console.log('📋 Création table checklist_periodique_categories...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS checklist_periodique_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type_id INT NOT NULL,
      code VARCHAR(50) NOT NULL,
      nom VARCHAR(100) NOT NULL,
      ordre INT DEFAULT 0,
      actif BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (type_id) REFERENCES checklist_periodique_types(id),
      UNIQUE KEY unique_type_code (type_id, code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Table checklist_periodique_categories créée');

  // ─── Table items périodiques ───
  console.log('📋 Création table checklist_periodique_items...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS checklist_periodique_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      categorie_id INT NOT NULL,
      code VARCHAR(50) NOT NULL,
      libelle VARCHAR(255) NOT NULL,
      description TEXT,
      critique BOOLEAN DEFAULT FALSE,
      ordre INT DEFAULT 0,
      actif BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categorie_id) REFERENCES checklist_periodique_categories(id),
      UNIQUE KEY unique_cat_code (categorie_id, code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Table checklist_periodique_items créée');

  // ─── Table sessions de checklist (une session = une vérification) ───
  console.log('📋 Création table checklist_periodique_sessions...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS checklist_periodique_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type_id INT NOT NULL,
      operateur_id INT DEFAULT NULL,
      user_id INT DEFAULT NULL,
      statut ENUM('en_cours', 'validee', 'expiree') DEFAULT 'en_cours',
      date_debut DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_validation DATETIME DEFAULT NULL,
      date_expiration DATETIME DEFAULT NULL,
      commentaire TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (type_id) REFERENCES checklist_periodique_types(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Table checklist_periodique_sessions créée');

  // ─── Table validations items périodiques ───
  console.log('📋 Création table checklist_periodique_validations...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS checklist_periodique_validations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      item_id INT NOT NULL,
      statut ENUM('conforme', 'non_conforme', 'corrige', 'non_verifie') DEFAULT 'non_verifie',
      defaut_detecte TEXT,
      action_corrective TEXT,
      commentaire TEXT,
      date_verification DATETIME DEFAULT NULL,
      date_correction DATETIME DEFAULT NULL,
      operateur_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES checklist_periodique_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES checklist_periodique_items(id),
      UNIQUE KEY unique_session_item (session_id, item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Table checklist_periodique_validations créée');

  // ═══════════════════════════════════════
  // SEED : Checklist Début de Quart
  // ═══════════════════════════════════════
  console.log('\n🌱 Insertion des données de base...');

  // Type : Début de quart (12h de validité)
  await connection.query(`
    INSERT INTO checklist_periodique_types (code, nom, description, frequence, duree_validite_heures, ordre) VALUES
    ('DEBUT_QUART', 'Checklist Début de Quart', 'Vérification obligatoire avant chaque quart de travail', 'debut_quart', 12, 1),
    ('HEBDOMADAIRE', 'Checklist Hebdomadaire', 'Vérification approfondie hebdomadaire', 'hebdomadaire', 168, 2),
    ('MENSUELLE', 'Checklist Mensuelle', 'Inspection mensuelle complète', 'mensuelle', 720, 3)
    ON DUPLICATE KEY UPDATE nom = VALUES(nom)
  `);
  console.log('✅ 3 types de checklists créés');

  // ─── Catégories Début de Quart ───
  const [types] = await connection.query("SELECT id, code FROM checklist_periodique_types");
  const debutQuartId = types.find(t => t.code === 'DEBUT_QUART').id;
  const hebdoId = types.find(t => t.code === 'HEBDOMADAIRE').id;
  const mensuelId = types.find(t => t.code === 'MENSUELLE').id;

  // Catégories Début de Quart
  await connection.query(`
    INSERT INTO checklist_periodique_categories (type_id, code, nom, ordre) VALUES
    (${debutQuartId}, 'SECURITE_QUART', 'Sécurité Générale', 1),
    (${debutQuartId}, 'DEROULAGE_QUART', 'Système de Déroulage', 2),
    (${debutQuartId}, 'SOUDURE_QUART', 'Postes de Soudure', 3),
    (${debutQuartId}, 'FLUIDES_QUART', 'Fluides & Niveaux', 4),
    (${debutQuartId}, 'INSTRUMENTS_QUART', 'Instruments de Mesure', 5)
    ON DUPLICATE KEY UPDATE nom = VALUES(nom)
  `);

  // Catégories Hebdomadaire
  await connection.query(`
    INSERT INTO checklist_periodique_categories (type_id, code, nom, ordre) VALUES
    (${hebdoId}, 'MECANIQUE_HEBDO', 'Mécanique Générale', 1),
    (${hebdoId}, 'ELECTRIQUE_HEBDO', 'Électrique & Automatisme', 2),
    (${hebdoId}, 'CALIBRATION_HEBDO', 'Calibration Instruments', 3)
    ON DUPLICATE KEY UPDATE nom = VALUES(nom)
  `);

  // Catégories Mensuelle
  await connection.query(`
    INSERT INTO checklist_periodique_categories (type_id, code, nom, ordre) VALUES
    (${mensuelId}, 'STRUCTURE_MENSUEL', 'Structure & Fondations', 1),
    (${mensuelId}, 'HYDRAULIQUE_MENSUEL', 'Circuit Hydraulique', 2),
    (${mensuelId}, 'SECURITE_MENSUEL', 'Sécurité & Conformité', 3)
    ON DUPLICATE KEY UPDATE nom = VALUES(nom)
  `);
  console.log('✅ 11 catégories créées');

  // ─── Items Début de Quart ───
  const [cats] = await connection.query("SELECT id, code FROM checklist_periodique_categories");
  const catMap = {};
  cats.forEach(c => catMap[c.code] = c.id);

  // Sécurité Générale
  await connection.query(`
    INSERT INTO checklist_periodique_items (categorie_id, code, libelle, critique, ordre) VALUES
    (${catMap['SECURITE_QUART']}, 'SQ_01', 'Arrêts d\\'urgence testés et fonctionnels', TRUE, 1),
    (${catMap['SECURITE_QUART']}, 'SQ_02', 'Barrières de sécurité en place et verrouillées', TRUE, 2),
    (${catMap['SECURITE_QUART']}, 'SQ_03', 'EPI complets disponibles au poste', TRUE, 3),
    (${catMap['SECURITE_QUART']}, 'SQ_04', 'Zone de travail propre et dégagée', FALSE, 4),
    (${catMap['SECURITE_QUART']}, 'SQ_05', 'Extincteurs accessibles et vérifiés', TRUE, 5)
    ON DUPLICATE KEY UPDATE libelle = VALUES(libelle)
  `);

  // Système de Déroulage
  await connection.query(`
    INSERT INTO checklist_periodique_items (categorie_id, code, libelle, critique, ordre) VALUES
    (${catMap['DEROULAGE_QUART']}, 'DQ_01', 'Mandrin de déroulage : inspection visuelle', TRUE, 1),
    (${catMap['DEROULAGE_QUART']}, 'DQ_02', 'Frein de bobine : test fonctionnel', TRUE, 2),
    (${catMap['DEROULAGE_QUART']}, 'DQ_03', 'Guides d\\'entrée : absence d\\'usure excessive', FALSE, 3),
    (${catMap['DEROULAGE_QUART']}, 'DQ_04', 'Graissage des points de lubrification', FALSE, 4)
    ON DUPLICATE KEY UPDATE libelle = VALUES(libelle)
  `);

  // Postes de Soudure
  await connection.query(`
    INSERT INTO checklist_periodique_items (categorie_id, code, libelle, critique, ordre) VALUES
    (${catMap['SOUDURE_QUART']}, 'SOQ_01', 'Torche GMAW : état de la buse et du tube contact', TRUE, 1),
    (${catMap['SOUDURE_QUART']}, 'SOQ_02', 'Débit de gaz CO₂ vérifié', TRUE, 2),
    (${catMap['SOUDURE_QUART']}, 'SOQ_03', 'Fil de soudure : déroulement sans blocage', FALSE, 3),
    (${catMap['SOUDURE_QUART']}, 'SOQ_04', 'Têtes SAW : inspection visuelle int/ext', TRUE, 4),
    (${catMap['SOUDURE_QUART']}, 'SOQ_05', 'Niveau et qualité du flux SAW', FALSE, 5)
    ON DUPLICATE KEY UPDATE libelle = VALUES(libelle)
  `);

  // Fluides & Niveaux
  await connection.query(`
    INSERT INTO checklist_periodique_items (categorie_id, code, libelle, critique, ordre) VALUES
    (${catMap['FLUIDES_QUART']}, 'FQ_01', 'Niveau bac de refroidissement vérifié', TRUE, 1),
    (${catMap['FLUIDES_QUART']}, 'FQ_02', 'Température liquide de refroidissement OK', FALSE, 2),
    (${catMap['FLUIDES_QUART']}, 'FQ_03', 'Pression hydraulique dans les normes', TRUE, 3),
    (${catMap['FLUIDES_QUART']}, 'FQ_04', 'Pas de fuite visible sur circuits', FALSE, 4)
    ON DUPLICATE KEY UPDATE libelle = VALUES(libelle)
  `);

  // Instruments de Mesure
  await connection.query(`
    INSERT INTO checklist_periodique_items (categorie_id, code, libelle, critique, ordre) VALUES
    (${catMap['INSTRUMENTS_QUART']}, 'IQ_01', 'Capteurs de vitesse ligne : test signal', TRUE, 1),
    (${catMap['INSTRUMENTS_QUART']}, 'IQ_02', 'Système d\\'acquisition données actif', FALSE, 2),
    (${catMap['INSTRUMENTS_QUART']}, 'IQ_03', 'Contrôle dimensionnel prêt', TRUE, 3)
    ON DUPLICATE KEY UPDATE libelle = VALUES(libelle)
  `);

  // ─── Items Hebdomadaire ───
  await connection.query(`
    INSERT INTO checklist_periodique_items (categorie_id, code, libelle, critique, ordre) VALUES
    (${catMap['MECANIQUE_HEBDO']}, 'MH_01', 'Inspection courroies et chaînes de transmission', TRUE, 1),
    (${catMap['MECANIQUE_HEBDO']}, 'MH_02', 'Vérification jeux des roulements principaux', TRUE, 2),
    (${catMap['MECANIQUE_HEBDO']}, 'MH_03', 'Contrôle usure des rouleaux de formage', TRUE, 3),
    (${catMap['MECANIQUE_HEBDO']}, 'MH_04', 'Serrage des fixations critiques', FALSE, 4),
    (${catMap['ELECTRIQUE_HEBDO']}, 'EH_01', 'Test des variateurs de fréquence', TRUE, 1),
    (${catMap['ELECTRIQUE_HEBDO']}, 'EH_02', 'Inspection câblage et connexions', FALSE, 2),
    (${catMap['ELECTRIQUE_HEBDO']}, 'EH_03', 'Test automates et séquences de sécurité', TRUE, 3),
    (${catMap['CALIBRATION_HEBDO']}, 'CH_01', 'Calibration jauges d\\'épaisseur', TRUE, 1),
    (${catMap['CALIBRATION_HEBDO']}, 'CH_02', 'Vérification capteurs de pression', TRUE, 2),
    (${catMap['CALIBRATION_HEBDO']}, 'CH_03', 'Test système de détection de défauts', TRUE, 3)
    ON DUPLICATE KEY UPDATE libelle = VALUES(libelle)
  `);

  // ─── Items Mensuelle ───
  await connection.query(`
    INSERT INTO checklist_periodique_items (categorie_id, code, libelle, critique, ordre) VALUES
    (${catMap['STRUCTURE_MENSUEL']}, 'SM_01', 'Inspection fondations et ancrages machine', TRUE, 1),
    (${catMap['STRUCTURE_MENSUEL']}, 'SM_02', 'Vérification alignement général de la ligne', TRUE, 2),
    (${catMap['STRUCTURE_MENSUEL']}, 'SM_03', 'Contrôle soudures de structure', FALSE, 3),
    (${catMap['HYDRAULIQUE_MENSUEL']}, 'HM_01', 'Analyse huile hydraulique', TRUE, 1),
    (${catMap['HYDRAULIQUE_MENSUEL']}, 'HM_02', 'Remplacement filtres hydrauliques', FALSE, 2),
    (${catMap['HYDRAULIQUE_MENSUEL']}, 'HM_03', 'Test pression de décharge des soupapes', TRUE, 3),
    (${catMap['SECURITE_MENSUEL']}, 'SCM_01', 'Audit complet dispositifs de sécurité', TRUE, 1),
    (${catMap['SECURITE_MENSUEL']}, 'SCM_02', 'Test système incendie et détection', TRUE, 2),
    (${catMap['SECURITE_MENSUEL']}, 'SCM_03', 'Vérification conformité réglementaire', TRUE, 3),
    (${catMap['SECURITE_MENSUEL']}, 'SCM_04', 'Mise à jour registre de sécurité', FALSE, 4)
    ON DUPLICATE KEY UPDATE libelle = VALUES(libelle)
  `);

  // Compter
  const [countItems] = await connection.query("SELECT COUNT(*) as c FROM checklist_periodique_items");
  const [countCritiques] = await connection.query("SELECT COUNT(*) as c FROM checklist_periodique_items WHERE critique = 1");
  console.log(`✅ ${countItems[0].c} items créés (${countCritiques[0].c} critiques)`);

  console.log('\n🎉 Migration checklists périodiques terminée !');
  await connection.end();
}

migrate().catch(err => {
  console.error('❌ Erreur migration:', err);
  process.exit(1);
});
