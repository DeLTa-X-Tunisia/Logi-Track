const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Note: L'authentification est appliquée au niveau de server.js avec authenticateToken

// ============================================
// GET /api/checklist/items - Liste des items avec catégories
// ============================================
router.get('/items', async (req, res) => {
  try {
    const [items] = await pool.query(`
      SELECT 
        ci.id, ci.code, ci.libelle, ci.description, ci.critique, ci.ordre,
        cc.id as categorie_id, cc.code as categorie_code, cc.nom as categorie_nom, cc.ordre as categorie_ordre
      FROM checklist_items ci
      JOIN checklist_categories cc ON ci.categorie_id = cc.id
      WHERE ci.actif = true AND cc.actif = true
      ORDER BY cc.ordre, ci.ordre
    `);
    
    // Grouper par catégorie
    const categories = {};
    items.forEach(item => {
      if (!categories[item.categorie_id]) {
        categories[item.categorie_id] = {
          id: item.categorie_id,
          code: item.categorie_code,
          nom: item.categorie_nom,
          ordre: item.categorie_ordre,
          items: []
        };
      }
      categories[item.categorie_id].items.push({
        id: item.id,
        code: item.code,
        libelle: item.libelle,
        description: item.description,
        critique: !!item.critique
      });
    });
    
    res.json(Object.values(categories).sort((a, b) => a.ordre - b.ordre));
  } catch (error) {
    console.error('Erreur liste items:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/checklist/coulee/:couleeId - Checklist d'une coulée
// ============================================
router.get('/coulee/:couleeId', async (req, res) => {
  try {
    const { couleeId } = req.params;
    
    // Récupérer les infos de la coulée
    const [coulees] = await pool.query(`
      SELECT c.*, b.numero as bobine_numero 
      FROM coulees c 
      LEFT JOIN bobines b ON c.bobine_id = b.id 
      WHERE c.id = ?
    `, [couleeId]);
    
    if (coulees.length === 0) {
      return res.status(404).json({ error: 'Coulée non trouvée' });
    }
    
    // Récupérer tous les items avec leurs validations
    const [items] = await pool.query(`
      SELECT 
        ci.id as item_id, ci.code, ci.libelle, ci.critique,
        cc.id as categorie_id, cc.code as categorie_code, cc.nom as categorie_nom, cc.ordre as categorie_ordre,
        cv.id as validation_id, cv.statut, cv.defaut_detecte, cv.action_corrective,
        cv.date_verification, cv.date_correction, cv.commentaire,
        CONCAT(o1.prenom, ' ', o1.nom) as verificateur,
        CONCAT(o2.prenom, ' ', o2.nom) as correcteur
      FROM checklist_items ci
      JOIN checklist_categories cc ON ci.categorie_id = cc.id
      LEFT JOIN checklist_validations cv ON cv.item_id = ci.id AND cv.coulee_id = ?
      LEFT JOIN operateurs o1 ON cv.operateur_id = o1.id
      LEFT JOIN operateurs o2 ON cv.operateur_correction_id = o2.id
      WHERE ci.actif = true AND cc.actif = true
      ORDER BY cc.ordre, ci.ordre
    `, [couleeId]);
    
    // Grouper par catégorie
    const categories = {};
    let totalItems = 0;
    let itemsConformes = 0;
    let itemsNonConformes = 0;
    let itemsCorriges = 0;
    let itemsNonVerifies = 0;
    let itemsCritiquesNonValides = 0;
    
    items.forEach(item => {
      if (!categories[item.categorie_id]) {
        categories[item.categorie_id] = {
          id: item.categorie_id,
          code: item.categorie_code,
          nom: item.categorie_nom,
          ordre: item.categorie_ordre,
          items: []
        };
      }
      
      totalItems++;
      if (item.statut === 'conforme') {
        itemsConformes++;
      } else if (item.statut === 'corrige') {
        itemsCorriges++;
      } else if (item.statut === 'non_conforme') {
        itemsNonConformes++;
      } else {
        itemsNonVerifies++;
      }
      
      if (item.critique && item.statut !== 'conforme' && item.statut !== 'corrige') {
        itemsCritiquesNonValides++;
      }
      
      categories[item.categorie_id].items.push({
        id: item.item_id,
        code: item.code,
        libelle: item.libelle,
        critique: !!item.critique,
        validation: item.validation_id ? {
          id: item.validation_id,
          statut: item.statut,
          defaut_detecte: item.defaut_detecte,
          action_corrective: item.action_corrective,
          date_verification: item.date_verification,
          date_correction: item.date_correction,
          commentaire: item.commentaire,
          verificateur: item.verificateur,
          correcteur: item.correcteur
        } : null
      });
    });
    
    res.json({
      coulee: coulees[0],
      categories: Object.values(categories).sort((a, b) => a.ordre - b.ordre),
      stats: {
        total: totalItems,
        conformes: itemsConformes,
        non_conformes: itemsNonConformes,
        corriges: itemsCorriges,
        non_verifies: itemsNonVerifies,
        critiques_non_valides: itemsCritiquesNonValides,
        progression: totalItems > 0 ? Math.round(((itemsConformes + itemsCorriges) / totalItems) * 100) : 0,
        peut_valider: itemsCritiquesNonValides === 0 && (itemsConformes + itemsCorriges) === totalItems
      }
    });
  } catch (error) {
    console.error('Erreur checklist coulée:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /api/checklist/valider-item - Valider/mettre à jour un item
// ============================================
router.put('/valider-item', async (req, res) => {
  try {
    const { coulee_id, item_id, statut, defaut_detecte, action_corrective, commentaire } = req.body;
    const operateur_id = req.userId;
    
    if (!coulee_id || !item_id || !statut) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    // Vérifier si une validation existe déjà
    const [existing] = await pool.query(
      'SELECT id, statut FROM checklist_validations WHERE coulee_id = ? AND item_id = ?',
      [coulee_id, item_id]
    );
    
    const now = new Date();
    
    if (existing.length > 0) {
      // Mise à jour
      const updateData = {
        statut,
        commentaire: commentaire || null,
        updated_at: now
      };
      
      if (statut === 'conforme') {
        updateData.date_verification = now;
        updateData.operateur_id = operateur_id;
        updateData.defaut_detecte = null;
        updateData.action_corrective = null;
      } else if (statut === 'non_conforme') {
        updateData.date_verification = now;
        updateData.operateur_id = operateur_id;
        updateData.defaut_detecte = defaut_detecte || null;
      } else if (statut === 'corrige') {
        updateData.date_correction = now;
        updateData.operateur_correction_id = operateur_id;
        updateData.action_corrective = action_corrective || null;
      }
      
      await pool.query(
        'UPDATE checklist_validations SET ? WHERE id = ?',
        [updateData, existing[0].id]
      );
    } else {
      // Création
      await pool.query(`
        INSERT INTO checklist_validations 
        (coulee_id, item_id, statut, defaut_detecte, action_corrective, date_verification, operateur_id, commentaire)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        coulee_id, 
        item_id, 
        statut, 
        statut === 'non_conforme' ? defaut_detecte : null,
        statut === 'corrige' ? action_corrective : null,
        now,
        operateur_id,
        commentaire
      ]);
    }
    
    res.json({ success: true, message: 'Item mis à jour' });
  } catch (error) {
    console.error('Erreur validation item:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/checklist/valider-complete/:couleeId - Valider la checklist complète
// ============================================
router.post('/valider-complete/:couleeId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { couleeId } = req.params;
    const operateur_id = req.userId;
    
    await connection.beginTransaction();
    
    // Vérifier que tous les items critiques sont conformes ou corrigés
    const [nonConformes] = await connection.query(`
      SELECT ci.libelle
      FROM checklist_items ci
      LEFT JOIN checklist_validations cv ON cv.item_id = ci.id AND cv.coulee_id = ?
      WHERE ci.actif = true 
        AND ci.critique = true 
        AND (cv.statut IS NULL OR cv.statut NOT IN ('conforme', 'corrige'))
    `, [couleeId]);
    
    if (nonConformes.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Items critiques non validés',
        items: nonConformes.map(i => i.libelle)
      });
    }
    
    // Mettre à jour la coulée
    await connection.query(`
      UPDATE coulees 
      SET checklist_validee = true, 
          date_checklist = NOW(),
          checklist_validee_par = ?,
          checklist_validation_rapide = 0,
          statut = 'pret_production'
      WHERE id = ?
    `, [operateur_id, couleeId]);
    
    await connection.commit();
    
    res.json({ success: true, message: 'Checklist validée, prêt pour production' });
  } catch (error) {
    await connection.rollback();
    console.error('Erreur validation checklist:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    connection.release();
  }
});

// ============================================
// POST /api/checklist/validation-rapide/:couleeId - Validation rapide (copie dernière checklist)
// ============================================
router.post('/validation-rapide/:couleeId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { couleeId } = req.params;
    const operateur_id = req.userId;

    await connection.beginTransaction();

    // Trouver la dernière coulée avec checklist validée (hors celle-ci)
    const [lastValidated] = await connection.query(`
      SELECT id, numero, date_checklist, checklist_validee_par
      FROM coulees
      WHERE checklist_validee = 1 AND id != ?
      ORDER BY date_checklist DESC
      LIMIT 1
    `, [couleeId]);

    if (lastValidated.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Aucune checklist précédente validée trouvée. Veuillez faire une validation complète.' });
    }

    const sourceCouleeId = lastValidated[0].id;

    // Copier toutes les validations de la dernière coulée vers celle-ci
    // D'abord supprimer les éventuelles validations existantes
    await connection.query('DELETE FROM checklist_validations WHERE coulee_id = ?', [couleeId]);

    // Copier les validations
    await connection.query(`
      INSERT INTO checklist_validations (coulee_id, item_id, statut, defaut_detecte, action_corrective, date_verification, operateur_id, commentaire)
      SELECT ?, item_id, statut, defaut_detecte, action_corrective, NOW(), ?, CONCAT('Validation rapide - Reprise de coulée N°', ?)
      FROM checklist_validations
      WHERE coulee_id = ? AND statut IN ('conforme', 'corrige')
    `, [couleeId, operateur_id, lastValidated[0].numero, sourceCouleeId]);

    // Vérifier que tous les items critiques sont couverts
    const [critiquesManquants] = await connection.query(`
      SELECT ci.libelle
      FROM checklist_items ci
      LEFT JOIN checklist_validations cv ON cv.item_id = ci.id AND cv.coulee_id = ?
      WHERE ci.actif = true AND ci.critique = true
        AND (cv.statut IS NULL OR cv.statut NOT IN ('conforme', 'corrige'))
    `, [couleeId]);

    if (critiquesManquants.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'La checklist précédente ne couvre pas tous les items critiques. Validation complète requise.',
        items: critiquesManquants.map(i => i.libelle)
      });
    }

    // Mettre à jour la coulée
    await connection.query(`
      UPDATE coulees
      SET checklist_validee = 1,
          date_checklist = NOW(),
          checklist_validee_par = ?,
          checklist_validation_rapide = 1,
          checklist_source_coulee_id = ?,
          statut = 'pret_production'
      WHERE id = ?
    `, [operateur_id, sourceCouleeId, couleeId]);

    await connection.commit();

    res.json({
      success: true,
      message: `Checklist validée rapidement (reprise de coulée N°${lastValidated[0].numero})`,
      source_coulee: lastValidated[0].numero
    });
  } catch (error) {
    await connection.rollback();
    console.error('Erreur validation rapide:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    connection.release();
  }
});

// ============================================
// GET /api/checklist/derniere-validation - Dernière checklist validée (pour affichage info)
// ============================================
router.get('/derniere-validation', async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT c.id, c.numero, c.date_checklist,
             CONCAT(o.prenom, ' ', o.nom) as validateur
      FROM coulees c
      LEFT JOIN operateurs o ON c.checklist_validee_par = o.id
      WHERE c.checklist_validee = 1
      ORDER BY c.date_checklist DESC
      LIMIT 1
    `);

    if (result.length === 0) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      coulee_id: result[0].id,
      coulee_numero: result[0].numero,
      date: result[0].date_checklist,
      validateur: result[0].validateur
    });
  } catch (error) {
    console.error('Erreur dernière validation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/checklist/historique - Historique de toutes les checklists validées
// ============================================
router.get('/historique', async (req, res) => {
  try {
    const [coulees] = await pool.query(`
      SELECT c.id, c.numero, c.date_checklist, c.checklist_validee, c.checklist_validation_rapide,
             c.checklist_source_coulee_id,
             src.numero as source_coulee_numero,
             CONCAT(o.prenom, ' ', o.nom) as validateur,
             (SELECT COUNT(*) FROM checklist_validations cv WHERE cv.coulee_id = c.id AND cv.statut = 'conforme') as nb_conformes,
             (SELECT COUNT(*) FROM checklist_validations cv WHERE cv.coulee_id = c.id AND cv.statut = 'non_conforme') as nb_non_conformes,
             (SELECT COUNT(*) FROM checklist_validations cv WHERE cv.coulee_id = c.id AND cv.statut = 'corrige') as nb_corriges,
             (SELECT COUNT(*) FROM checklist_validations cv WHERE cv.coulee_id = c.id) as nb_total
      FROM coulees c
      LEFT JOIN operateurs o ON c.checklist_validee_par = o.id
      LEFT JOIN coulees src ON c.checklist_source_coulee_id = src.id
      WHERE c.checklist_validee = 1
      ORDER BY c.date_checklist DESC
    `);

    res.json(coulees);
  } catch (error) {
    console.error('Erreur historique:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/checklist/historique/:couleeId - Détail checklist d'une coulée pour l'historique
// ============================================
router.get('/historique/:couleeId', async (req, res) => {
  try {
    const { couleeId } = req.params;

    // Infos coulée
    const [couleeData] = await pool.query(`
      SELECT c.id, c.numero, c.date_checklist, c.checklist_validee,
             c.checklist_validation_rapide, c.checklist_source_coulee_id,
             src.numero as source_coulee_numero,
             CONCAT(o.prenom, ' ', o.nom) as validateur
      FROM coulees c
      LEFT JOIN operateurs o ON c.checklist_validee_par = o.id
      LEFT JOIN coulees src ON c.checklist_source_coulee_id = src.id
      WHERE c.id = ?
    `, [couleeId]);

    if (couleeData.length === 0) {
      return res.status(404).json({ error: 'Coulée non trouvée' });
    }

    // Items avec validations
    const [items] = await pool.query(`
      SELECT
        ci.id as item_id, ci.code, ci.libelle, ci.critique,
        cc.nom as categorie_nom, cc.code as categorie_code, cc.ordre as categorie_ordre,
        cv.statut, cv.defaut_detecte, cv.action_corrective,
        cv.date_verification, cv.date_correction, cv.commentaire,
        CONCAT(o1.prenom, ' ', o1.nom) as verificateur,
        CONCAT(o2.prenom, ' ', o2.nom) as correcteur
      FROM checklist_items ci
      JOIN checklist_categories cc ON ci.categorie_id = cc.id
      LEFT JOIN checklist_validations cv ON cv.item_id = ci.id AND cv.coulee_id = ?
      LEFT JOIN operateurs o1 ON cv.operateur_id = o1.id
      LEFT JOIN operateurs o2 ON cv.operateur_correction_id = o2.id
      WHERE ci.actif = true AND cc.actif = true
      ORDER BY cc.ordre, ci.ordre
    `, [couleeId]);

    // Grouper par catégorie
    const categories = {};
    items.forEach(item => {
      if (!categories[item.categorie_code]) {
        categories[item.categorie_code] = {
          nom: item.categorie_nom,
          code: item.categorie_code,
          ordre: item.categorie_ordre,
          items: []
        };
      }
      categories[item.categorie_code].items.push({
        code: item.code,
        libelle: item.libelle,
        critique: !!item.critique,
        statut: item.statut || 'non_verifie',
        defaut_detecte: item.defaut_detecte,
        action_corrective: item.action_corrective,
        date_verification: item.date_verification,
        date_correction: item.date_correction,
        commentaire: item.commentaire,
        verificateur: item.verificateur,
        correcteur: item.correcteur
      });
    });

    res.json({
      coulee: couleeData[0],
      categories: Object.values(categories).sort((a, b) => a.ordre - b.ordre)
    });
  } catch (error) {
    console.error('Erreur détail historique:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// DELETE /api/checklist/reinitialiser/:couleeId - Réinitialiser la checklist
// ============================================
router.delete('/reinitialiser/:couleeId', async (req, res) => {
  try {
    const { couleeId } = req.params;
    
    await pool.query('DELETE FROM checklist_validations WHERE coulee_id = ?', [couleeId]);
    
    res.json({ success: true, message: 'Checklist réinitialisée' });
  } catch (error) {
    console.error('Erreur réinitialisation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
