const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateCouleeNumero() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'logitrack'
  });

  try {
    // Afficher les coulées existantes
    const [coulees] = await pool.query('SELECT id, numero FROM coulees ORDER BY id');
    console.log('Coulées trouvées:', coulees);
    
    // Mettre à jour toutes les coulées avec le numéro 47 comme base
    let compteur = 47;
    for (const coulee of coulees) {
      await pool.query('UPDATE coulees SET numero = ? WHERE id = ?', [String(compteur), coulee.id]);
      console.log(`Coulée ${coulee.id}: ${coulee.numero} → ${compteur}`);
      compteur++;
    }
    
    console.log('Mise à jour terminée !');
    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

updateCouleeNumero();
