/**
 * Routes API pour les étapes de production - LogiTrack
 * Gestion des étapes API 5L : Formage, Contrôle Visuel, Soudage, X-Ray, Chanfreinage, Test Hydraulique
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/etapes - Liste de toutes les étapes de production
 */
router.get('/', async (req, res) => {
  try {
    const [etapes] = await pool.query(`
      SELECT * FROM etapes_production 
      ORDER BY ordre ASC
    `);
    res.json(etapes);
  } catch (error) {
    console.error('Erreur GET /etapes:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des étapes' });
  }
});

/**
 * GET /api/etapes/:id - Détail d'une étape
 */
router.get('/:id', async (req, res) => {
  try {
    const [etapes] = await pool.query(
      'SELECT * FROM etapes_production WHERE id = ?',
      [req.params.id]
    );
    
    if (etapes.length === 0) {
      return res.status(404).json({ error: 'Étape non trouvée' });
    }
    
    res.json(etapes[0]);
  } catch (error) {
    console.error('Erreur GET /etapes/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/etapes/tube/:tubeId - Statut des étapes pour un tube
 */
router.get('/tube/:tubeId', async (req, res) => {
  try {
    const tubeId = req.params.tubeId;
    
    // Récupérer toutes les étapes avec leur statut pour ce tube
    const [etapes] = await pool.query(`
      SELECT 
        ep.id,
        ep.code,
        ep.nom,
        ep.description,
        ep.ordre,
        ep.obligatoire,
        st.id as statut_id,
        st.statut,
        st.date_debut,
        st.date_fin,
        st.operateur_id,
        st.commentaire,
        CONCAT(o.prenom, ' ', o.nom) as operateur_nom
      FROM etapes_production ep
      LEFT JOIN suivi_tubes st ON ep.id = st.etape_id AND st.tube_id = ?
      LEFT JOIN operateurs o ON st.operateur_id = o.id
      ORDER BY ep.ordre ASC
    `, [tubeId]);
    
    res.json(etapes);
  } catch (error) {
    console.error('Erreur GET /etapes/tube/:tubeId:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
