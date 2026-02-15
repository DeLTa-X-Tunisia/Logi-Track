/**
 * Migration: Ajouter type_fil individuel par tête de soudure
 * Chaque tête (ID/OD) peut désormais avoir son propre type de fil
 * Par défaut: 3.2mm
 */

const pool = require('../config/database');

async function migrate() {
  const conn = await pool.getConnection();

  try {
    console.log('🔧 Migration: Type de fil par tête de soudure...\n');

    // Vérifier si la colonne existe déjà
    const [cols] = await conn.query(
      `SHOW COLUMNS FROM parametres_soudure_heads WHERE Field = 'type_fil'`
    );

    if (cols.length === 0) {
      await conn.query(`
        ALTER TABLE parametres_soudure_heads 
        ADD COLUMN type_fil ENUM('1.0mm','1.2mm','1.6mm','2.0mm','2.4mm','3.2mm','4.0mm') 
        DEFAULT '3.2mm' 
        AFTER voltage
      `);
      console.log('✅ Colonne type_fil ajoutée à parametres_soudure_heads (défaut: 3.2mm)');

      // Migrer les données existantes: copier la valeur globale vers chaque tête
      const [presets] = await conn.query(
        `SELECT id, soudure_type_fil FROM parametres_production`
      );

      for (const preset of presets) {
        const fil = preset.soudure_type_fil || '3.2mm';
        await conn.query(
          `UPDATE parametres_soudure_heads SET type_fil = ? WHERE parametre_id = ?`,
          [fil, preset.id]
        );
      }
      console.log(`✅ ${presets.length} preset(s) migrés — type_fil copié depuis la valeur globale`);
    } else {
      console.log('ℹ️  Colonne type_fil existe déjà dans parametres_soudure_heads');
    }

    console.log('\n✅ Migration type_fil par tête terminée avec succès!');
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
