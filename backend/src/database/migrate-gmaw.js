/**
 * Migration: Restructuration catégorie Soudage → GMAW + Soudure Finale
 * 
 * Contexte métier:
 * - GMAW (Gas Metal Arc Welding) = Tack welding durant le formage
 *   → Contrôle tête de soudure, CO₂, vitesse, paramètres
 * - Soudure Finale SAW (Submerged Arc Welding) = Soudure intérieure/extérieure
 *   → Contrôle arc submergé, flux, paramètres post-formage
 * 
 * Cette migration:
 * 1. Remplace la catégorie SOUDAGE générique par deux catégories spécialisées
 * 2. Supprime les anciens items (terminologie incorrecte: "électrodes")
 * 3. Insère les items GMAW et Soudure Finale avec traçabilité critique
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateGMAW() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'logitrack'
  });

  try {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   🔥 MIGRATION: Soudage → GMAW + Soudure Finale            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // ─── 1. Supprimer les validations existantes liées aux anciens items SOUDAGE ──
    console.log('1. Nettoyage des validations liées aux anciens items SOUDAGE...');
    
    // Récupérer l'ID de la catégorie SOUDAGE actuelle
    const [oldCat] = await pool.query(
      "SELECT id FROM checklist_categories WHERE code = 'SOUDAGE'"
    );

    if (oldCat.length > 0) {
      const oldCatId = oldCat[0].id;

      // Supprimer les validations liées aux items de l'ancienne catégorie SOUDAGE
      await pool.query(`
        DELETE cv FROM checklist_validations cv
        INNER JOIN checklist_items ci ON cv.item_id = ci.id
        WHERE ci.categorie_id = ?
      `, [oldCatId]);
      console.log('   ✅ Validations anciennes supprimées');

      // Supprimer les anciens items SOUDAGE
      await pool.query(
        'DELETE FROM checklist_items WHERE categorie_id = ?',
        [oldCatId]
      );
      console.log('   ✅ Anciens items SOUDAGE supprimés (SOU_001 à SOU_004)');

      // Supprimer l'ancienne catégorie
      await pool.query(
        'DELETE FROM checklist_categories WHERE id = ?',
        [oldCatId]
      );
      console.log('   ✅ Ancienne catégorie SOUDAGE supprimée');
    } else {
      console.log('   ℹ️  Catégorie SOUDAGE non trouvée (déjà migrée ou absente)');
    }

    // ─── 2. Réorganiser les ordres des catégories existantes ────────────
    console.log('\n2. Réorganisation des catégories...');
    
    // Nouvel ordre:
    // 1. DEROULAGE → Système de Déroulage
    // 2. GMAW → Soudure GMAW (Tack Welding)       ← NOUVEAU
    // 3. FORMAGE → Section Formage
    // 4. SOUDURE_FINALE → Soudure Finale SAW       ← NOUVEAU
    // 5. REFROIDISSEMENT → Circuit de Refroidissement
    // 6. CONTROLE → Équipements de Contrôle
    // 7. SECURITE → Sécurité & EPI

    await pool.query("UPDATE checklist_categories SET ordre = 1 WHERE code = 'DEROULAGE'");
    await pool.query("UPDATE checklist_categories SET ordre = 3 WHERE code = 'FORMAGE'");
    await pool.query("UPDATE checklist_categories SET ordre = 5 WHERE code = 'REFROIDISSEMENT'");
    await pool.query("UPDATE checklist_categories SET ordre = 6 WHERE code = 'CONTROLE'");
    await pool.query("UPDATE checklist_categories SET ordre = 7 WHERE code = 'SECURITE'");
    console.log('   ✅ Ordres existants mis à jour');

    // ─── 3. Créer la catégorie GMAW ────────────────────────────────────
    console.log('\n3. Création catégorie GMAW (Tack Welding)...');
    await pool.query(`
      INSERT INTO checklist_categories (code, nom, ordre, actif)
      VALUES ('GMAW', 'Soudure GMAW — Tack Welding', 2, TRUE)
      ON DUPLICATE KEY UPDATE nom = VALUES(nom), ordre = VALUES(ordre)
    `);

    const [gmawCats] = await pool.query("SELECT id FROM checklist_categories WHERE code = 'GMAW'");
    const gmawCatId = gmawCats[0].id;
    console.log(`   ✅ Catégorie GMAW créée (id: ${gmawCatId})`);

    // ─── 4. Créer la catégorie SOUDURE_FINALE ──────────────────────────
    console.log('\n4. Création catégorie Soudure Finale SAW...');
    await pool.query(`
      INSERT INTO checklist_categories (code, nom, ordre, actif)
      VALUES ('SOUDURE_FINALE', 'Soudure Finale — SAW (Int/Ext)', 4, TRUE)
      ON DUPLICATE KEY UPDATE nom = VALUES(nom), ordre = VALUES(ordre)
    `);

    const [sawCats] = await pool.query("SELECT id FROM checklist_categories WHERE code = 'SOUDURE_FINALE'");
    const sawCatId = sawCats[0].id;
    console.log(`   ✅ Catégorie SOUDURE_FINALE créée (id: ${sawCatId})`);

    // ─── 5. Insérer les items GMAW (Tack Welding) ──────────────────────
    console.log('\n5. Insertion des items GMAW...');
    const gmawItems = [
      {
        code: 'GMAW_001',
        libelle: 'Tête de soudure GMAW en bon état (buse, tube contact, diffuseur)',
        description: 'Vérifier l\'état de la buse, du tube contact et du diffuseur de gaz. Remplacer si usure visible.',
        critique: true,
        ordre: 1
      },
      {
        code: 'GMAW_002',
        libelle: 'Alimentation CO₂ : pression et débit conformes',
        description: 'Vérifier pression bouteille CO₂ > 5 bar, débit de gaz entre 15-25 L/min selon spécification WPS.',
        critique: true,
        ordre: 2
      },
      {
        code: 'GMAW_003',
        libelle: 'Fil de soudure GMAW : type, diamètre et déroulement corrects',
        description: 'Vérifier que le fil correspond à la spécification WPS (type, Ø). Contrôler le déroulement sans accroc.',
        critique: true,
        ordre: 3
      },
      {
        code: 'GMAW_004',
        libelle: 'Paramètres GMAW conformes (intensité, tension, vitesse de fil)',
        description: 'Valider les paramètres de soudage selon la WPS : intensité (A), tension (V), vitesse de fil (m/min).',
        critique: true,
        ordre: 4
      },
      {
        code: 'GMAW_005',
        libelle: 'Vitesse d\'avance du tack welding vérifiée',
        description: 'Contrôler la vitesse d\'avance de soudage pour garantir la pénétration et la régularité du cordon de pointage.',
        critique: true,
        ordre: 5
      },
      {
        code: 'GMAW_006',
        libelle: 'Position et alignement de la torche GMAW',
        description: 'Vérifier le stick-out (distance tube contact / pièce), l\'angle de la torche et le centrage sur le joint.',
        critique: true,
        ordre: 6
      },
      {
        code: 'GMAW_007',
        libelle: 'Circuit de refroidissement torche opérationnel',
        description: 'Vérifier la circulation du liquide de refroidissement de la torche GMAW (si torche refroidie).',
        critique: false,
        ordre: 7
      },
      {
        code: 'GMAW_008',
        libelle: 'Système d\'extraction fumées GMAW fonctionnel',
        description: 'Vérifier le bon fonctionnement de l\'aspiration des fumées au poste GMAW.',
        critique: false,
        ordre: 8
      }
    ];

    for (const item of gmawItems) {
      await pool.query(`
        INSERT INTO checklist_items (categorie_id, code, libelle, description, critique, ordre)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          libelle = VALUES(libelle),
          description = VALUES(description),
          critique = VALUES(critique),
          ordre = VALUES(ordre),
          categorie_id = VALUES(categorie_id)
      `, [gmawCatId, item.code, item.libelle, item.description, item.critique, item.ordre]);
    }
    console.log(`   ✅ ${gmawItems.length} items GMAW insérés (${gmawItems.filter(i => i.critique).length} critiques)`);

    // ─── 6. Insérer les items Soudure Finale SAW ───────────────────────
    console.log('\n6. Insertion des items Soudure Finale SAW...');
    const sawItems = [
      {
        code: 'SAW_001',
        libelle: 'Têtes de soudure SAW intérieure et extérieure en bon état',
        description: 'Vérifier l\'état des buses, guides fil et supports des têtes SAW (ID et OD).',
        critique: true,
        ordre: 1
      },
      {
        code: 'SAW_002',
        libelle: 'Flux de soudage SAW : type conforme et stock suffisant',
        description: 'Vérifier le type de flux selon WPS, quantité disponible, et absence d\'humidité (stockage étuve si requis).',
        critique: true,
        ordre: 2
      },
      {
        code: 'SAW_003',
        libelle: 'Fil de soudure SAW : type et diamètre conformes',
        description: 'Vérifier que le fil SAW (ID et OD) correspond à la WPS (nuance, Ø). Contrôler l\'état des bobines.',
        critique: true,
        ordre: 3
      },
      {
        code: 'SAW_004',
        libelle: 'Paramètres SAW conformes (intensité, tension, vitesse)',
        description: 'Valider les paramètres selon WPS pour soudure intérieure et extérieure : intensité, tension, vitesse.',
        critique: true,
        ordre: 4
      },
      {
        code: 'SAW_005',
        libelle: 'Système de récupération et recyclage du flux opérationnel',
        description: 'Vérifier le fonctionnement du système d\'aspiration, tri et recirculation du flux SAW.',
        critique: false,
        ordre: 5
      },
      {
        code: 'SAW_006',
        libelle: 'Alignement des têtes SAW sur le joint de soudure',
        description: 'Vérifier le centrage des têtes intérieure et extérieure sur le cordon. Régler si décalage > tolérance.',
        critique: true,
        ordre: 6
      },
      {
        code: 'SAW_007',
        libelle: 'Système d\'extraction des fumées SAW opérationnel',
        description: 'Vérifier le bon fonctionnement de la ventilation et aspiration au poste de soudure finale.',
        critique: false,
        ordre: 7
      }
    ];

    for (const item of sawItems) {
      await pool.query(`
        INSERT INTO checklist_items (categorie_id, code, libelle, description, critique, ordre)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          libelle = VALUES(libelle),
          description = VALUES(description),
          critique = VALUES(critique),
          ordre = VALUES(ordre),
          categorie_id = VALUES(categorie_id)
      `, [sawCatId, item.code, item.libelle, item.description, item.critique, item.ordre]);
    }
    console.log(`   ✅ ${sawItems.length} items SAW insérés (${sawItems.filter(i => i.critique).length} critiques)`);

    // ─── 7. Résumé ─────────────────────────────────────────────────────
    const [totalCats] = await pool.query('SELECT COUNT(*) as count FROM checklist_categories WHERE actif = TRUE');
    const [totalItems] = await pool.query('SELECT COUNT(*) as count FROM checklist_items WHERE actif = TRUE');
    const [critItems] = await pool.query('SELECT COUNT(*) as count FROM checklist_items WHERE actif = TRUE AND critique = TRUE');

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ MIGRATION SOUDAGE TERMINÉE AVEC SUCCÈS                 ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log('║   Nouvelle structure:                                         ║');
    console.log('║   1. Système de Déroulage                                     ║');
    console.log('║   2. Soudure GMAW — Tack Welding  ← NOUVEAU (8 items)        ║');
    console.log('║   3. Section Formage                                          ║');
    console.log('║   4. Soudure Finale — SAW (Int/Ext) ← NOUVEAU (7 items)      ║');
    console.log('║   5. Circuit de Refroidissement                               ║');
    console.log('║   6. Équipements de Contrôle                                  ║');
    console.log('║   7. Sécurité & EPI                                           ║');
    console.log('║                                                               ║');
    console.log(`║   Total: ${totalCats[0].count} catégories | ${totalItems[0].count} items | ${critItems[0].count} critiques         ║`);
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    process.exit(1);
  }
}

migrateGMAW();
