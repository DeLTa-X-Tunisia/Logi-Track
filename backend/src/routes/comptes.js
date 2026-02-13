/**
 * Routes API pour la gestion des comptes utilisateurs - LogiTrack
 * CRUD complet + promotion admin + génération code unique
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Génère un code unique à 6 chiffres
 */
async function generateUniqueCode() {
  let code;
  let exists = true;
  
  while (exists) {
    // Générer un code aléatoire de 6 chiffres
    code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Vérifier qu'il n'existe pas déjà
    const [rows] = await pool.query(
      'SELECT id FROM operateurs WHERE code = ?',
      [code]
    );
    exists = rows.length > 0;
  }
  
  return code;
}

/**
 * Génère un matricule unique
 */
async function generateMatricule() {
  const year = new Date().getFullYear().toString().slice(-2);
  const [rows] = await pool.query(
    'SELECT COUNT(*) as count FROM operateurs WHERE matricule LIKE ?',
    [`LT${year}%`]
  );
  const count = rows[0].count + 1;
  return `LT${year}${count.toString().padStart(4, '0')}`;
}

/**
 * GET /api/comptes - Liste tous les comptes (opérateurs)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, departement, actif, direction_role } = req.query;
    
    let query = `
      SELECT 
        o.*,
        d.nom as departement_nom,
        q.nom as qualification_nom
      FROM operateurs o
      LEFT JOIN departements d ON o.departement = d.code
      LEFT JOIN qualifications q ON o.qualification = q.code
      WHERE 1=1
    `;
    const params = [];
    
    if (search) {
      query += ' AND (o.nom LIKE ? OR o.prenom LIKE ? OR o.matricule LIKE ? OR o.code LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (departement) {
      query += ' AND o.departement = ?';
      params.push(departement);
    }
    
    if (actif !== undefined) {
      query += ' AND o.actif = ?';
      params.push(actif === 'true' ? 1 : 0);
    }
    
    if (direction_role && direction_role !== 'none') {
      query += ' AND o.direction_role = ?';
      params.push(direction_role);
    }
    
    query += ' ORDER BY o.created_at DESC';
    
    const [comptes] = await pool.query(query, params);
    
    res.json(comptes);
  } catch (error) {
    console.error('Erreur GET /comptes:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des comptes' });
  }
});

/**
 * GET /api/comptes/stats - Statistiques des comptes
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN actif = 1 THEN 1 ELSE 0 END) as actifs,
        SUM(CASE WHEN is_admin = 1 THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN direction_role = 'chef_projet' THEN 1 ELSE 0 END) as chefs_projet,
        SUM(CASE WHEN direction_role = 'chef_chantier' THEN 1 ELSE 0 END) as chefs_chantier
      FROM operateurs
    `);
    
    const [byDepartement] = await pool.query(`
      SELECT departement, COUNT(*) as count
      FROM operateurs
      WHERE actif = 1
      GROUP BY departement
    `);
    
    res.json({
      ...stats[0],
      parDepartement: byDepartement
    });
  } catch (error) {
    console.error('Erreur GET /comptes/stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/comptes/departements - Liste des départements
 */
router.get('/departements', authenticateToken, async (req, res) => {
  try {
    const [departements] = await pool.query(
      'SELECT * FROM departements WHERE actif = 1 ORDER BY nom'
    );
    res.json(departements);
  } catch (error) {
    console.error('Erreur GET /comptes/departements:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/comptes/qualifications - Liste des qualifications
 */
router.get('/qualifications', authenticateToken, async (req, res) => {
  try {
    const [qualifications] = await pool.query(
      'SELECT * FROM qualifications WHERE actif = 1 ORDER BY niveau, nom'
    );
    res.json(qualifications);
  } catch (error) {
    console.error('Erreur GET /comptes/qualifications:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/comptes/:id - Détail d'un compte
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [comptes] = await pool.query(`
      SELECT 
        o.*,
        d.nom as departement_nom,
        q.nom as qualification_nom
      FROM operateurs o
      LEFT JOIN departements d ON o.departement = d.code
      LEFT JOIN qualifications q ON o.qualification = q.code
      WHERE o.id = ?
    `, [req.params.id]);
    
    if (comptes.length === 0) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }
    
    res.json(comptes[0]);
  } catch (error) {
    console.error('Erreur GET /comptes/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/comptes - Créer un nouveau compte
 */
router.post('/', [
  authenticateToken,
  requireAdmin,
  body('nom').notEmpty().withMessage('Nom requis'),
  body('prenom').notEmpty().withMessage('Prénom requis')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      nom,
      prenom,
      email,
      telephone,
      departement,
      qualification,
      poste,
      equipe,
      direction_role,
      is_admin
    } = req.body;

    // Générer code unique et matricule
    const code = await generateUniqueCode();
    const matricule = await generateMatricule();
    
    const [result] = await pool.query(`
      INSERT INTO operateurs (
        code, matricule, nom, prenom, email, telephone,
        departement, qualification, poste, equipe,
        direction_role, is_admin, actif, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())
    `, [
      code, matricule, nom, prenom, email || null, telephone || null,
      departement || 'production', qualification || null,
      poste || 'polyvalent', equipe || 'jour',
      direction_role || 'none', is_admin ? 1 : 0
    ]);

    // Récupérer le compte créé
    const [newCompte] = await pool.query(
      'SELECT * FROM operateurs WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'Compte créé avec succès',
      compte: newCompte[0],
      codeConnexion: code
    });
  } catch (error) {
    console.error('Erreur POST /comptes:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Un compte avec cet email existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

/**
 * PUT /api/comptes/:id - Modifier un compte
 */
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  body('nom').notEmpty().withMessage('Nom requis'),
  body('prenom').notEmpty().withMessage('Prénom requis')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const {
      nom,
      prenom,
      email,
      telephone,
      departement,
      qualification,
      poste,
      equipe,
      direction_role,
      is_admin,
      actif
    } = req.body;

    // Vérifier que le compte existe
    const [existing] = await pool.query('SELECT id FROM operateurs WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    await pool.query(`
      UPDATE operateurs SET
        nom = ?,
        prenom = ?,
        email = ?,
        telephone = ?,
        departement = ?,
        qualification = ?,
        poste = ?,
        equipe = ?,
        direction_role = ?,
        is_admin = ?,
        actif = ?
      WHERE id = ?
    `, [
      nom, prenom, email || null, telephone || null,
      departement || 'production', qualification || null,
      poste || 'polyvalent', equipe || 'jour',
      direction_role || 'none', is_admin ? 1 : 0,
      actif !== undefined ? actif : true,
      id
    ]);

    // Récupérer le compte mis à jour
    const [updated] = await pool.query('SELECT * FROM operateurs WHERE id = ?', [id]);

    res.json({
      message: 'Compte mis à jour avec succès',
      compte: updated[0]
    });
  } catch (error) {
    console.error('Erreur PUT /comptes/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du compte' });
  }
});

/**
 * PUT /api/comptes/:id/promote - Promouvoir/rétrograder un utilisateur en admin
 */
router.put('/:id/promote', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_admin } = req.body;

    const [result] = await pool.query(
      'UPDATE operateurs SET is_admin = ? WHERE id = ?',
      [is_admin ? 1 : 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    res.json({ 
      message: is_admin ? 'Utilisateur promu administrateur' : 'Droits admin retirés'
    });
  } catch (error) {
    console.error('Erreur PUT /comptes/:id/promote:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/comptes/:id/regenerate-code - Régénérer le code de connexion
 */
router.put('/:id/regenerate-code', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Générer un nouveau code unique
    const newCode = await generateUniqueCode();

    const [result] = await pool.query(
      'UPDATE operateurs SET code = ? WHERE id = ?',
      [newCode, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    res.json({ 
      message: 'Code de connexion régénéré',
      nouveauCode: newCode
    });
  } catch (error) {
    console.error('Erreur PUT /comptes/:id/regenerate-code:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/comptes/:id - Supprimer un compte (soft delete)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === 'true') {
      // Suppression définitive
      const [result] = await pool.query('DELETE FROM operateurs WHERE id = ?', [id]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Compte non trouvé' });
      }
      
      res.json({ message: 'Compte supprimé définitivement' });
    } else {
      // Soft delete (désactivation)
      const [result] = await pool.query(
        'UPDATE operateurs SET actif = FALSE WHERE id = ?',
        [id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Compte non trouvé' });
      }
      
      res.json({ message: 'Compte désactivé' });
    }
  } catch (error) {
    console.error('Erreur DELETE /comptes/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/**
 * PUT /api/comptes/:id/activate - Réactiver un compte
 */
router.put('/:id/activate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'UPDATE operateurs SET actif = TRUE WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    res.json({ message: 'Compte réactivé' });
  } catch (error) {
    console.error('Erreur PUT /comptes/:id/activate:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
