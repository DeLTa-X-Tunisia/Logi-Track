/**
 * Routes API pour l'authentification - LogiTrack
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Validation login
const loginValidation = [
  body('username').notEmpty().withMessage('Nom d\'utilisateur requis'),
  body('password').notEmpty().withMessage('Mot de passe requis')
];

/**
 * POST /api/auth/login - Connexion admin
 */
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password } = req.body;

    // Rechercher l'utilisateur
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        error: 'Identifiants incorrects',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = users[0];

    // Vérifier si le compte est actif
    if (!user.actif) {
      return res.status(401).json({ 
        error: 'Compte désactivé',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Identifiants incorrects',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Mettre à jour la dernière connexion
    await pool.query(
      'UPDATE users SET derniere_connexion = NOW() WHERE id = ?',
      [user.id]
    );

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        role: user.role,
        nom: user.nom,
        prenom: user.prenom
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Réponse sans le mot de passe
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Connexion réussie',
      token,
      user: { ...userWithoutPassword, langue_preferee: user.langue_preferee || 'fr' }
    });
  } catch (error) {
    console.error('Erreur POST /auth/login:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

/**
 * POST /api/auth/login-code - Connexion par code opérateur (6 chiffres)
 */
router.post('/login-code', [
  body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Code à 6 chiffres requis')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { code } = req.body;

    // Rechercher l'opérateur par son code
    const [operateurs] = await pool.query(
      'SELECT * FROM operateurs WHERE code = ? AND actif = 1',
      [code]
    );

    if (operateurs.length === 0) {
      return res.status(401).json({ 
        error: 'Code opérateur invalide',
        code: 'INVALID_CODE'
      });
    }

    const operateur = operateurs[0];

    // Mettre à jour la dernière connexion
    await pool.query(
      'UPDATE operateurs SET derniere_connexion = NOW() WHERE id = ?',
      [operateur.id]
    );

    // Générer le token JWT
    const token = jwt.sign(
      { 
        operateurId: operateur.id,
        nom: operateur.nom,
        prenom: operateur.prenom,
        poste: operateur.poste,
        role: operateur.is_admin ? 'admin' : 'operateur',
        is_admin: operateur.is_admin || false
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      operateur: {
        id: operateur.id,
        nom: operateur.nom,
        prenom: operateur.prenom,
        matricule: operateur.matricule,
        poste: operateur.poste,
        is_admin: operateur.is_admin ? true : false,
        langue_preferee: operateur.langue_preferee || 'fr'
      }
    });
  } catch (error) {
    console.error('Erreur POST /auth/login-code:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

/**
 * GET /api/auth/me - Obtenir l'utilisateur courant
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId) {
      const [users] = await pool.query(
        'SELECT id, username, email, nom, prenom, role, actif, derniere_connexion, created_at, langue_preferee FROM users WHERE id = ?',
        [req.user.userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      res.json({ user: users[0] });
    } else if (req.user.operateurId) {
      const [operateurs] = await pool.query(
        'SELECT id, nom, prenom, matricule, poste, is_admin, actif, derniere_connexion, langue_preferee FROM operateurs WHERE id = ?',
        [req.user.operateurId]
      );

      if (operateurs.length === 0) {
        return res.status(404).json({ error: 'Opérateur non trouvé' });
      }

      const op = operateurs[0];
      res.json({ operateur: op, role: op.is_admin ? 'admin' : 'operateur' });
    } else {
      res.status(400).json({ error: 'Token invalide' });
    }
  } catch (error) {
    console.error('Erreur GET /auth/me:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/logout - Déconnexion (côté client principalement)
 */
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Déconnexion réussie' });
});

module.exports = router;
