/**
 * Routes API Audit Trail - LogiTrack
 * Consultation du journal d'audit pour conformité API 5L
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

/**
 * GET /api/audit - Liste paginée du journal d'audit
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { action, entite, entite_id, user_id, date_debut, date_fin, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];

    if (action) { where += ' AND a.action = ?'; params.push(action); }
    if (entite) { where += ' AND a.entite = ?'; params.push(entite); }
    if (entite_id) { where += ' AND a.entite_id = ?'; params.push(entite_id); }
    if (user_id) { where += ' AND (a.user_id = ? OR a.operateur_id = ?)'; params.push(user_id, user_id); }
    if (date_debut) { where += ' AND a.created_at >= ?'; params.push(date_debut); }
    if (date_fin) { where += ' AND a.created_at <= ?'; params.push(date_fin + ' 23:59:59'); }
    if (search) { where += ' AND (a.user_name LIKE ? OR a.entite_id LIKE ? OR JSON_EXTRACT(a.details, "$.numero") LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    // Count
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM audit_trail a ${where}`, params);
    const total = countResult[0].total;

    // Data
    const [rows] = await pool.query(
      `SELECT a.* FROM audit_trail a ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Erreur GET /audit:', error);
    res.status(500).json({ error: 'Erreur récupération audit' });
  }
});

/**
 * GET /api/audit/entite/:entite/:id - Historique d'une entité spécifique
 */
router.get('/entite/:entite/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM audit_trail WHERE entite = ? AND entite_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.params.entite, req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erreur GET /audit/entite:', error);
    res.status(500).json({ error: 'Erreur récupération audit' });
  }
});

/**
 * GET /api/audit/stats - Statistiques d'audit
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [byAction] = await pool.query(`
      SELECT action, COUNT(*) as count 
      FROM audit_trail 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY action ORDER BY count DESC
    `);
    const [byEntite] = await pool.query(`
      SELECT entite, COUNT(*) as count 
      FROM audit_trail 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY entite ORDER BY count DESC
    `);
    const [byUser] = await pool.query(`
      SELECT user_name, COUNT(*) as count 
      FROM audit_trail 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY user_name ORDER BY count DESC LIMIT 10
    `);

    res.json({ par_action: byAction, par_entite: byEntite, par_utilisateur: byUser });
  } catch (error) {
    console.error('Erreur GET /audit/stats:', error);
    res.status(500).json({ error: 'Erreur stats audit' });
  }
});

module.exports = router;
