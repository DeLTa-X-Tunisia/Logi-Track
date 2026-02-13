/**
 * Script d'initialisation de la base de données LogiTrack
 * Suivi de production et certification API 5L des tubes spirale
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
  let connection;
  
  try {
    // Connexion sans spécifier la base de données
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         📦 INITIALISATION BASE DE DONNÉES LOGITRACK 📦        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    const dbName = process.env.DB_NAME || 'logitrack';

    // Créer la base de données
    console.log(`📂 Création de la base de données '${dbName}'...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${dbName}`);
    console.log('✅ Base de données créée/sélectionnée');

    // Table des utilisateurs (admins)
    console.log('📋 Création de la table users...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        role ENUM('admin', 'superviseur', 'qualite') DEFAULT 'superviseur',
        actif BOOLEAN DEFAULT TRUE,
        derniere_connexion DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des opérateurs
    console.log('📋 Création de la table operateurs...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS operateurs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(6) UNIQUE NOT NULL COMMENT 'Code à 6 chiffres pour connexion',
        matricule VARCHAR(50) UNIQUE NOT NULL,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        poste ENUM('formage', 'soudage', 'controle', 'xray', 'chanfreinage', 'hydraulique', 'polyvalent') DEFAULT 'polyvalent',
        equipe ENUM('A', 'B', 'C', 'jour') DEFAULT 'jour',
        actif BOOLEAN DEFAULT TRUE,
        derniere_connexion DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des steel grades (nuances d'acier API 5L)
    console.log('📋 Création de la table steel_grades...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS steel_grades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL COMMENT 'Ex: X42, X52, X60, X65, X70',
        nom VARCHAR(100) NOT NULL,
        limite_elastique_min DECIMAL(10,2) COMMENT 'MPa',
        limite_elastique_max DECIMAL(10,2) COMMENT 'MPa',
        resistance_traction_min DECIMAL(10,2) COMMENT 'MPa',
        resistance_traction_max DECIMAL(10,2) COMMENT 'MPa',
        allongement_min DECIMAL(5,2) COMMENT '%',
        carbone_max DECIMAL(5,3) COMMENT '%',
        manganese_max DECIMAL(5,3) COMMENT '%',
        phosphore_max DECIMAL(5,4) COMMENT '%',
        soufre_max DECIMAL(5,4) COMMENT '%',
        specification VARCHAR(50) DEFAULT 'API 5L',
        psl ENUM('PSL1', 'PSL2') DEFAULT 'PSL2',
        actif BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des bobines
    console.log('📋 Création de la table bobines...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bobines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numero VARCHAR(50) UNIQUE NOT NULL,
        coulée VARCHAR(50) NOT NULL,
        steel_grade_id INT,
        epaisseur DECIMAL(6,2) NOT NULL COMMENT 'mm',
        largeur DECIMAL(8,2) NOT NULL COMMENT 'mm',
        poids DECIMAL(10,2) COMMENT 'kg',
        longueur DECIMAL(10,2) COMMENT 'm',
        fournisseur VARCHAR(100),
        date_reception DATE,
        certificat_matiere VARCHAR(255) COMMENT 'Chemin du fichier PDF',
        statut ENUM('en_stock', 'en_cours', 'epuisee') DEFAULT 'en_stock',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (steel_grade_id) REFERENCES steel_grades(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des étapes de production (workflow API 5L)
    console.log('📋 Création de la table etapes_production...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS etapes_production (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        nom VARCHAR(100) NOT NULL,
        description TEXT,
        ordre INT NOT NULL COMMENT 'Ordre dans le workflow',
        obligatoire BOOLEAN DEFAULT TRUE,
        duree_estimee INT COMMENT 'Minutes',
        icon VARCHAR(50),
        color VARCHAR(20),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des tubes
    console.log('📋 Création de la table tubes...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tubes (
        id VARCHAR(36) PRIMARY KEY,
        numero VARCHAR(50) UNIQUE NOT NULL,
        bobine_id INT,
        steel_grade_id INT,
        type_tube ENUM('SAWH', 'SAWL', 'ERW') DEFAULT 'SAWH' COMMENT 'Spirale Haute Fréquence, Longitudinal, ERW',
        diametre_nominal DECIMAL(8,2) COMMENT 'mm',
        epaisseur DECIMAL(6,2) COMMENT 'mm',
        longueur_cible DECIMAL(8,2) COMMENT 'm',
        longueur_reelle DECIMAL(8,2) COMMENT 'm',
        poids DECIMAL(10,2) COMMENT 'kg',
        etape_actuelle_id INT,
        statut ENUM('en_cours', 'termine', 'rebut', 'reparation', 'attente') DEFAULT 'en_cours',
        conformite_api5l BOOLEAN DEFAULT NULL,
        date_certification DATETIME,
        numero_certificat VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (bobine_id) REFERENCES bobines(id),
        FOREIGN KEY (steel_grade_id) REFERENCES steel_grades(id),
        FOREIGN KEY (etape_actuelle_id) REFERENCES etapes_production(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table de suivi des étapes par tube
    console.log('📋 Création de la table suivi_tubes...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS suivi_tubes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tube_id VARCHAR(36) NOT NULL,
        etape_id INT NOT NULL,
        statut ENUM('en_cours', 'termine', 'echec', 'en_attente', 'reparation') DEFAULT 'en_attente',
        operateur_id INT,
        date_debut DATETIME,
        date_fin DATETIME,
        commentaire TEXT,
        resultat_conforme BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tube_id) REFERENCES tubes(id) ON DELETE CASCADE,
        FOREIGN KEY (etape_id) REFERENCES etapes_production(id),
        FOREIGN KEY (operateur_id) REFERENCES operateurs(id),
        UNIQUE KEY unique_tube_etape (tube_id, etape_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des mesures et contrôles
    console.log('📋 Création de la table mesures...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mesures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tube_id VARCHAR(36) NOT NULL,
        etape_id INT NOT NULL,
        type_mesure VARCHAR(50) NOT NULL COMMENT 'Ex: diametre_ext, epaisseur, ovalisation, etc.',
        valeur DECIMAL(12,4) NOT NULL,
        unite VARCHAR(20) DEFAULT 'mm',
        valeur_min DECIMAL(12,4) COMMENT 'Tolérance min',
        valeur_max DECIMAL(12,4) COMMENT 'Tolérance max',
        conforme BOOLEAN,
        position VARCHAR(50) COMMENT 'Ex: bout_A, bout_B, milieu',
        operateur_id INT,
        date_mesure DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tube_id) REFERENCES tubes(id) ON DELETE CASCADE,
        FOREIGN KEY (etape_id) REFERENCES etapes_production(id),
        FOREIGN KEY (operateur_id) REFERENCES operateurs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des contrôles X-Ray
    console.log('📋 Création de la table controles_xray...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS controles_xray (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tube_id VARCHAR(36) NOT NULL,
        numero_film VARCHAR(50),
        type_soudure ENUM('spirale', 'longitudinale', 'circulaire') DEFAULT 'spirale',
        position_debut DECIMAL(8,2) COMMENT 'mm depuis bout A',
        position_fin DECIMAL(8,2) COMMENT 'mm depuis bout A',
        resultat ENUM('acceptable', 'reparable', 'rebut') DEFAULT 'acceptable',
        type_defaut VARCHAR(100),
        taille_defaut DECIMAL(6,2),
        operateur_id INT,
        date_controle DATETIME DEFAULT CURRENT_TIMESTAMP,
        image_path VARCHAR(255),
        commentaire TEXT,
        FOREIGN KEY (tube_id) REFERENCES tubes(id) ON DELETE CASCADE,
        FOREIGN KEY (operateur_id) REFERENCES operateurs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des tests hydrauliques
    console.log('📋 Création de la table tests_hydrauliques...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tests_hydrauliques (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tube_id VARCHAR(36) NOT NULL,
        pression_test DECIMAL(8,2) NOT NULL COMMENT 'bar',
        pression_epreuve DECIMAL(8,2) COMMENT 'bar - pression API 5L calculée',
        duree_maintien INT DEFAULT 10 COMMENT 'secondes',
        resultat ENUM('conforme', 'fuite', 'echec') DEFAULT 'conforme',
        temperature_eau DECIMAL(5,2) COMMENT '°C',
        operateur_id INT,
        date_test DATETIME DEFAULT CURRENT_TIMESTAMP,
        commentaire TEXT,
        FOREIGN KEY (tube_id) REFERENCES tubes(id) ON DELETE CASCADE,
        FOREIGN KEY (operateur_id) REFERENCES operateurs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Table des alertes (pour Socket.io)
    console.log('📋 Création de la table alertes...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS alertes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
        titre VARCHAR(200) NOT NULL,
        message TEXT,
        tube_id VARCHAR(36),
        etape_id INT,
        lu BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tube_id) REFERENCES tubes(id) ON DELETE SET NULL,
        FOREIGN KEY (etape_id) REFERENCES etapes_production(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insertion des données initiales
    console.log('');
    console.log('📥 Insertion des données initiales...');

    // Étapes de production API 5L
    await connection.query(`
      INSERT IGNORE INTO etapes_production (code, nom, description, ordre, obligatoire, duree_estimee, icon, color) VALUES
      ('FORMAGE', 'Formage', 'Formage du tube spirale à partir de la bobine', 1, TRUE, 30, 'Cylinder', 'blue'),
      ('CTRL_VISUEL', 'Contrôle Visuel', 'Inspection visuelle du tube formé', 2, TRUE, 10, 'Eye', 'purple'),
      ('SOUDAGE', 'Soudage', 'Soudage de la soudure spirale (intérieur et extérieur)', 3, TRUE, 45, 'Flame', 'orange'),
      ('XRAY', 'Contrôle X-Ray', 'Radiographie des soudures selon API 5L', 4, TRUE, 20, 'Scan', 'red'),
      ('CHANFREINAGE', 'Chanfreinage', 'Usinage des extrémités du tube', 5, TRUE, 15, 'Scissors', 'green'),
      ('TEST_HYDRO', 'Test Hydraulique', 'Épreuve hydrostatique selon API 5L', 6, TRUE, 10, 'Droplet', 'cyan'),
      ('CTRL_FINAL', 'Contrôle Final', 'Vérification finale et marquage', 7, TRUE, 15, 'CheckCircle', 'emerald'),
      ('CERTIFICATION', 'Certification', 'Émission du certificat API 5L', 8, TRUE, 5, 'Award', 'gold')
    `);
    console.log('✅ Étapes de production insérées');

    // Steel grades API 5L
    await connection.query(`
      INSERT IGNORE INTO steel_grades (code, nom, limite_elastique_min, resistance_traction_min, specification, psl) VALUES
      ('B', 'Grade B', 245, 415, 'API 5L', 'PSL1'),
      ('X42', 'Grade X42', 290, 415, 'API 5L', 'PSL2'),
      ('X46', 'Grade X46', 317, 435, 'API 5L', 'PSL2'),
      ('X52', 'Grade X52', 359, 455, 'API 5L', 'PSL2'),
      ('X56', 'Grade X56', 386, 490, 'API 5L', 'PSL2'),
      ('X60', 'Grade X60', 415, 520, 'API 5L', 'PSL2'),
      ('X65', 'Grade X65', 450, 535, 'API 5L', 'PSL2'),
      ('X70', 'Grade X70', 485, 570, 'API 5L', 'PSL2'),
      ('X80', 'Grade X80', 555, 625, 'API 5L', 'PSL2')
    `);
    console.log('✅ Steel grades API 5L insérés');

    // Créer l'admin par défaut
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await connection.query(`
      INSERT IGNORE INTO users (username, email, password, nom, prenom, role) VALUES
      ('admin', 'admin@logitrack.com', ?, 'Administrateur', 'LogiTrack', 'admin')
    `, [hashedPassword]);
    console.log('✅ Utilisateur admin créé (admin / admin123)');

    // Créer quelques opérateurs de test
    await connection.query(`
      INSERT IGNORE INTO operateurs (code, matricule, nom, prenom, poste, equipe) VALUES
      ('123456', 'OP001', 'Martin', 'Jean', 'formage', 'A'),
      ('234567', 'OP002', 'Dubois', 'Pierre', 'soudage', 'A'),
      ('345678', 'OP003', 'Bernard', 'Marie', 'controle', 'B'),
      ('456789', 'OP004', 'Petit', 'Paul', 'xray', 'B'),
      ('567890', 'OP005', 'Robert', 'Sophie', 'hydraulique', 'jour')
    `);
    console.log('✅ Opérateurs de test créés');

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     ✅  INITIALISATION TERMINÉE AVEC SUCCÈS  ✅               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log('║   Connexion Admin:                                            ║');
    console.log('║   👤 Username: admin                                          ║');
    console.log('║   🔑 Password: admin123                                       ║');
    console.log('║                                                               ║');
    console.log('║   Codes opérateurs de test:                                   ║');
    console.log('║   123456, 234567, 345678, 456789, 567890                      ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

initDatabase();
