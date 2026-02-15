/**
 * Migration: Ajout des index de performance + table audit_trail
 * LogiTrack - Amélioration performance & traçabilité
 */

const pool = require('../config/database');

async function migrate() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   📊 MIGRATION: Index de performance + Audit Trail           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // ─── Index de performance ────────────────────────────────
    const indexes = [
      { table: 'tubes',       column: 'statut',         name: 'idx_tubes_statut' },
      { table: 'tubes',       column: 'coulee_id',      name: 'idx_tubes_coulee_id' },
      { table: 'tubes',       column: 'etape_courante',  name: 'idx_tubes_etape_courante' },
      { table: 'tubes',       column: 'created_at',      name: 'idx_tubes_created_at' },
      { table: 'tubes',       column: 'decision',        name: 'idx_tubes_decision' },
      { table: 'tube_etapes', column: 'tube_id',         name: 'idx_tube_etapes_tube_id' },
      { table: 'tube_etapes', column: 'etape_numero',    name: 'idx_tube_etapes_etape_numero' },
      { table: 'bobines',     column: 'statut',          name: 'idx_bobines_statut' },
      { table: 'coulees',     column: 'statut',          name: 'idx_coulees_statut' },
      { table: 'coulees',     column: 'bobine_id',       name: 'idx_coulees_bobine_id' },
      { table: 'notifications', column: 'lu',            name: 'idx_notifications_lu' },
      { table: 'notifications', column: 'created_at',    name: 'idx_notifications_created_at' },
    ];

    for (const idx of indexes) {
      try {
        await pool.query(`CREATE INDEX ${idx.name} ON ${idx.table} (${idx.column})`);
        console.log(`  ✅ Index ${idx.name} créé sur ${idx.table}.${idx.column}`);
      } catch (e) {
        if (e.code === 'ER_DUP_KEYNAME') {
          console.log(`  ⏭️  Index ${idx.name} existe déjà`);
        } else if (e.code === 'ER_NO_SUCH_TABLE') {
          console.log(`  ⚠️  Table ${idx.table} n'existe pas encore, index ignoré`);
        } else {
          console.log(`  ⚠️  Index ${idx.name}: ${e.message}`);
        }
      }
    }

    // Index composé pour optimiser le listing tubes
    try {
      await pool.query(`CREATE INDEX idx_tubes_statut_created ON tubes (statut, created_at DESC)`);
      console.log('  ✅ Index composé idx_tubes_statut_created créé');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') console.log('  ⏭️  Index composé existe déjà');
      else console.log(`  ⚠️  ${e.message}`);
    }

    // ─── Table Audit Trail ──────────────────────────────────
    console.log('');
    console.log('📋 Création de la table audit_trail...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(50) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, VALIDATE, CERTIFY, LOGIN, etc.',
        entite VARCHAR(50) NOT NULL COMMENT 'tube, bobine, coulee, checklist, user, etc.',
        entite_id VARCHAR(36) COMMENT 'ID de l''entité concernée',
        user_id INT COMMENT 'ID utilisateur (users.id)',
        operateur_id INT COMMENT 'ID opérateur (operateurs.id)',
        user_name VARCHAR(100) COMMENT 'Nom complet pour affichage rapide',
        details JSON COMMENT 'Détails du changement (ancien/nouveau)',
        ip_address VARCHAR(45),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_entite (entite, entite_id),
        INDEX idx_audit_action (action),
        INDEX idx_audit_user (user_id),
        INDEX idx_audit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ Table audit_trail créée');

    console.log('');
    console.log('✅ Migration terminée avec succès !');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur migration:', error);
  }

  process.exit(0);
}

migrate();
