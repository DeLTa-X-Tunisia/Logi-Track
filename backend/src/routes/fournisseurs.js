const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/fournisseurs - Liste des fournisseurs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, nom, actif, created_at FROM fournisseurs WHERE actif = 1 ORDER BY nom ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Erreur liste fournisseurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/fournisseurs - Ajouter un fournisseur
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { nom } = req.body;

    if (!nom || !nom.trim()) {
      return res.status(400).json({ error: 'Le nom du fournisseur est requis' });
    }

    const nomTrimmed = nom.trim();

    // Vérifier si le fournisseur existe déjà
    const [existing] = await pool.execute(
      'SELECT id, nom, actif FROM fournisseurs WHERE LOWER(nom) = LOWER(?)',
      [nomTrimmed]
    );

    if (existing.length > 0) {
      // Si désactivé, le réactiver
      if (!existing[0].actif) {
        await pool.execute('UPDATE fournisseurs SET actif = 1 WHERE id = ?', [existing[0].id]);
        return res.json({ id: existing[0].id, nom: existing[0].nom, message: 'Fournisseur réactivé' });
      }
      return res.status(409).json({ error: 'Ce fournisseur existe déjà' });
    }

    const [result] = await pool.execute(
      'INSERT INTO fournisseurs (nom) VALUES (?)',
      [nomTrimmed]
    );

    res.status(201).json({ id: result.insertId, nom: nomTrimmed });
  } catch (error) {
    console.error('Erreur ajout fournisseur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/fournisseurs/:id - Désactiver un fournisseur
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE fournisseurs SET actif = 0 WHERE id = ?', [id]);
    res.json({ message: 'Fournisseur désactivé' });
  } catch (error) {
    console.error('Erreur suppression fournisseur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
