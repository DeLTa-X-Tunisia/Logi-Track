/**
 * Routes API Checklists Périodiques
 * Début de quart, hebdomadaire, mensuelle
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ============================================
// GET /api/checklist-periodique/operateurs - Liste des opérateurs actifs
// ============================================
router.get('/operateurs', async (req, res) => {
  try {
    const [operateurs] = await pool.query(`
      SELECT id, prenom, nom, matricule, poste
      FROM operateurs 
      WHERE actif = true
      ORDER BY prenom, nom
    `);
    res.json(operateurs);
  } catch (error) {
    console.error('Erreur GET operateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/checklist-periodique/types - Liste des types avec statut dernière session
// ============================================
router.get('/types', async (req, res) => {
  try {
    const [types] = await pool.query(`
      SELECT cpt.*,
        (SELECT COUNT(*) FROM checklist_periodique_items cpi 
         JOIN checklist_periodique_categories cpc ON cpi.categorie_id = cpc.id 
         WHERE cpc.type_id = cpt.id AND cpi.actif = true) as total_items,
        (SELECT COUNT(*) FROM checklist_periodique_items cpi 
         JOIN checklist_periodique_categories cpc ON cpi.categorie_id = cpc.id 
         WHERE cpc.type_id = cpt.id AND cpi.critique = true AND cpi.actif = true) as total_critiques
      FROM checklist_periodique_types cpt
      WHERE cpt.actif = true
      ORDER BY cpt.ordre
    `);

    // Pour chaque type, récupérer la dernière session
    for (const type of types) {
      const [sessions] = await pool.query(`
        SELECT s.*, 
          CONCAT(COALESCE(o.prenom, u.prenom, ''), ' ', COALESCE(o.nom, u.nom, '')) as valideur
        FROM checklist_periodique_sessions s
        LEFT JOIN operateurs o ON s.operateur_id = o.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.type_id = ? AND s.statut = 'validee'
        ORDER BY s.date_validation DESC
        LIMIT 1
      `, [type.id]);

      if (sessions.length > 0) {
        const session = sessions[0];
        const expiration = new Date(session.date_expiration);
        const now = new Date();
        type.derniere_session = session;
        type.est_valide = expiration > now;
        type.expire_dans = expiration > now ? Math.round((expiration - now) / (1000 * 60 * 60)) : 0;
      } else {
        type.derniere_session = null;
        type.est_valide = false;
        type.expire_dans = 0;
      }
    }

    res.json(types);
  } catch (error) {
    console.error('Erreur GET types:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/checklist-periodique/statut - Statut global (pour bloquer coulées)
// ============================================
router.get('/statut', async (req, res) => {
  try {
    // Vérifier si la checklist début de quart est valide
    const [debutQuart] = await pool.query(`
      SELECT s.date_expiration
      FROM checklist_periodique_sessions s
      JOIN checklist_periodique_types t ON s.type_id = t.id
      WHERE t.code = 'DEBUT_QUART' AND s.statut = 'validee'
      ORDER BY s.date_validation DESC
      LIMIT 1
    `);

    const quartValide = debutQuart.length > 0 && new Date(debutQuart[0].date_expiration) > new Date();

    res.json({
      debut_quart_valide: quartValide,
      peut_produire: quartValide
    });
  } catch (error) {
    console.error('Erreur statut:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/checklist-periodique/session/:typeId - Démarrer une nouvelle session
// ============================================
router.post('/session/:typeId', async (req, res) => {
  try {
    const { typeId } = req.params;
    const { operateur_id } = req.body;

    // Récupérer le type
    const [types] = await pool.query('SELECT * FROM checklist_periodique_types WHERE id = ?', [typeId]);
    if (types.length === 0) return res.status(404).json({ error: 'Type non trouvé' });
    const type = types[0];

    // Créer la session
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + type.duree_validite_heures);

    const opId = operateur_id || req.user?.operateurId || null;
    const userId = req.user?.userId || null;

    const [result] = await pool.query(`
      INSERT INTO checklist_periodique_sessions (type_id, operateur_id, user_id, date_expiration)
      VALUES (?, ?, ?, ?)
    `, [typeId, opId, userId, expirationDate]);

    res.json({ session_id: result.insertId });
  } catch (error) {
    console.error('Erreur création session:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/checklist-periodique/session/:sessionId - Détail d'une session
// ============================================
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [sessions] = await pool.query(`
      SELECT s.*, t.code as type_code, t.nom as type_nom, t.frequence,
        CONCAT(COALESCE(o.prenom, ''), ' ', COALESCE(o.nom, '')) as operateur_nom,
        o.matricule as operateur_matricule
      FROM checklist_periodique_sessions s
      JOIN checklist_periodique_types t ON s.type_id = t.id
      LEFT JOIN operateurs o ON s.operateur_id = o.id
      WHERE s.id = ?
    `, [sessionId]);

    if (sessions.length === 0) return res.status(404).json({ error: 'Session non trouvée' });
    const session = sessions[0];

    // Récupérer items groupés par catégorie avec validations
    const [items] = await pool.query(`
      SELECT 
        cpi.id as item_id, cpi.code, cpi.libelle, cpi.critique,
        cpc.id as categorie_id, cpc.code as categorie_code, cpc.nom as categorie_nom, cpc.ordre as categorie_ordre,
        cpv.id as validation_id, cpv.statut, cpv.defaut_detecte, cpv.action_corrective,
        cpv.date_verification, cpv.commentaire,
        CONCAT(COALESCE(vo.prenom, ''), ' ', COALESCE(vo.nom, '')) as valideur_nom
      FROM checklist_periodique_items cpi
      JOIN checklist_periodique_categories cpc ON cpi.categorie_id = cpc.id
      LEFT JOIN checklist_periodique_validations cpv ON cpv.item_id = cpi.id AND cpv.session_id = ?
      LEFT JOIN operateurs vo ON cpv.operateur_id = vo.id
      WHERE cpc.type_id = ? AND cpi.actif = true AND cpc.actif = true
      ORDER BY cpc.ordre, cpi.ordre
    `, [sessionId, session.type_id]);

    // Grouper par catégorie + stats
    const categories = {};
    let totalItems = 0;
    let conformes = 0;
    let nonConformes = 0;
    let corriges = 0;
    let nonVerifies = 0;
    let critiquesNonValides = 0;

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
      if (item.statut === 'conforme') conformes++;
      else if (item.statut === 'corrige') corriges++;
      else if (item.statut === 'non_conforme') nonConformes++;
      else nonVerifies++;

      if (item.critique && item.statut !== 'conforme' && item.statut !== 'corrige') {
        critiquesNonValides++;
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
          commentaire: item.commentaire,
          valideur: item.valideur_nom?.trim() || null
        } : null
      });
    });

    const estExpiree = session.date_expiration && new Date(session.date_expiration) < new Date();
    const dejaValidee = session.statut === 'validee';

    res.json({
      session,
      categories: Object.values(categories).sort((a, b) => a.ordre - b.ordre),
      stats: {
        total: totalItems,
        conformes,
        non_conformes: nonConformes,
        corriges,
        non_verifies: nonVerifies,
        critiques_non_valides: critiquesNonValides,
        progression: totalItems > 0 ? Math.round(((conformes + corriges) / totalItems) * 100) : 0,
        est_expiree: estExpiree,
        deja_validee: dejaValidee,
        peut_valider: !estExpiree && !dejaValidee && critiquesNonValides === 0 && (conformes + corriges) === totalItems
      }
    });
  } catch (error) {
    console.error('Erreur session:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /api/checklist-periodique/valider-item - Valider un item
// ============================================
router.put('/valider-item', async (req, res) => {
  try {
    const { session_id, item_id, statut, defaut_detecte, action_corrective, commentaire } = req.body;
    const operateur_id = req.user?.operateurId || req.user?.userId || null;

    if (!session_id || !item_id || !statut) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    // Vérifier que la session n'est pas expirée ou déjà validée
    const [sessionCheck] = await pool.query(
      'SELECT statut, date_expiration FROM checklist_periodique_sessions WHERE id = ?', [session_id]
    );
    if (sessionCheck.length > 0) {
      if (sessionCheck[0].statut === 'validee') {
        return res.status(400).json({ error: 'Cette checklist est déjà validée. Impossible de modifier les items.' });
      }
      if (sessionCheck[0].date_expiration && new Date(sessionCheck[0].date_expiration) < new Date()) {
        return res.status(400).json({ error: 'Cette checklist a expiré. Impossible de modifier les items.' });
      }
    }

    const [existing] = await pool.query(
      'SELECT id FROM checklist_periodique_validations WHERE session_id = ? AND item_id = ?',
      [session_id, item_id]
    );

    const now = new Date();

    if (existing.length > 0) {
      await pool.query(`
        UPDATE checklist_periodique_validations 
        SET statut = ?, defaut_detecte = ?, action_corrective = ?, commentaire = ?,
            date_verification = ?, operateur_id = ?
        WHERE id = ?
      `, [statut, defaut_detecte || null, action_corrective || null, commentaire || null, now, operateur_id, existing[0].id]);
    } else {
      await pool.query(`
        INSERT INTO checklist_periodique_validations 
        (session_id, item_id, statut, defaut_detecte, action_corrective, commentaire, date_verification, operateur_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [session_id, item_id, statut, defaut_detecte || null, action_corrective || null, commentaire || null, now, operateur_id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur validation item:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/checklist-periodique/valider-session/:sessionId - Valider la session
// ============================================
router.post('/valider-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Vérifier que la session existe, n'est pas expirée et n'est pas déjà validée
    const [session] = await pool.query(
      'SELECT type_id, statut, date_expiration FROM checklist_periodique_sessions WHERE id = ?', [sessionId]
    );
    if (session.length === 0) return res.status(404).json({ error: 'Session non trouvée' });

    if (session[0].statut === 'validee') {
      return res.status(400).json({ error: 'Cette checklist a déjà été validée.' });
    }

    if (session[0].date_expiration && new Date(session[0].date_expiration) < new Date()) {
      return res.status(400).json({ error: 'Cette checklist a expiré. Veuillez en créer une nouvelle.' });
    }

    const [nonConformes] = await pool.query(`
      SELECT cpi.libelle
      FROM checklist_periodique_items cpi
      JOIN checklist_periodique_categories cpc ON cpi.categorie_id = cpc.id
      LEFT JOIN checklist_periodique_validations cpv ON cpv.item_id = cpi.id AND cpv.session_id = ?
      WHERE cpc.type_id = ? AND cpi.actif = true AND cpi.critique = true
        AND (cpv.statut IS NULL OR cpv.statut NOT IN ('conforme', 'corrige'))
    `, [sessionId, session[0].type_id]);

    if (nonConformes.length > 0) {
      return res.status(400).json({
        error: 'Items critiques non validés',
        items: nonConformes.map(i => i.libelle)
      });
    }

    await pool.query(`
      UPDATE checklist_periodique_sessions 
      SET statut = 'validee', date_validation = NOW()
      WHERE id = ?
    `, [sessionId]);

    res.json({ success: true, message: 'Checklist périodique validée' });
  } catch (error) {
    console.error('Erreur validation session:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// DELETE /api/checklist-periodique/session/:sessionId - Supprimer une session
// ============================================
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Vérifier que la session existe
    const [sessions] = await pool.query('SELECT id FROM checklist_periodique_sessions WHERE id = ?', [sessionId]);
    if (sessions.length === 0) return res.status(404).json({ error: 'Session non trouvée' });

    // Supprimer les validations puis la session
    await pool.query('DELETE FROM checklist_periodique_validations WHERE session_id = ?', [sessionId]);
    await pool.query('DELETE FROM checklist_periodique_sessions WHERE id = ?', [sessionId]);

    res.json({ success: true, message: 'Session supprimée' });
  } catch (error) {
    console.error('Erreur suppression session:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/checklist-periodique/historique/:typeId - Historique des sessions
// ============================================
router.get('/historique/:typeId', async (req, res) => {
  try {
    const { typeId } = req.params;

    const [sessions] = await pool.query(`
      SELECT sub.* FROM (
        SELECT s.*,
          ROW_NUMBER() OVER (ORDER BY s.created_at ASC) as numero,
          CONCAT(COALESCE(o.prenom, u.prenom, ''), ' ', COALESCE(o.nom, u.nom, '')) as valideur,
          o.matricule as operateur_matricule,
          (SELECT COUNT(*) FROM checklist_periodique_validations v WHERE v.session_id = s.id AND v.statut = 'conforme') as conformes,
          (SELECT COUNT(*) FROM checklist_periodique_validations v WHERE v.session_id = s.id AND v.statut = 'non_conforme') as non_conformes,
          (SELECT COUNT(*) FROM checklist_periodique_validations v WHERE v.session_id = s.id AND v.statut = 'corrige') as corriges,
          (SELECT COUNT(*) FROM checklist_periodique_items cpi 
           JOIN checklist_periodique_categories cpc ON cpi.categorie_id = cpc.id 
           WHERE cpc.type_id = s.type_id AND cpi.actif = true) as total_items,
          TIMESTAMPDIFF(MINUTE, s.created_at, COALESCE(s.date_validation, NOW())) as duree_minutes
        FROM checklist_periodique_sessions s
        LEFT JOIN operateurs o ON s.operateur_id = o.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.type_id = ?
      ) sub
      ORDER BY sub.created_at DESC
      LIMIT 50
    `, [typeId]);

    res.json(sessions);
  } catch (error) {
    console.error('Erreur historique:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
