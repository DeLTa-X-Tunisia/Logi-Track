/**
 * Routes API pour la gestion des bobines
 * Module Bobines - LogiTrack
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { uploadBobinePhotos, bobinesUploadsDir } = require('../config/upload');
const path = require('path');
const fs = require('fs');

// Appliquer l'authentification à toutes les routes
router.use(authenticateToken);

// Validation des données bobine
const bobineValidation = [
  body('numero').notEmpty().withMessage('Le code bobine est requis'),
  body('epaisseur').isFloat({ min: 0 }).withMessage('L\'épaisseur doit être un nombre positif'),
  body('poids').optional().isFloat({ min: 0 }).withMessage('Le poids doit être un nombre positif')
];

// GET /api/bobines - Liste toutes les bobines
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, 
             sg.code as steel_grade_code,
             sg.nom as steel_grade_nom,
             COALESCE(b.norme, sg.specification) as norme_display,
             COUNT(t.id) as nombre_tubes,
             SUM(CASE WHEN t.statut = 'termine' THEN 1 ELSE 0 END) as tubes_termines
      FROM bobines b
      LEFT JOIN steel_grades sg ON b.steel_grade_id = sg.id
      LEFT JOIN coulees c2 ON c2.bobine_id = b.id
      LEFT JOIN tubes t ON t.coulee_id = c2.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Erreur GET /bobines:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des bobines' });
  }
});

// GET /api/bobines/stats - Statistiques des bobines
router.get('/stats', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'en_stock' THEN 1 ELSE 0 END) as en_stock,
        SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as en_cours,
        SUM(CASE WHEN statut = 'epuisee' THEN 1 ELSE 0 END) as epuisees,
        SUM(poids) as poids_total
      FROM bobines
    `);
    
    const [parGrade] = await pool.query(`
      SELECT 
        COALESCE(sg.code, 'Non défini') as grade,
        COUNT(*) as count
      FROM bobines b
      LEFT JOIN steel_grades sg ON b.steel_grade_id = sg.id
      GROUP BY sg.code
      ORDER BY count DESC
      LIMIT 5
    `);
    
    res.json({
      ...stats[0],
      par_grade: parGrade
    });
  } catch (error) {
    console.error('Erreur GET /bobines/stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// GET /api/bobines/steel-grades - Liste des steel grades pour dropdown
router.get('/steel-grades', async (req, res) => {
  try {
    const [grades] = await pool.query(`
      SELECT id, code, nom, specification as norme,
             limite_elastique_min, limite_elastique_max,
             resistance_traction_min, resistance_traction_max
      FROM steel_grades 
      WHERE actif = TRUE
      ORDER BY specification, code
    `);
    res.json(grades);
  } catch (error) {
    console.error('Erreur GET /bobines/steel-grades:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des grades' });
  }
});

// GET /api/bobines/:id - Détail d'une bobine
router.get('/:id', async (req, res) => {
  try {
    const [bobines] = await pool.query(`
      SELECT b.*, 
             sg.code as steel_grade_code,
             sg.nom as steel_grade_nom,
             sg.specification as steel_grade_norme
      FROM bobines b
      LEFT JOIN steel_grades sg ON b.steel_grade_id = sg.id
      WHERE b.id = ?
    `, [req.params.id]);
    
    if (bobines.length === 0) {
      return res.status(404).json({ error: 'Bobine non trouvée' });
    }

    // Récupérer les tubes associés (via coulées)
    const [tubes] = await pool.query(`
      SELECT t.*, te_cur.etape_code as etape_nom
      FROM tubes t
      LEFT JOIN coulees c2 ON t.coulee_id = c2.id
      LEFT JOIN tube_etapes te_cur ON te_cur.tube_id = t.id AND te_cur.etape_numero = t.etape_courante
      WHERE c2.bobine_id = ?
      ORDER BY t.created_at DESC
    `, [req.params.id]);
    
    res.json({ ...bobines[0], tubes });
  } catch (error) {
    console.error('Erreur GET /bobines/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la bobine' });
  }
});

// POST /api/bobines - Créer une bobine
router.post('/', bobineValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      numero, steel_grade_id, norme,
      epaisseur, largeur, poids, fournisseur,
      date_reception, notes
    } = req.body;

    // Récupérer les infos du créateur depuis le token
    const created_by = req.user?.operateurId || req.user?.userId || null;
    const createur_nom = req.user?.nom || null;
    const createur_prenom = req.user?.prenom || null;

    const [result] = await pool.query(
      `INSERT INTO bobines 
       (numero, steel_grade_id, norme, epaisseur, largeur, poids, fournisseur, date_reception, notes, created_by, createur_nom, createur_prenom, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_stock')`,
      [numero, steel_grade_id || null, norme || 'API 5L', epaisseur, largeur || null, poids || null, fournisseur || null, date_reception || null, notes || null, created_by, createur_nom, createur_prenom]
    );

    const [newBobine] = await pool.query(`
      SELECT b.*, 
             sg.code as steel_grade_code, 
             sg.nom as steel_grade_nom
      FROM bobines b
      LEFT JOIN steel_grades sg ON b.steel_grade_id = sg.id
      WHERE b.id = ?
    `, [result.insertId]);

    res.status(201).json(newBobine[0]);
  } catch (error) {
    console.error('Erreur POST /bobines:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ce code bobine existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la création de la bobine' });
  }
});

// PUT /api/bobines/:id - Modifier une bobine
router.put('/:id', bobineValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const {
      numero, steel_grade_id, norme,
      epaisseur, largeur, poids, fournisseur,
      date_reception, notes
    } = req.body;

    // Récupérer les infos du modificateur depuis le token
    const updated_by = req.user?.operateurId || req.user?.userId || null;
    const modificateur_nom = req.user?.nom || null;
    const modificateur_prenom = req.user?.prenom || null;

    // Note: le statut n'est PAS modifiable manuellement — il est géré automatiquement
    // (en_stock à la création, en_cours quand utilisée dans une coulée)
    const [result] = await pool.query(
      `UPDATE bobines SET
       numero = ?, steel_grade_id = ?, norme = ?,
       epaisseur = ?, largeur = ?, poids = ?, fournisseur = ?,
       date_reception = ?, notes = ?, updated_by = ?,
       modificateur_nom = ?, modificateur_prenom = ?
       WHERE id = ?`,
      [numero, steel_grade_id || null, norme || 'API 5L', epaisseur, largeur || null, poids || null, fournisseur || null, date_reception || null, notes || null, updated_by, modificateur_nom, modificateur_prenom, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bobine non trouvée' });
    }

    const [updatedBobine] = await pool.query(`
      SELECT b.*, 
             sg.code as steel_grade_code, 
             sg.nom as steel_grade_nom
      FROM bobines b
      LEFT JOIN steel_grades sg ON b.steel_grade_id = sg.id
      WHERE b.id = ?
    `, [id]);

    res.json(updatedBobine[0]);
  } catch (error) {
    console.error('Erreur PUT /bobines/:id:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ce code bobine existe déjà' });
    }
    res.status(500).json({ error: 'Erreur lors de la modification de la bobine' });
  }
});

// DELETE /api/bobines/:id - Supprimer une bobine
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier s'il y a des coulées associées
    const [coulees] = await pool.query('SELECT COUNT(*) as count FROM coulees WHERE bobine_id = ?', [id]);
    if (coulees[0].count > 0) {
      return res.status(400).json({ 
        error: `Impossible de supprimer cette bobine : ${coulees[0].count} coulée(s) associée(s)` 
      });
    }

    const [result] = await pool.query('DELETE FROM bobines WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bobine non trouvée' });
    }

    res.json({ message: 'Bobine supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /bobines/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la bobine' });
  }
});

// PUT /api/bobines/:id/statut - Changer le statut d'une bobine
router.put('/:id/statut', async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    const updated_by = req.user?.operateurId || null;

    if (!['en_stock', 'en_cours', 'epuisee'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const [result] = await pool.query(
      'UPDATE bobines SET statut = ?, updated_by = ? WHERE id = ?',
      [statut, updated_by, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bobine non trouvée' });
    }

    res.json({ message: 'Statut mis à jour', statut });
  } catch (error) {
    console.error('Erreur PUT /bobines/:id/statut:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

// ============================================
// ROUTES PHOTOS
// ============================================

// GET /api/bobines/:id/photos - Liste des photos d'une bobine
router.get('/:id/photos', async (req, res) => {
  try {
    const [photos] = await pool.query(`
      SELECT bp.*, o.nom as uploader_nom, o.prenom as uploader_prenom
      FROM bobine_photos bp
      LEFT JOIN operateurs o ON bp.uploaded_by = o.id
      WHERE bp.bobine_id = ?
      ORDER BY bp.created_at DESC
    `, [req.params.id]);
    res.json(photos);
  } catch (error) {
    console.error('Erreur GET /bobines/:id/photos:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des photos' });
  }
});

// POST /api/bobines/:id/photos - Upload de photos (max 5)
router.post('/:id/photos', uploadBobinePhotos.array('photos', 5), async (req, res) => {
  try {
    const bobineId = req.params.id;
    const uploaded_by = req.user?.operateurId || null;

    // Vérifier que la bobine existe
    const [bobine] = await pool.query('SELECT id FROM bobines WHERE id = ?', [bobineId]);
    if (bobine.length === 0) {
      // Supprimer les fichiers uploadés si la bobine n'existe pas
      if (req.files) {
        req.files.forEach(file => fs.unlinkSync(file.path));
      }
      return res.status(404).json({ error: 'Bobine non trouvée' });
    }

    // Vérifier le nombre total de photos (max 5)
    const [existingPhotos] = await pool.query(
      'SELECT COUNT(*) as count FROM bobine_photos WHERE bobine_id = ?',
      [bobineId]
    );
    const currentCount = existingPhotos[0].count;
    const newCount = req.files ? req.files.length : 0;

    if (currentCount + newCount > 5) {
      // Supprimer les fichiers uploadés
      if (req.files) {
        req.files.forEach(file => fs.unlinkSync(file.path));
      }
      return res.status(400).json({ 
        error: `Maximum 5 photos par bobine. Actuellement: ${currentCount}, tentative d'ajout: ${newCount}` 
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    // Insérer les photos en base
    const insertedPhotos = [];
    for (const file of req.files) {
      const [result] = await pool.query(
        `INSERT INTO bobine_photos 
         (bobine_id, filename, original_name, mimetype, size, path, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          bobineId,
          file.filename,
          file.originalname,
          file.mimetype,
          file.size,
          `/uploads/bobines/${file.filename}`,
          uploaded_by
        ]
      );
      insertedPhotos.push({
        id: result.insertId,
        filename: file.filename,
        original_name: file.originalname,
        path: `/uploads/bobines/${file.filename}`
      });
    }

    res.status(201).json({
      message: `${insertedPhotos.length} photo(s) uploadée(s) avec succès`,
      photos: insertedPhotos
    });
  } catch (error) {
    console.error('Erreur POST /bobines/:id/photos:', error);
    // Nettoyer les fichiers en cas d'erreur
    if (req.files) {
      req.files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
    }
    res.status(500).json({ error: 'Erreur lors de l\'upload des photos' });
  }
});

// DELETE /api/bobines/:id/photos/:photoId - Supprimer une photo
router.delete('/:id/photos/:photoId', async (req, res) => {
  try {
    const { id, photoId } = req.params;

    // Récupérer les infos de la photo
    const [photos] = await pool.query(
      'SELECT * FROM bobine_photos WHERE id = ? AND bobine_id = ?',
      [photoId, id]
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: 'Photo non trouvée' });
    }

    const photo = photos[0];

    // Supprimer le fichier physique
    const filePath = path.join(bobinesUploadsDir, photo.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Supprimer l'entrée en base
    await pool.query('DELETE FROM bobine_photos WHERE id = ?', [photoId]);

    res.json({ message: 'Photo supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /bobines/:id/photos/:photoId:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la photo' });
  }
});

// ============================================
// RAPPORT PDF
// ============================================

// GET /api/bobines/:id/pdf - Générer un rapport PDF de la bobine
router.get('/:id/pdf', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    
    // Récupérer les données de la bobine
    const [bobines] = await pool.query(`
      SELECT b.*, 
             sg.code as steel_grade_code,
             sg.nom as steel_grade_nom,
             sg.specification as steel_grade_norme
      FROM bobines b
      LEFT JOIN steel_grades sg ON b.steel_grade_id = sg.id
      WHERE b.id = ?
    `, [req.params.id]);

    if (bobines.length === 0) {
      return res.status(404).json({ error: 'Bobine non trouvée' });
    }

    const bobine = bobines[0];

    // Récupérer les photos
    const [photos] = await pool.query(
      'SELECT * FROM bobine_photos WHERE bobine_id = ? ORDER BY created_at',
      [req.params.id]
    );

    // Récupérer les paramètres du projet
    const [projetRows] = await pool.query('SELECT * FROM projet_parametres LIMIT 1');
    const projet = projetRows.length > 0 ? projetRows[0] : {};

    // Créer le document PDF
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 40,
      info: {
        Title: `Rapport Bobine ${bobine.numero}`,
        Author: 'LogiTrack',
        Subject: 'Fiche technique bobine'
      }
    });

    // Headers pour le téléchargement
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bobine_${bobine.numero}.pdf`);
    
    doc.pipe(res);

    // Couleurs
    const primary = '#1e40af';
    const accent = '#2563eb';
    const gray = '#6b7280';
    const lightGray = '#f3f4f6';
    const border = '#e5e7eb';
    const pageWidth = doc.page.width - 80; // 40 margin each side

    // Footer function (saves/restores cursor position)
    const footerText = `LogiTrack — Fiche Bobine ${bobine.numero} — ${new Date().toLocaleDateString('fr-FR')}`;
    const drawFooter = () => {
      const savedX = doc.x;
      const savedY = doc.y;
      const savedBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // Empêcher l'auto-pagination du footer
      const footerY = doc.page.height - 35;
      doc.save();
      doc.strokeColor(border).lineWidth(0.5)
         .moveTo(40, footerY - 5).lineTo(40 + pageWidth, footerY - 5).stroke();
      doc.fillColor(gray).fontSize(7).font('Helvetica')
         .text(footerText, 40, footerY, { align: 'center', width: pageWidth });
      doc.restore();
      doc.page.margins.bottom = savedBottomMargin;
      doc.x = savedX;
      doc.y = savedY;
    };

    // =========================================
    // HEADER — Bandeau projet avec logos
    // =========================================
    const headerTop = 40;
    const headerHeight = 65;
    const headerLeft = 40;
    const headerRight = headerLeft + pageWidth;

    // Fond du header
    doc.rect(headerLeft, headerTop, pageWidth, headerHeight)
       .fillAndStroke(lightGray, border);

    // Layout: [Logo Entreprise] [sep] [Logo Client]    [Texte Projet -->]
    const logoMaxH = 45;
    const logoY = headerTop + 10;
    const logoMaxW = 75;
    let logosEndX = headerLeft + 10; // track where logos end

    // Logo entreprise
    if (projet.logo_path) {
      const logoPath = path.join(__dirname, '..', '..', projet.logo_path);
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, logosEndX, logoY, { fit: [logoMaxW, logoMaxH] });
          logosEndX += logoMaxW + 8;
        } catch (e) { /* skip */ }
      }
    }

    // Séparateur vertical entre logos
    if (projet.logo_path && projet.client_logo_path) {
      doc.strokeColor('#d1d5db').lineWidth(0.5)
         .moveTo(logosEndX, logoY + 3).lineTo(logosEndX, logoY + logoMaxH - 3).stroke();
      logosEndX += 8;
    }

    // Logo client
    if (projet.client_logo_path) {
      const clientLogoPath = path.join(__dirname, '..', '..', projet.client_logo_path);
      if (fs.existsSync(clientLogoPath)) {
        try {
          doc.image(clientLogoPath, logosEndX, logoY, { fit: [logoMaxW, logoMaxH] });
          logosEndX += logoMaxW + 8;
        } catch (e) { /* skip */ }
      }
    }

    // Séparateur vertical avant texte
    doc.strokeColor('#d1d5db').lineWidth(0.5)
       .moveTo(logosEndX, logoY + 3).lineTo(logosEndX, logoY + logoMaxH - 3).stroke();
    const textStartX = logosEndX + 10;
    const textMaxW = headerRight - textStartX - 10;

    // Infos projet à droite des logos
    let textY = headerTop + 10;

    if (projet.client_nom) {
      doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
         .text(projet.client_nom, textStartX, textY, { width: textMaxW });
      textY += 15;
    }
    if (projet.projet_nom) {
      doc.fillColor(gray).fontSize(7.5).font('Helvetica')
         .text(projet.projet_nom, textStartX, textY, { width: textMaxW });
      textY += 10;
    }
    if (projet.client_adresse || projet.projet_adresse) {
      doc.fillColor(gray).fontSize(7).font('Helvetica')
         .text([projet.client_adresse, projet.projet_adresse].filter(Boolean).join(' — '), textStartX, textY, { width: textMaxW });
      textY += 10;
    }
    if (projet.projet_code) {
      doc.fillColor(accent).fontSize(9).font('Helvetica-Bold')
         .text(projet.projet_code, textStartX, textY);
    }

    // =========================================
    // TITRE DU RAPPORT
    // =========================================
    let yPos = headerTop + headerHeight + 14;

    doc.fillColor(primary).fontSize(16).font('Helvetica-Bold')
       .text(`Fiche Bobine : ${bobine.numero}`, 40, yPos, { align: 'center', width: pageWidth });
    yPos += 20;

    doc.fillColor(gray).fontSize(8).font('Helvetica')
       .text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 40, yPos, { align: 'center', width: pageWidth });
    yPos += 16;

    // Ligne de séparation fine
    doc.strokeColor(primary).lineWidth(1.5)
       .moveTo(40, yPos).lineTo(40 + pageWidth, yPos).stroke();
    yPos += 12;

    // =========================================
    // HELPERS
    // =========================================
    const sectionTitle = (title, y) => {
      doc.rect(40, y, pageWidth, 20).fill(primary);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
         .text(title, 48, y + 5, { width: pageWidth - 16 });
      return y + 26;
    };

    const infoRow = (label, value, y, col2) => {
      const labelW = 120;
      const baseX = col2 ? 40 + pageWidth / 2 + 5 : 48;
      const valX = baseX + labelW;
      const maxW = col2 ? pageWidth / 2 - 15 - labelW : pageWidth / 2 - 15 - labelW;
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(label, baseX, y, { width: labelW });
      doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text(value || '—', valX, y, { width: Math.max(maxW, 100) });
    };

    const checkNewPage = (needed) => {
      if (yPos + needed > doc.page.height - 60) {
        drawFooter();
        doc.addPage();
        yPos = 40;
      }
    };

    // =========================================
    // SECTION 1 — INFORMATIONS GÉNÉRALES (2 colonnes)
    // =========================================
    checkNewPage(90);
    yPos = sectionTitle('INFORMATIONS GÉNÉRALES', yPos);

    const statutLabel = bobine.statut === 'en_stock' ? 'Disponible' : bobine.statut === 'en_cours' ? 'En cours' : 'Épuisée';

    infoRow('Code Bobine :', bobine.numero, yPos, false);
    infoRow('Statut :', statutLabel, yPos, true);
    yPos += 16;
    infoRow('Norme :', bobine.norme || 'API 5L', yPos, false);
    infoRow('Fournisseur :', bobine.fournisseur || '—', yPos, true);
    yPos += 16;
    const gradeText = bobine.steel_grade_code ? `${bobine.steel_grade_code} – ${bobine.steel_grade_nom || ''}` : '—';
    const dateReception = bobine.date_reception ? new Date(bobine.date_reception).toLocaleDateString('fr-FR') : '—';
    infoRow('Grade (Nuance) :', gradeText, yPos, false);
    infoRow('Date réception :', dateReception, yPos, true);
    yPos += 20;

    // =========================================
    // SECTION 2 — CARACTÉRISTIQUES TECHNIQUES
    // =========================================
    checkNewPage(70);
    yPos = sectionTitle('CARACTÉRISTIQUES TECHNIQUES', yPos);

    infoRow('Épaisseur :', bobine.epaisseur ? `${bobine.epaisseur} mm` : '—', yPos, false);
    infoRow('Poids :', bobine.poids ? `${new Intl.NumberFormat('fr-FR').format(bobine.poids)} kg` : '—', yPos, true);
    yPos += 16;
    infoRow('Largeur :', bobine.largeur ? `${bobine.largeur} mm` : '—', yPos, false);
    yPos += 20;

    // =========================================
    // SECTION 3 — NOTES (si présentes)
    // =========================================
    if (bobine.notes) {
      const notesHeight = doc.heightOfString(bobine.notes, { width: pageWidth - 20 });
      checkNewPage(40 + notesHeight);
      yPos = sectionTitle('NOTES', yPos);
      doc.fillColor('#111827').fontSize(9).font('Helvetica')
         .text(bobine.notes, 48, yPos, { width: pageWidth - 20 });
      yPos += notesHeight + 12;
    }

    // =========================================
    // SECTION 4 — TRAÇABILITÉ
    // =========================================
    checkNewPage(60);
    yPos = sectionTitle('TRAÇABILITÉ', yPos);

    const createur = bobine.createur_prenom && bobine.createur_nom
      ? `${bobine.createur_prenom} ${bobine.createur_nom}` : '—';
    const dateCreation = bobine.created_at ? new Date(bobine.created_at).toLocaleDateString('fr-FR') : '—';
    infoRow('Créé par :', createur, yPos, false);
    infoRow('Date création :', dateCreation, yPos, true);

    if (bobine.modificateur_prenom && bobine.modificateur_nom) {
      yPos += 16;
      const modificateur = `${bobine.modificateur_prenom} ${bobine.modificateur_nom}`;
      const dateModif = bobine.updated_at ? new Date(bobine.updated_at).toLocaleDateString('fr-FR') : '—';
      infoRow('Modifié par :', modificateur, yPos, false);
      infoRow('Date modification :', dateModif, yPos, true);
    }
    yPos += 20;

    // =========================================
    // SECTION 5 — PHOTOS (max 4, grille 2x2)
    // =========================================
    const displayPhotos = photos.slice(0, 4); // Max 4 photos
    if (displayPhotos.length > 0) {
      const photosPerRow = 2;
      const photoGap = 10;
      const photoW = Math.floor((pageWidth - photoGap) / photosPerRow);
      const photoH = Math.floor(photoW * 0.65);
      const totalRows = Math.ceil(displayPhotos.length / photosPerRow);
      const neededHeight = 25 + totalRows * (photoH + photoGap);

      checkNewPage(neededHeight);
      yPos = sectionTitle(`PHOTOS DE LA BOBINE (${displayPhotos.length}${photos.length > 4 ? '/' + photos.length : ''})`, yPos);

      for (let i = 0; i < displayPhotos.length; i++) {
        const col = i % photosPerRow;
        if (col === 0 && i > 0) {
          yPos += photoH + photoGap;
        }
        const photoX = 40 + col * (photoW + photoGap);
        const photo = displayPhotos[i];
        const imagePath = path.join(bobinesUploadsDir, photo.filename);

        if (fs.existsSync(imagePath)) {
          try {
            doc.image(imagePath, photoX, yPos, {
              fit: [photoW, photoH],
              align: 'center',
              valign: 'center'
            });
            doc.strokeColor(border).lineWidth(0.5)
               .rect(photoX, yPos, photoW, photoH).stroke();
          } catch (imgError) {
            doc.rect(photoX, yPos, photoW, photoH).fillAndStroke(lightGray, border);
            doc.fillColor(gray).fontSize(8)
               .text('Image non disponible', photoX + 20, yPos + photoH / 2 - 5);
          }
        }
      }
      yPos += photoH + 10;
    }

    // Footer on the last (or only) page
    drawFooter();

    doc.end();

  } catch (error) {
    console.error('Erreur GET /bobines/:id/pdf:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

module.exports = router;
