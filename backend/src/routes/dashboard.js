/**
 * Routes API Dashboard - LogiTrack
 * Statistiques temps réel pour le dashboard principal
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/dashboard/stats - Statistiques globales du dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    // ─── Stats Tubes ────────────────────────────────────────
    const [tubeStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as en_cours,
        SUM(CASE WHEN statut = 'termine' THEN 1 ELSE 0 END) as termines,
        SUM(CASE WHEN statut = 'rebut' THEN 1 ELSE 0 END) as rebuts,
        SUM(CASE WHEN statut = 'reparation' THEN 1 ELSE 0 END) as reparation,
        SUM(CASE WHEN statut = 'attente' THEN 1 ELSE 0 END) as attente
      FROM tubes
    `);

    // Production du jour (tubes créés aujourd'hui)
    const [prodJour] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM tubes 
      WHERE DATE(created_at) = CURDATE()
    `);

    // Production terminée aujourd'hui
    const [terminesJour] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM tubes 
      WHERE statut = 'termine' AND DATE(updated_at) = CURDATE()
    `);

    // ─── Compteurs par étape ────────────────────────────────
    const [etapesCount] = await pool.query(`
      SELECT 
        ep.id,
        ep.code,
        ep.nom,
        ep.ordre,
        ep.icon,
        ep.color,
        COUNT(t.id) as tubes_count
      FROM etapes_production ep
      LEFT JOIN tube_etapes te ON te.etape_code = ep.code AND te.statut = 'en_cours'
      LEFT JOIN tubes t ON t.id = te.tube_id AND t.statut = 'en_production'
      GROUP BY ep.id
      ORDER BY ep.ordre ASC
    `);

    // ─── Stats Coulées ──────────────────────────────────────
    const [couleeStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as en_cours,
        SUM(CASE WHEN statut = 'pret_production' THEN 1 ELSE 0 END) as pret,
        SUM(CASE WHEN statut = 'en_production' THEN 1 ELSE 0 END) as en_production,
        SUM(CASE WHEN statut = 'termine' THEN 1 ELSE 0 END) as terminees
      FROM coulees
    `);

    // Coulées du jour
    const [couleesJour] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM coulees 
      WHERE DATE(created_at) = CURDATE()
    `);

    // ─── Stats Bobines ──────────────────────────────────────
    const [bobineStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'en_stock' THEN 1 ELSE 0 END) as en_stock,
        SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as en_cours,
        SUM(CASE WHEN statut = 'epuisee' THEN 1 ELSE 0 END) as epuisees,
        COALESCE(SUM(poids), 0) as poids_total
      FROM bobines
    `);

    // ─── Activité récente ───────────────────────────────────
    // Dernières actions sur les tubes (suivi_tubes)
    let activiteRecente = [];
    try {
      const [activite] = await pool.query(`
        SELECT 
          st.id,
          st.statut,
          st.date_debut,
          st.commentaire,
          t.numero as tube_numero,
          ep.nom as etape_nom,
          ep.code as etape_code,
          CONCAT(o.prenom, ' ', o.nom) as operateur_nom
        FROM suivi_tubes st
        JOIN tubes t ON st.tube_id = t.id
        JOIN etapes_production ep ON st.etape_id = ep.id
        LEFT JOIN operateurs o ON st.operateur_id = o.id
        ORDER BY st.date_debut DESC
        LIMIT 10
      `);
      activiteRecente = activite;
    } catch (e) {
      // La table suivi_tubes peut être vide, ce n'est pas une erreur
      activiteRecente = [];
    }

    // ─── Alertes récentes ───────────────────────────────────
    let alertes = [];
    try {
      const [alertesData] = await pool.query(`
        SELECT id, type, titre, message, lu, created_at
        FROM alertes
        WHERE lu = FALSE
        ORDER BY created_at DESC
        LIMIT 5
      `);
      alertes = alertesData;
    } catch (e) {
      alertes = [];
    }

    // ─── Réponse ────────────────────────────────────────────
    res.json({
      tubes: {
        total: tubeStats[0]?.total || 0,
        en_cours: tubeStats[0]?.en_cours || 0,
        termines: tubeStats[0]?.termines || 0,
        rebuts: tubeStats[0]?.rebuts || 0,
        reparation: tubeStats[0]?.reparation || 0,
        attente: tubeStats[0]?.attente || 0,
        production_jour: prodJour[0]?.count || 0,
        termines_jour: terminesJour[0]?.count || 0,
      },
      etapes: etapesCount,
      coulees: {
        total: couleeStats[0]?.total || 0,
        en_cours: couleeStats[0]?.en_cours || 0,
        pret: couleeStats[0]?.pret || 0,
        en_production: couleeStats[0]?.en_production || 0,
        terminees: couleeStats[0]?.terminees || 0,
        jour: couleesJour[0]?.count || 0,
      },
      bobines: {
        total: bobineStats[0]?.total || 0,
        en_stock: bobineStats[0]?.en_stock || 0,
        en_cours: bobineStats[0]?.en_cours || 0,
        epuisees: bobineStats[0]?.epuisees || 0,
        poids_total: parseFloat(bobineStats[0]?.poids_total || 0),
      },
      activite_recente: activiteRecente,
      alertes_non_lues: alertes,
    });

  } catch (error) {
    console.error('Erreur GET /dashboard/stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

module.exports = router;
