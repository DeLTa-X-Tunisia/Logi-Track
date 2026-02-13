const mysql = require('mysql2/promise');

async function migrateFournisseurs() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'logitrack',
    charset: 'utf8mb4'
  });

  try {
    console.log('🔄 Création de la table fournisseurs...');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS fournisseurs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(255) NOT NULL UNIQUE,
        actif TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table fournisseurs créée');

    // Migrer les fournisseurs existants depuis la table bobines
    const [existing] = await connection.execute(`
      SELECT DISTINCT fournisseur FROM bobines 
      WHERE fournisseur IS NOT NULL AND fournisseur != '' 
      ORDER BY fournisseur
    `);

    if (existing.length > 0) {
      for (const row of existing) {
        await connection.execute(
          `INSERT IGNORE INTO fournisseurs (nom) VALUES (?)`,
          [row.fournisseur]
        );
      }
      console.log(`✅ ${existing.length} fournisseur(s) existant(s) migré(s)`);
    } else {
      console.log('ℹ️  Aucun fournisseur existant à migrer');
    }

    // Vérification
    const [count] = await connection.execute('SELECT COUNT(*) as total FROM fournisseurs');
    console.log(`📊 Total fournisseurs: ${count[0].total}`);

    console.log('✅ Migration fournisseurs terminée !');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await connection.end();
  }
}

migrateFournisseurs();
