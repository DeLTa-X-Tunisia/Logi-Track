/**
 * Routes API - Gestion des langues et traductions
 * LogiTrack - Système i18n
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ============================================================
// GET /api/langues - Liste des langues (public)
// ============================================================
router.get('/', async (req, res) => {
  try {
    const [langues] = await pool.query(
      'SELECT * FROM langues ORDER BY ordre ASC'
    );
    res.json({ langues });
  } catch (error) {
    console.error('Erreur récupération langues:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// GET /api/langues/traductions/:code - Traductions pour une langue
// ============================================================
router.get('/traductions/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const [traductions] = await pool.query(
      'SELECT cle, valeur, categorie FROM traductions WHERE langue_code = ? ORDER BY categorie, cle',
      [code]
    );

    // Convertir en objet clé/valeur pour le frontend
    const translations = {};
    traductions.forEach(t => {
      translations[t.cle] = t.valeur;
    });

    res.json({ langue: code, traductions: translations, details: traductions });
  } catch (error) {
    console.error('Erreur récupération traductions:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// GET /api/langues/traductions-all - Toutes les traductions groupées
// ============================================================
router.get('/traductions-all', async (req, res) => {
  try {
    const [traductions] = await pool.query(
      'SELECT cle, langue_code, valeur, categorie FROM traductions ORDER BY categorie, cle, langue_code'
    );

    // Grouper par clé
    const grouped = {};
    traductions.forEach(t => {
      if (!grouped[t.cle]) {
        grouped[t.cle] = { cle: t.cle, categorie: t.categorie, traductions: {} };
      }
      grouped[t.cle].traductions[t.langue_code] = t.valeur;
    });

    res.json({ traductions: Object.values(grouped) });
  } catch (error) {
    console.error('Erreur récupération traductions:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// PUT /api/langues/:id/toggle - Activer/désactiver une langue (admin)
// ============================================================
router.put('/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que ce n'est pas la langue par défaut
    const [langue] = await pool.query('SELECT * FROM langues WHERE id = ?', [id]);
    if (!langue.length) {
      return res.status(404).json({ message: 'Langue non trouvée' });
    }
    if (langue[0].par_defaut && langue[0].actif) {
      return res.status(400).json({ message: 'Impossible de désactiver la langue par défaut' });
    }

    await pool.query('UPDATE langues SET actif = NOT actif WHERE id = ?', [id]);
    const [updated] = await pool.query('SELECT * FROM langues WHERE id = ?', [id]);

    res.json({ message: 'Langue mise à jour', langue: updated[0] });
  } catch (error) {
    console.error('Erreur toggle langue:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// PUT /api/langues/:id/defaut - Définir comme langue par défaut (admin)
// ============================================================
router.put('/:id/defaut', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la langue existe et est active
    const [langue] = await pool.query('SELECT * FROM langues WHERE id = ?', [id]);
    if (!langue.length) {
      return res.status(404).json({ message: 'Langue non trouvée' });
    }
    if (!langue[0].actif) {
      return res.status(400).json({ message: 'La langue doit être active pour devenir la langue par défaut' });
    }

    // Retirer le par_defaut de toutes les langues, puis mettre sur la nouvelle
    await pool.query('UPDATE langues SET par_defaut = 0');
    await pool.query('UPDATE langues SET par_defaut = 1 WHERE id = ?', [id]);

    const [langues] = await pool.query('SELECT * FROM langues ORDER BY ordre ASC');
    res.json({ message: 'Langue par défaut mise à jour', langues });
  } catch (error) {
    console.error('Erreur mise à jour langue par défaut:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// PUT /api/langues/traduction - Modifier une traduction (admin)
// ============================================================
router.put('/traduction', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { cle, langue_code, valeur } = req.body;

    if (!cle || !langue_code || valeur === undefined) {
      return res.status(400).json({ message: 'Clé, langue et valeur requises' });
    }

    await pool.query(
      `INSERT INTO traductions (cle, langue_code, valeur) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE valeur = ?`,
      [cle, langue_code, valeur, valeur]
    );

    res.json({ message: 'Traduction mise à jour' });
  } catch (error) {
    console.error('Erreur mise à jour traduction:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// POST /api/langues/traduction - Ajouter une nouvelle clé (admin)
// ============================================================
router.post('/traduction', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { cle, categorie, traductions } = req.body;

    if (!cle || !traductions || typeof traductions !== 'object') {
      return res.status(400).json({ message: 'Clé et traductions requises' });
    }

    for (const [langueCode, valeur] of Object.entries(traductions)) {
      await pool.query(
        `INSERT INTO traductions (cle, langue_code, valeur, categorie)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE valeur = ?, categorie = ?`,
        [cle, langueCode, valeur, categorie || 'general', valeur, categorie || 'general']
      );
    }

    res.json({ message: 'Traduction ajoutée avec succès' });
  } catch (error) {
    console.error('Erreur ajout traduction:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// DELETE /api/langues/traduction/:cle - Supprimer une clé (admin)
// ============================================================
router.delete('/traduction/:cle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { cle } = req.params;
    await pool.query('DELETE FROM traductions WHERE cle = ?', [cle]);
    res.json({ message: 'Traduction supprimée' });
  } catch (error) {
    console.error('Erreur suppression traduction:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// PUT /api/langues/user-preference - Sauver la langue de l'utilisateur
// ============================================================
router.put('/user-preference', authenticateToken, async (req, res) => {
  try {
    const { langue_code } = req.body;
    const userId = req.user.id;
    const userType = req.user.type; // 'admin' ou 'operateur'

    if (!langue_code) {
      return res.status(400).json({ message: 'Code langue requis' });
    }

    if (userType === 'admin') {
      await pool.query('UPDATE users SET langue_preferee = ? WHERE id = ?', [langue_code, userId]);
    } else {
      await pool.query('UPDATE operateurs SET langue_preferee = ? WHERE id = ?', [langue_code, userId]);
    }

    res.json({ message: 'Préférence de langue sauvegardée', langue: langue_code });
  } catch (error) {
    console.error('Erreur sauvegarde préférence langue:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
