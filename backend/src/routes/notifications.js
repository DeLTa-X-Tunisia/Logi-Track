/**
 * Routes API pour les notifications - LogiTrack
 * Gestion des notifications temps réel
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/notifications - Récupérer les notifications (les 50 plus récentes)
router.get('/', async (req, res) => {
  try {
    const [notifications] = await pool.query(`
      SELECT * FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    
    const [unreadCount] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE lu = 0'
    );

    res.json({
      notifications,
      unread_count: unreadCount[0].count
    });
  } catch (error) {
    console.error('Erreur GET notifications:', error);
    res.status(500).json({ error: 'Erreur récupération notifications' });
  }
});

// PUT /api/notifications/:id/lu - Marquer une notification comme lue
router.put('/:id/lu', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET lu = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur PUT notification lu:', error);
    res.status(500).json({ error: 'Erreur mise à jour notification' });
  }
});

// PUT /api/notifications/lire-tout - Marquer toutes comme lues
router.put('/lire-tout', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET lu = 1 WHERE lu = 0');
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur PUT lire-tout:', error);
    res.status(500).json({ error: 'Erreur mise à jour notifications' });
  }
});

// DELETE /api/notifications/clear - Supprimer les notifications lues (plus de 7 jours)
router.delete('/clear', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE lu = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE clear:', error);
    res.status(500).json({ error: 'Erreur suppression notifications' });
  }
});

module.exports = router;
