/**
 * Routes API - Paramètres du Projet
 * CRUD pour les paramètres généraux du projet (logos, client, projet)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { projetUploadsDir } = require('../config/upload');

// Configuration Multer pour logos du projet
const projetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, projetUploadsDir);
  },
  filename: (req, file, cb) => {
    const fieldName = file.fieldname; // 'logo' ou 'client_logo'
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${fieldName}_${uniqueSuffix}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seules les images sont acceptées.'), false);
  }
};

const uploadLogos = multer({
  storage: projetStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ============================================================
// GET /api/projet-parametres - Récupérer les paramètres (public)
// ============================================================
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projet_parametres WHERE id = 1');
    
    if (rows.length === 0) {
      return res.json({ parametres: null });
    }

    res.json({ parametres: rows[0] });
  } catch (error) {
    console.error('Erreur récupération paramètres projet:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// PUT /api/projet-parametres - Mettre à jour les paramètres (admin)
// ============================================================
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_nom, client_adresse, projet_nom, projet_adresse, projet_code } = req.body;

    await pool.query(`
      UPDATE projet_parametres 
      SET client_nom = ?, client_adresse = ?, projet_nom = ?, projet_adresse = ?, projet_code = ?
      WHERE id = 1
    `, [client_nom || null, client_adresse || null, projet_nom || null, projet_adresse || null, projet_code || null]);

    const [rows] = await pool.query('SELECT * FROM projet_parametres WHERE id = 1');

    res.json({ message: 'Paramètres mis à jour avec succès', parametres: rows[0] });
  } catch (error) {
    console.error('Erreur mise à jour paramètres projet:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// POST /api/projet-parametres/logo - Upload logo entreprise (admin)
// ============================================================
router.post('/logo', authenticateToken, requireAdmin, uploadLogos.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Supprimer l'ancien logo s'il existe
    const [current] = await pool.query('SELECT logo_path FROM projet_parametres WHERE id = 1');
    if (current[0]?.logo_path) {
      const oldPath = path.join(__dirname, '../../', current[0].logo_path);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const logoPath = `uploads/projet/${req.file.filename}`;
    await pool.query('UPDATE projet_parametres SET logo_path = ? WHERE id = 1', [logoPath]);

    res.json({ message: 'Logo uploadé avec succès', logo_path: logoPath });
  } catch (error) {
    console.error('Erreur upload logo:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// POST /api/projet-parametres/client-logo - Upload logo client (admin)
// ============================================================
router.post('/client-logo', authenticateToken, requireAdmin, uploadLogos.single('client_logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    // Supprimer l'ancien logo s'il existe
    const [current] = await pool.query('SELECT client_logo_path FROM projet_parametres WHERE id = 1');
    if (current[0]?.client_logo_path) {
      const oldPath = path.join(__dirname, '../../', current[0].client_logo_path);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const logoPath = `uploads/projet/${req.file.filename}`;
    await pool.query('UPDATE projet_parametres SET client_logo_path = ? WHERE id = 1', [logoPath]);

    res.json({ message: 'Logo client uploadé avec succès', client_logo_path: logoPath });
  } catch (error) {
    console.error('Erreur upload logo client:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// DELETE /api/projet-parametres/logo - Supprimer logo entreprise (admin)
// ============================================================
router.delete('/logo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [current] = await pool.query('SELECT logo_path FROM projet_parametres WHERE id = 1');
    if (current[0]?.logo_path) {
      const oldPath = path.join(__dirname, '../../', current[0].logo_path);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await pool.query('UPDATE projet_parametres SET logo_path = NULL WHERE id = 1');
    res.json({ message: 'Logo supprimé' });
  } catch (error) {
    console.error('Erreur suppression logo:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============================================================
// DELETE /api/projet-parametres/client-logo - Supprimer logo client (admin)
// ============================================================
router.delete('/client-logo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [current] = await pool.query('SELECT client_logo_path FROM projet_parametres WHERE id = 1');
    if (current[0]?.client_logo_path) {
      const oldPath = path.join(__dirname, '../../', current[0].client_logo_path);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await pool.query('UPDATE projet_parametres SET client_logo_path = NULL WHERE id = 1');
    res.json({ message: 'Logo client supprimé' });
  } catch (error) {
    console.error('Erreur suppression logo client:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
