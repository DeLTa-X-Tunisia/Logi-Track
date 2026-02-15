/**
 * Routes API Coulées simplifiées
 * Coulée = Début de poste/production avec suivi bobine
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Authentification requise
router.use(authenticateToken);

// ============================================
// GET /api/coulees - Liste des coulées
// ============================================
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, 
             b.numero as bobine_numero,
             b.epaisseur as bobine_epaisseur,
             b.largeur as bobine_largeur,
             b.poids as bobine_poids,
             mr_rec.libelle as motif_reception_libelle,
             mr_inst.libelle as motif_installation_libelle,
             pp.numero as parametre_numero
      FROM coulees c
      LEFT JOIN bobines b ON c.bobine_id = b.id
      LEFT JOIN motifs_retard mr_rec ON c.motif_retard_reception_id = mr_rec.id
      LEFT JOIN motifs_retard mr_inst ON c.motif_retard_installation_id = mr_inst.id
      LEFT JOIN parametres_production pp ON c.parametre_id = pp.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Erreur GET /coulees:', error);
    res.status(500).json({ error: 'Erreur récupération coulées' });
  }
});

// ============================================
// GET /api/coulees/prochain-numero - Prochain numéro
// ============================================
router.get('/prochain-numero', async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT MAX(CAST(numero AS UNSIGNED)) as max_num FROM coulees 
      WHERE numero REGEXP '^[0-9]+$'
    `);
    
    let prochainNumero;
    if (result.length === 0 || result[0].max_num === null) {
      // Premier numéro: 1
      prochainNumero = '1';
    } else {
      // Incrémenter le max
      prochainNumero = String(result[0].max_num + 1);
    }
    
    res.json({ numero: prochainNumero });
  } catch (error) {
    console.error('Erreur prochain-numero:', error);
    res.status(500).json({ error: 'Erreur génération numéro' });
  }
});

// ============================================
// GET /api/coulees/bobines-disponibles - Bobines en stock uniquement
// ============================================
router.get('/bobines-disponibles', async (req, res) => {
  try {
    const [bobines] = await pool.query(`
      SELECT id, numero, epaisseur, largeur, poids, fournisseur, statut
      FROM bobines 
      WHERE statut = 'en_stock'
      ORDER BY numero DESC
    `);
    res.json(bobines);
  } catch (error) {
    console.error('Erreur bobines-disponibles:', error);
    res.status(500).json({ error: 'Erreur récupération bobines' });
  }
});

// ============================================
// GET /api/coulees/motifs-retard - Motifs de retard
// ============================================
router.get('/motifs-retard', async (req, res) => {
  try {
    const { etape } = req.query;
    let query = 'SELECT * FROM motifs_retard WHERE actif = TRUE';
    const params = [];
    
    if (etape) {
      query += ' AND (etape = ? OR etape = "general")';
      params.push(etape);
    }
    
    query += ' ORDER BY etape, ordre';
    
    const [motifs] = await pool.query(query, params);
    
    // Grouper par étape
    const grouped = {
      reception: motifs.filter(m => m.etape === 'reception' || m.etape === 'general'),
      installation: motifs.filter(m => m.etape === 'installation' || m.etape === 'general')
    };
    
    res.json({ motifs, grouped });
  } catch (error) {
    console.error('Erreur motifs-retard:', error);
    res.status(500).json({ error: 'Erreur récupération motifs' });
  }
});

// ============================================
// GET /api/coulees/stats - Statistiques
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as en_cours,
        SUM(CASE WHEN statut = 'pret_production' THEN 1 ELSE 0 END) as pret_production,
        SUM(CASE WHEN statut = 'en_production' THEN 1 ELSE 0 END) as en_production,
        SUM(CASE WHEN statut = 'termine' THEN 1 ELSE 0 END) as termine,
        SUM(retard_reception_minutes) as total_retard_reception,
        SUM(retard_installation_minutes) as total_retard_installation
      FROM coulees
    `);
    res.json(stats[0]);
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur stats' });
  }
});

// ============================================
// GET /api/coulees/:id/pdf - Rapport PDF de la coulée
// ============================================
router.get('/:id/pdf', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');

    // Récupérer la coulée avec toutes les infos
    const [rows] = await pool.query(`
      SELECT c.*, 
             b.numero as bobine_numero,
             b.epaisseur as bobine_epaisseur,
             b.largeur as bobine_largeur,
             b.poids as bobine_poids,
             b.fournisseur as bobine_fournisseur,
             b.norme as bobine_norme,
             mr_rec.libelle as motif_reception_libelle,
             mr_rec.categorie as motif_reception_categorie,
             mr_inst.libelle as motif_installation_libelle,
             mr_inst.categorie as motif_installation_categorie,
             pp.numero as parametre_numero,
             pp.strip_vitesse_m, pp.strip_vitesse_cm,
             pp.milling_edge_gauche, pp.milling_edge_droit,
             pp.pression_rouleaux, pp.pression_rouleaux_unite,
             pp.tack_amperage, pp.tack_voltage, pp.tack_vitesse_m, pp.tack_vitesse_cm,
             pp.tack_frequence, pp.tack_type_gaz, pp.tack_debit_gaz,
             pp.soudure_vitesse_m, pp.soudure_vitesse_cm,
             pp.soudure_type_fil, pp.soudure_type_flux,
             src.numero as source_coulee_numero
      FROM coulees c
      LEFT JOIN bobines b ON c.bobine_id = b.id
      LEFT JOIN motifs_retard mr_rec ON c.motif_retard_reception_id = mr_rec.id
      LEFT JOIN motifs_retard mr_inst ON c.motif_retard_installation_id = mr_inst.id
      LEFT JOIN parametres_production pp ON c.parametre_id = pp.id
      LEFT JOIN coulees src ON c.checklist_source_coulee_id = src.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Coulée non trouvée' });
    }

    const coulee = rows[0];

    // Récupérer les tubes produits dans cette coulée
    const [tubes] = await pool.query(`
      SELECT t.numero, t.longueur, t.diametre_mm, t.diametre_pouce, t.epaisseur, t.poids, t.statut, t.created_at
      FROM tubes t WHERE t.coulee_id = ? ORDER BY t.created_at
    `, [req.params.id]);

    // Récupérer les paramètres du projet
    const [projetRows] = await pool.query('SELECT * FROM projet_parametres LIMIT 1');
    const projet = projetRows.length > 0 ? projetRows[0] : {};

    // Créer le document PDF
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 40,
      info: {
        Title: `Rapport Coulée ${coulee.numero}`,
        Author: 'LogiTrack',
        Subject: 'Rapport de coulée'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=coulee_${coulee.numero}.pdf`);
    doc.pipe(res);

    // Couleurs
    const primary = '#92400e';
    const accent = '#d97706';
    const gray = '#6b7280';
    const lightGray = '#f3f4f6';
    const border = '#e5e7eb';
    const green = '#059669';
    const red = '#dc2626';
    const orange = '#ea580c';
    const blue = '#2563eb';
    const pageWidth = doc.page.width - 80;

    // Helpers
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const formatDateTime = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const formatDuree = (mins) => {
      if (!mins || mins <= 0) return '0 mn';
      const j = Math.floor(mins / 1440);
      const h = Math.floor((mins % 1440) / 60);
      const m = mins % 60;
      const parts = [];
      if (j > 0) parts.push(`${j}j`);
      if (h > 0) parts.push(`${h}h`);
      parts.push(`${m}mn`);
      return parts.join(' ');
    };

    // Footer
    const footerText = `LogiTrack — Rapport Coulée ${coulee.numero} — ${new Date().toLocaleDateString('fr-FR')}`;
    const drawFooter = () => {
      const savedX = doc.x;
      const savedY = doc.y;
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 35;
      doc.save();
      doc.strokeColor(border).lineWidth(0.5)
         .moveTo(40, footerY - 5).lineTo(40 + pageWidth, footerY - 5).stroke();
      doc.fillColor(gray).fontSize(7).font('Helvetica')
         .text(footerText, 40, footerY, { align: 'center', width: pageWidth });
      doc.restore();
      doc.page.margins.bottom = savedBottom;
      doc.x = savedX;
      doc.y = savedY;
    };

    let yPos = 40;

    // HEADER
    const headerTop = 40;
    const headerHeight = 65;
    const headerLeft = 40;
    const headerRight = headerLeft + pageWidth;

    doc.rect(headerLeft, headerTop, pageWidth, headerHeight)
       .fillAndStroke(lightGray, border);

    const logoMaxH = 45;
    const logoY = headerTop + 10;
    const logoMaxW = 75;
    let logosEndX = headerLeft + 10;

    if (projet.logo_path) {
      const logoPath = path.join(__dirname, '..', '..', projet.logo_path);
      if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, logosEndX, logoY, { fit: [logoMaxW, logoMaxH] }); logosEndX += logoMaxW + 8; } catch (e) { /* skip */ }
      }
    }
    if (projet.logo_path && projet.client_logo_path) {
      doc.strokeColor('#d1d5db').lineWidth(0.5)
         .moveTo(logosEndX, logoY + 3).lineTo(logosEndX, logoY + logoMaxH - 3).stroke();
      logosEndX += 8;
    }
    if (projet.client_logo_path) {
      const clientLogoPath = path.join(__dirname, '..', '..', projet.client_logo_path);
      if (fs.existsSync(clientLogoPath)) {
        try { doc.image(clientLogoPath, logosEndX, logoY, { fit: [logoMaxW, logoMaxH] }); logosEndX += logoMaxW + 8; } catch (e) { /* skip */ }
      }
    }

    doc.strokeColor('#d1d5db').lineWidth(0.5)
       .moveTo(logosEndX, logoY + 3).lineTo(logosEndX, logoY + logoMaxH - 3).stroke();
    const textStartX = logosEndX + 10;
    const textMaxW = headerRight - textStartX - 10;

    let textY = headerTop + 10;
    if (projet.client_nom) {
      doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
         .text(projet.client_nom, textStartX, textY, { width: textMaxW }); textY += 15;
    }
    if (projet.projet_nom) {
      doc.fillColor(gray).fontSize(7.5).font('Helvetica')
         .text(projet.projet_nom, textStartX, textY, { width: textMaxW }); textY += 10;
    }
    if (projet.client_adresse || projet.projet_adresse) {
      doc.fillColor(gray).fontSize(7).font('Helvetica')
         .text([projet.client_adresse, projet.projet_adresse].filter(Boolean).join(' — '), textStartX, textY, { width: textMaxW }); textY += 10;
    }
    if (projet.projet_code) {
      doc.fillColor(accent).fontSize(9).font('Helvetica-Bold').text(projet.projet_code, textStartX, textY);
    }

    // TITRE
    yPos = headerTop + headerHeight + 14;
    doc.fillColor(primary).fontSize(16).font('Helvetica-Bold')
       .text(`Rapport de Coulée N° ${coulee.numero}`, 40, yPos, { align: 'center', width: pageWidth });
    yPos += 20;
    doc.fillColor(gray).fontSize(8).font('Helvetica')
       .text(`Généré le ${formatDate(new Date())} à ${new Date().toLocaleTimeString('fr-FR')}`, 40, yPos, { align: 'center', width: pageWidth });
    yPos += 16;

    doc.strokeColor(primary).lineWidth(1.5)
       .moveTo(40, yPos).lineTo(40 + pageWidth, yPos).stroke();
    yPos += 12;

    // HELPERS
    const sectionTitle = (title, y) => {
      doc.rect(40, y, pageWidth, 20).fill(primary);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
         .text(title, 48, y + 5, { width: pageWidth - 16 });
      return y + 26;
    };

    const infoRow = (label, value, y, col2) => {
      const labelW = 130;
      const baseX = col2 ? 40 + pageWidth / 2 + 5 : 48;
      const valX = baseX + labelW;
      const maxW = col2 ? pageWidth / 2 - 15 - labelW : pageWidth / 2 - 15 - labelW;
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(label, baseX, y, { width: labelW });
      doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text(value || '—', valX, y, { width: Math.max(maxW, 100) });
    };

    const infoRowColored = (label, value, y, col2, color) => {
      const labelW = 130;
      const baseX = col2 ? 40 + pageWidth / 2 + 5 : 48;
      const valX = baseX + labelW;
      const maxW = col2 ? pageWidth / 2 - 15 - labelW : pageWidth / 2 - 15 - labelW;
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(label, baseX, y, { width: labelW });
      doc.fillColor(color).fontSize(9).font('Helvetica-Bold').text(value || '—', valX, y, { width: Math.max(maxW, 100) });
    };

    const checkNewPage = (needed) => {
      if (yPos + needed > doc.page.height - 60) {
        drawFooter();
        doc.addPage();
        yPos = 40;
      }
    };

    // SECTION 1 — INFORMATIONS GÉNÉRALES
    checkNewPage(90);
    yPos = sectionTitle('INFORMATIONS GÉNÉRALES', yPos);

    const statutLabels = {
      en_cours: 'En cours', pret_production: 'Prêt production',
      en_production: 'En production', termine: 'Terminée', annule: 'Annulée'
    };
    const statutColors = {
      en_cours: blue, pret_production: green,
      en_production: orange, termine: gray, annule: red
    };

    infoRow('N° Coulée :', coulee.numero, yPos, false);
    infoRowColored('Statut :', statutLabels[coulee.statut] || coulee.statut, yPos, true, statutColors[coulee.statut] || gray);
    yPos += 16;
    infoRow('Démarrée le :', formatDateTime(coulee.created_at), yPos, false);
    infoRow('Date de fin :', coulee.date_fin ? formatDateTime(coulee.date_fin) : 'En cours', yPos, true);
    yPos += 16;
    const operateur = coulee.operateur_prenom && coulee.operateur_nom
      ? `${coulee.operateur_prenom} ${coulee.operateur_nom}` : '—';
    infoRow('Opérateur :', operateur, yPos, false);
    if (coulee.parametre_numero) {
      infoRow('Preset Production :', coulee.parametre_numero, yPos, true);
    }
    yPos += 20;

    // SECTION 2 — BOBINE UTILISÉE
    checkNewPage(80);
    yPos = sectionTitle('BOBINE UTILISÉE', yPos);

    if (coulee.bobine_numero) {
      infoRow('N° Bobine :', coulee.bobine_numero, yPos, false);
      infoRow('Fournisseur :', coulee.bobine_fournisseur || '—', yPos, true);
      yPos += 16;
      infoRow('Épaisseur :', coulee.bobine_epaisseur ? `${coulee.bobine_epaisseur} mm` : '—', yPos, false);
      infoRow('Largeur :', coulee.bobine_largeur ? `${coulee.bobine_largeur} mm` : '—', yPos, true);
      yPos += 16;
      infoRow('Poids :', coulee.bobine_poids ? `${new Intl.NumberFormat('fr-FR').format(coulee.bobine_poids)} kg` : '—', yPos, false);
      infoRow('Norme :', coulee.bobine_norme || 'API 5L', yPos, true);
    } else {
      doc.fillColor(gray).fontSize(9).font('Helvetica-Oblique')
         .text('Aucune bobine associée', 48, yPos);
    }
    yPos += 20;

    // SECTION 3 — CHRONOLOGIE & RETARDS
    checkNewPage(130);
    yPos = sectionTitle('CHRONOLOGIE & RETARDS', yPos);

    infoRow('Étape 1 — Création :', formatDateTime(coulee.created_at), yPos, false);
    yPos += 18;

    doc.strokeColor(border).lineWidth(0.5)
       .moveTo(48, yPos - 4).lineTo(48 + pageWidth - 16, yPos - 4).stroke();

    if (coulee.bobine_recue) {
      infoRow('Étape 2 — Réception :', formatDateTime(coulee.date_reception), yPos, false);
      const retardRec = coulee.retard_reception_minutes || 0;
      const retardRecColor = retardRec >= 10 ? red : retardRec >= 5 ? orange : green;
      infoRowColored('Délai réception :', formatDuree(retardRec), yPos, true, retardRecColor);
      yPos += 16;
      if (retardRec >= 10 && coulee.motif_reception_libelle) {
        infoRow('Motif retard :', coulee.motif_reception_libelle, yPos, false);
        if (coulee.motif_reception_categorie) infoRow('Catégorie :', coulee.motif_reception_categorie, yPos, true);
        yPos += 16;
      }
      if (coulee.commentaire_reception) {
        doc.fillColor(gray).fontSize(9).font('Helvetica').text('Commentaire :', 48, yPos);
        doc.fillColor('#111827').fontSize(8).font('Helvetica')
           .text(coulee.commentaire_reception, 178, yPos, { width: pageWidth - 150 });
        yPos += 16;
      }
    } else {
      infoRowColored('Étape 2 — Réception :', 'Non effectuée', yPos, false, gray);
      yPos += 16;
    }

    doc.strokeColor(border).lineWidth(0.5)
       .moveTo(48, yPos - 4).lineTo(48 + pageWidth - 16, yPos - 4).stroke();

    if (coulee.bobine_installee) {
      infoRow('Étape 3 — Installation :', formatDateTime(coulee.date_installation), yPos, false);
      const retardInst = coulee.retard_installation_minutes || 0;
      const retardInstColor = retardInst >= 10 ? red : retardInst >= 5 ? orange : green;
      infoRowColored('Délai installation :', formatDuree(retardInst), yPos, true, retardInstColor);
      yPos += 16;
      if (retardInst >= 10 && coulee.motif_installation_libelle) {
        infoRow('Motif retard :', coulee.motif_installation_libelle, yPos, false);
        if (coulee.motif_installation_categorie) infoRow('Catégorie :', coulee.motif_installation_categorie, yPos, true);
        yPos += 16;
      }
      if (coulee.commentaire_installation) {
        doc.fillColor(gray).fontSize(9).font('Helvetica').text('Commentaire :', 48, yPos);
        doc.fillColor('#111827').fontSize(8).font('Helvetica')
           .text(coulee.commentaire_installation, 178, yPos, { width: pageWidth - 150 });
        yPos += 16;
      }
    } else {
      infoRowColored('Étape 3 — Installation :', 'Non effectuée', yPos, false, gray);
      yPos += 16;
    }

    doc.strokeColor(border).lineWidth(0.5)
       .moveTo(48, yPos - 4).lineTo(48 + pageWidth - 16, yPos - 4).stroke();

    if (coulee.checklist_validee) {
      infoRowColored('Étape 4 — Checklist :', `Validée le ${formatDateTime(coulee.date_checklist)}`, yPos, false, green);
      if (coulee.source_coulee_numero) infoRow('Source checklist :', `Coulée ${coulee.source_coulee_numero}`, yPos, true);
    } else {
      infoRowColored('Étape 4 — Checklist :', 'Non validée', yPos, false, gray);
    }
    yPos += 20;

    // SECTION 4 — BILAN DES RETARDS
    const retardRec = coulee.retard_reception_minutes || 0;
    const retardInst = coulee.retard_installation_minutes || 0;
    const retardTotal = retardRec + retardInst;

    if (retardTotal > 0) {
      checkNewPage(70);
      yPos = sectionTitle('BILAN DES RETARDS', yPos);

      const tableX = 48;
      const tableW = pageWidth - 16;
      const colW = tableW / 3;

      doc.rect(tableX, yPos, tableW, 18).fill('#fef3c7');
      doc.fillColor(primary).fontSize(8).font('Helvetica-Bold');
      doc.text('TYPE', tableX + 8, yPos + 5, { width: colW - 16 });
      doc.text('DURÉE', tableX + colW + 8, yPos + 5, { width: colW - 16 });
      doc.text('MOTIF', tableX + colW * 2 + 8, yPos + 5, { width: colW - 16 });
      yPos += 18;

      doc.rect(tableX, yPos, tableW, 18).fillAndStroke('#ffffff', border);
      doc.fillColor('#111827').fontSize(8).font('Helvetica');
      doc.text('Réception', tableX + 8, yPos + 5, { width: colW - 16 });
      const recColor = retardRec >= 10 ? red : retardRec >= 5 ? orange : green;
      doc.fillColor(recColor).font('Helvetica-Bold')
         .text(formatDuree(retardRec), tableX + colW + 8, yPos + 5, { width: colW - 16 });
      doc.fillColor('#111827').font('Helvetica')
         .text(coulee.motif_reception_libelle || '—', tableX + colW * 2 + 8, yPos + 5, { width: colW - 16 });
      yPos += 18;

      doc.rect(tableX, yPos, tableW, 18).fillAndStroke('#ffffff', border);
      doc.fillColor('#111827').fontSize(8).font('Helvetica');
      doc.text('Installation', tableX + 8, yPos + 5, { width: colW - 16 });
      const instColor = retardInst >= 10 ? red : retardInst >= 5 ? orange : green;
      doc.fillColor(instColor).font('Helvetica-Bold')
         .text(formatDuree(retardInst), tableX + colW + 8, yPos + 5, { width: colW - 16 });
      doc.fillColor('#111827').font('Helvetica')
         .text(coulee.motif_installation_libelle || '—', tableX + colW * 2 + 8, yPos + 5, { width: colW - 16 });
      yPos += 18;

      doc.rect(tableX, yPos, tableW, 20).fill('#fef3c7');
      doc.fillColor(primary).fontSize(9).font('Helvetica-Bold');
      doc.text('TOTAL', tableX + 8, yPos + 6, { width: colW - 16 });
      const totalColor = retardTotal >= 10 ? red : retardTotal >= 5 ? orange : green;
      doc.fillColor(totalColor).fontSize(10).font('Helvetica-Bold')
         .text(formatDuree(retardTotal), tableX + colW + 8, yPos + 5, { width: colW - 16 });
      yPos += 26;
    }

    // SECTION 5 — TUBES PRODUITS
    if (tubes.length > 0) {
      checkNewPage(60 + tubes.length * 16);
      yPos = sectionTitle(`TUBES PRODUITS (${tubes.length})`, yPos);

      const tableX = 48;
      const tableW = pageWidth - 16;
      const cols = [tableW * 0.25, tableW * 0.2, tableW * 0.2, tableW * 0.15, tableW * 0.2];
      const headers = ['N° Tube', 'Diamètre', 'Longueur', 'Statut', 'Date'];

      doc.rect(tableX, yPos, tableW, 18).fill('#f3f4f6');
      let colX = tableX;
      doc.fillColor(primary).fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, colX + 5, yPos + 5, { width: cols[i] - 10 });
        colX += cols[i];
      });
      yPos += 18;

      tubes.forEach((tube, idx) => {
        checkNewPage(18);
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#fafafa';
        doc.rect(tableX, yPos, tableW, 16).fillAndStroke(bgColor, border);
        let cx = tableX;
        doc.fillColor('#111827').fontSize(8).font('Helvetica');
        doc.text(tube.numero || '—', cx + 5, yPos + 4, { width: cols[0] - 10 }); cx += cols[0];
        const diamStr = tube.diametre_pouce ? `${tube.diametre_mm} mm (${tube.diametre_pouce}")` : `${tube.diametre_mm} mm`;
        doc.text(diamStr, cx + 5, yPos + 4, { width: cols[1] - 10 }); cx += cols[1];
        doc.text(tube.longueur ? `${tube.longueur} m` : '—', cx + 5, yPos + 4, { width: cols[2] - 10 }); cx += cols[2];
        const tubeStatut = tube.statut === 'termine' ? 'Terminé' : tube.statut === 'en_cours' ? 'En cours' : tube.statut;
        doc.text(tubeStatut || '—', cx + 5, yPos + 4, { width: cols[3] - 10 }); cx += cols[3];
        doc.text(formatDateTime(tube.created_at), cx + 5, yPos + 4, { width: cols[4] - 10 });
        yPos += 16;
      });
      yPos += 10;
    }

    // SECTION 6 — PARAMÈTRES DE PRODUCTION
    if (coulee.parametre_numero) {
      checkNewPage(90);
      yPos = sectionTitle(`PARAMÈTRES DE PRODUCTION — ${coulee.parametre_numero}`, yPos);

      infoRow('Strip vitesse :', `${coulee.strip_vitesse_m || 0} m ${coulee.strip_vitesse_cm || 0} cm/min`, yPos, false);
      infoRow('Milling Edge G :', `${coulee.milling_edge_gauche || 0} mm`, yPos, true);
      yPos += 16;
      infoRow('Pression rouleaux :', coulee.pression_rouleaux ? `${coulee.pression_rouleaux} ${coulee.pression_rouleaux_unite || 'tonnes'}` : '—', yPos, false);
      infoRow('Milling Edge D :', `${coulee.milling_edge_droit || 0} mm`, yPos, true);
      yPos += 16;
      infoRow('Tack — Ampérage :', `${coulee.tack_amperage || 0} A`, yPos, false);
      infoRow('Tack — Voltage :', `${coulee.tack_voltage || 0} V`, yPos, true);
      yPos += 16;
      infoRow('Tack — Vitesse :', `${coulee.tack_vitesse_m || 0} m ${coulee.tack_vitesse_cm || 0} cm/min`, yPos, false);
      infoRow('Tack — Fréquence :', coulee.tack_frequence ? `${coulee.tack_frequence} Hz` : '—', yPos, true);
      yPos += 16;
      infoRow('Tack — Gaz :', `${coulee.tack_type_gaz || 'CO2'} (${coulee.tack_debit_gaz || '—'} L/min)`, yPos, false);
      yPos += 16;
      infoRow('Soudure vitesse :', `${coulee.soudure_vitesse_m || 0} m ${coulee.soudure_vitesse_cm || 0} cm/min`, yPos, false);
      infoRow('Type fil :', coulee.soudure_type_fil || '—', yPos, true);
      yPos += 16;
      infoRow('Type flux :', coulee.soudure_type_flux || '—', yPos, false);
      yPos += 20;
    }

    drawFooter();
    doc.end();

  } catch (error) {
    console.error('Erreur GET /coulees/:id/pdf:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

// ============================================
// GET /api/coulees/:id - Détail d'une coulée
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, 
             b.numero as bobine_numero,
             b.epaisseur as bobine_epaisseur,
             b.largeur as bobine_largeur,
             b.poids as bobine_poids,
             b.fournisseur as bobine_fournisseur,
             mr_rec.libelle as motif_reception_libelle,
             mr_rec.categorie as motif_reception_categorie,
             mr_inst.libelle as motif_installation_libelle,
             mr_inst.categorie as motif_installation_categorie,
             pp.numero as parametre_numero,
             src.numero as source_coulee_numero
      FROM coulees c
      LEFT JOIN bobines b ON c.bobine_id = b.id
      LEFT JOIN motifs_retard mr_rec ON c.motif_retard_reception_id = mr_rec.id
      LEFT JOIN motifs_retard mr_inst ON c.motif_retard_installation_id = mr_inst.id
      LEFT JOIN parametres_production pp ON c.parametre_id = pp.id
      LEFT JOIN coulees src ON c.checklist_source_coulee_id = src.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Coulée non trouvée' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Erreur GET /coulees/:id:', error);
    res.status(500).json({ error: 'Erreur récupération coulée' });
  }
});

// ============================================
// POST /api/coulees - Créer une coulée (Début de poste)
// ============================================
router.post('/', async (req, res) => {
  try {
    const { numero, bobine_id, parametre_id } = req.body;

    // Une bobine disponible est obligatoire
    if (!bobine_id) {
      return res.status(400).json({ error: 'Une bobine est obligatoire pour créer une coulée' });
    }

    // Vérifier que la bobine existe et est en stock
    const [bobineCheck] = await pool.query('SELECT id, statut FROM bobines WHERE id = ?', [bobine_id]);
    if (bobineCheck.length === 0) {
      return res.status(404).json({ error: 'Bobine introuvable' });
    }
    if (bobineCheck[0].statut !== 'en_stock') {
      return res.status(400).json({ error: 'Cette bobine n\'est plus disponible (statut: ' + bobineCheck[0].statut + ')' });
    }
    
    const operateur_nom = req.user?.nom || null;
    const operateur_prenom = req.user?.prenom || null;
    const created_by = req.user?.operateurId || req.user?.userId || null;

    // Générer numéro auto si vide
    let numeroFinal = numero;
    if (!numeroFinal) {
      const [last] = await pool.query('SELECT numero FROM coulees ORDER BY id DESC LIMIT 1');
      if (last.length === 0) {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        numeroFinal = `${today}-001`;
      } else {
        const parts = last[0].numero.split('-');
        const num = parts.length === 2 ? parseInt(parts[1]) + 1 : 1;
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        numeroFinal = `${today}-${String(num).padStart(3, '0')}`;
      }
    }

    const [result] = await pool.query(`
      INSERT INTO coulees (numero, bobine_id, parametre_id, created_by, operateur_nom, operateur_prenom)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [numeroFinal, bobine_id || null, parametre_id || null, created_by, operateur_nom, operateur_prenom]);

    // Mettre à jour la bobine si sélectionnée → passe en production
    if (bobine_id) {
      await pool.query('UPDATE bobines SET coulee_id = ?, statut = ? WHERE id = ?', 
        [result.insertId, 'en_cours', bobine_id]);
    }

    const [newCoulee] = await pool.query(`
      SELECT c.*, b.numero as bobine_numero
      FROM coulees c
      LEFT JOIN bobines b ON c.bobine_id = b.id
      WHERE c.id = ?
    `, [result.insertId]);

    res.status(201).json(newCoulee[0]);
  } catch (error) {
    console.error('Erreur POST /coulees:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ce numéro de coulée existe déjà' });
    }
    res.status(500).json({ error: 'Erreur création coulée' });
  }
});

// ============================================
// PUT /api/coulees/:id/selectionner-bobine - Sélectionner une bobine
// ============================================
router.put('/:id/selectionner-bobine', async (req, res) => {
  try {
    const { id } = req.params;
    const { bobine_id } = req.body;

    // Libérer l'ancienne bobine si existe → redevient disponible
    const [current] = await pool.query('SELECT bobine_id FROM coulees WHERE id = ?', [id]);
    if (current.length > 0 && current[0].bobine_id) {
      await pool.query('UPDATE bobines SET coulee_id = NULL, statut = ? WHERE id = ?', 
        ['en_stock', current[0].bobine_id]);
    }

    // Assigner la nouvelle bobine → passe en production
    await pool.query('UPDATE coulees SET bobine_id = ? WHERE id = ?', [bobine_id, id]);
    await pool.query('UPDATE bobines SET coulee_id = ?, statut = ? WHERE id = ?', 
      [id, 'en_cours', bobine_id]);

    res.json({ message: 'Bobine sélectionnée' });
  } catch (error) {
    console.error('Erreur sélection bobine:', error);
    res.status(500).json({ error: 'Erreur sélection bobine' });
  }
});

// ============================================
// PUT /api/coulees/:id/reception - Marquer bobine reçue
// ============================================
router.put('/:id/reception', async (req, res) => {
  try {
    const { id } = req.params;
    const { recue, retard_minutes, motif_retard_id, commentaire } = req.body;

    await pool.query(`
      UPDATE coulees SET
        bobine_recue = ?,
        date_reception = NOW(),
        retard_reception_minutes = ?,
        motif_retard_reception_id = ?,
        commentaire_reception = ?
      WHERE id = ?
    `, [recue ? 1 : 0, retard_minutes || 0, motif_retard_id || null, commentaire || null, id]);

    res.json({ message: 'Réception enregistrée' });
  } catch (error) {
    console.error('Erreur réception:', error);
    res.status(500).json({ error: 'Erreur enregistrement réception' });
  }
});

// ============================================
// PUT /api/coulees/:id/installation - Marquer bobine installée
// ============================================
router.put('/:id/installation', async (req, res) => {
  try {
    const { id } = req.params;
    const { installee, retard_minutes, motif_retard_id, commentaire } = req.body;

    const newStatut = 'en_cours';

    await pool.query(`
      UPDATE coulees SET
        bobine_installee = ?,
        date_installation = NOW(),
        retard_installation_minutes = ?,
        motif_retard_installation_id = ?,
        commentaire_installation = ?,
        statut = ?
      WHERE id = ?
    `, [installee ? 1 : 0, retard_minutes || 0, motif_retard_id || null, commentaire || null, newStatut, id]);

    res.json({ message: 'Installation enregistrée', statut: newStatut });
  } catch (error) {
    console.error('Erreur installation:', error);
    res.status(500).json({ error: 'Erreur enregistrement installation' });
  }
});

// ============================================
// PUT /api/coulees/:id/checklist - Valider checklist
// ============================================
router.put('/:id/checklist', async (req, res) => {
  try {
    const { id } = req.params;
    const { validee } = req.body;

    await pool.query(`
      UPDATE coulees SET
        checklist_validee = ?,
        date_checklist = NOW(),
        statut = ?
      WHERE id = ?
    `, [validee ? 1 : 0, validee ? 'pret_production' : 'en_cours', id]);

    res.json({ message: 'Checklist enregistrée' });
  } catch (error) {
    console.error('Erreur checklist:', error);
    res.status(500).json({ error: 'Erreur checklist' });
  }
});

// ============================================
// PUT /api/coulees/:id/reinitialiser - Réinitialiser toutes les étapes
// ============================================
router.put('/:id/reinitialiser', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE coulees SET
        bobine_recue = 0,
        date_reception = NULL,
        retard_reception_minutes = 0,
        motif_retard_reception_id = NULL,
        commentaire_reception = NULL,
        bobine_installee = 0,
        date_installation = NULL,
        retard_installation_minutes = 0,
        motif_retard_installation_id = NULL,
        commentaire_installation = NULL,
        checklist_validee = 0,
        date_checklist = NULL,
        statut = 'en_cours'
      WHERE id = ? AND statut NOT IN ('en_production', 'termine')
    `, [id]);

    res.json({ message: 'Étapes réinitialisées' });
  } catch (error) {
    console.error('Erreur réinitialisation:', error);
    res.status(500).json({ error: 'Erreur réinitialisation' });
  }
});

// ============================================
// PUT /api/coulees/:id/annuler-reception - Annuler réception
// ============================================
router.put('/:id/annuler-reception', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE coulees SET
        bobine_recue = 0,
        date_reception = NULL,
        retard_reception_minutes = 0,
        motif_retard_reception_id = NULL,
        commentaire_reception = NULL,
        statut = 'en_cours'
      WHERE id = ? AND bobine_installee = 0
    `, [id]);

    res.json({ message: 'Réception annulée' });
  } catch (error) {
    console.error('Erreur annulation réception:', error);
    res.status(500).json({ error: 'Erreur annulation réception' });
  }
});

// ============================================
// PUT /api/coulees/:id/annuler-installation - Annuler installation
// ============================================
router.put('/:id/annuler-installation', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE coulees SET
        bobine_installee = 0,
        date_installation = NULL,
        retard_installation_minutes = 0,
        motif_retard_installation_id = NULL,
        commentaire_installation = NULL,
        statut = 'en_cours'
      WHERE id = ? AND checklist_validee = 0
    `, [id]);

    res.json({ message: 'Installation annulée' });
  } catch (error) {
    console.error('Erreur annulation installation:', error);
    res.status(500).json({ error: 'Erreur annulation installation' });
  }
});

// ============================================
// PUT /api/coulees/:id/demarrer-production - Démarrer production
// ============================================
router.put('/:id/demarrer-production', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE coulees SET statut = 'en_production', date_production = NOW() WHERE id = ?
    `, [id]);

    res.json({ message: 'Production démarrée' });
  } catch (error) {
    console.error('Erreur démarrage:', error);
    res.status(500).json({ error: 'Erreur démarrage production' });
  }
});

// ============================================
// PUT /api/coulees/:id/terminer - Terminer la coulée
// ============================================
router.put('/:id/terminer', async (req, res) => {
  try {
    const { id } = req.params;

    // Libérer la bobine
    const [coulee] = await pool.query('SELECT bobine_id FROM coulees WHERE id = ?', [id]);
    if (coulee.length > 0 && coulee[0].bobine_id) {
      await pool.query('UPDATE bobines SET statut = ? WHERE id = ?', 
        ['epuisee', coulee[0].bobine_id]);
    }

    await pool.query(`
      UPDATE coulees SET statut = 'termine', date_fin = NOW() WHERE id = ?
    `, [id]);

    res.json({ message: 'Coulée terminée' });
  } catch (error) {
    console.error('Erreur terminer:', error);
    res.status(500).json({ error: 'Erreur terminer coulée' });
  }
});

// ============================================
// PUT /api/coulees/:id/parametres - Changer ou créer un preset pour une coulée
// ============================================
router.put('/:id/parametres', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { action, parametre_id, parametres } = req.body;
    // action = 'select' (choisir un existant) ou 'create' (créer un nouveau depuis modif)

    let finalParametreId;
    if (action === 'select' && parametre_id) {
      // Simplement associer un preset existant
      finalParametreId = parametre_id;
    } else if (action === 'create' && parametres) {
      // Créer un nouveau preset à partir des paramètres modifiés
      const [last] = await conn.query(`SELECT numero FROM parametres_production ORDER BY id DESC LIMIT 1`);
      let nextNum = 'PAR-001';
      if (last.length > 0) {
        const n = parseInt(last[0].numero.replace('PAR-', ''), 10);
        nextNum = `PAR-${String(n + 1).padStart(3, '0')}`;
      }

      const p = parametres;
      const created_by = req.user?.operateurId || req.user?.userId || null;

      const [result] = await conn.query(`
        INSERT INTO parametres_production (
          numero, strip_vitesse_m, strip_vitesse_cm,
          milling_edge_gauche, milling_edge_droit,
          pression_rouleaux, pression_rouleaux_unite,
          tack_amperage, tack_voltage, tack_vitesse_m, tack_vitesse_cm,
          tack_frequence, tack_type_gaz, tack_debit_gaz,
          soudure_vitesse_m, soudure_vitesse_cm,
          soudure_type_fil, soudure_type_flux,
          notes, created_by, createur_nom, createur_prenom
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        nextNum,
        p.strip_vitesse_m || 0, p.strip_vitesse_cm || 0,
        p.milling_edge_gauche || 0, p.milling_edge_droit || 0,
        p.pression_rouleaux || null, p.pression_rouleaux_unite || 'tonnes',
        p.tack_amperage || 0, p.tack_voltage || 0,
        p.tack_vitesse_m || 0, p.tack_vitesse_cm || 0,
        p.tack_frequence || null, p.tack_type_gaz || 'CO2', p.tack_debit_gaz || null,
        p.soudure_vitesse_m || 0, p.soudure_vitesse_cm || 0,
        p.soudure_type_fil || '1.6mm', p.soudure_type_flux || 'SAW',
        p.notes || `Modifi\u00e9 depuis coul\u00e9e #${id}`,
        created_by, req.user?.nom || null, req.user?.prenom || null
      ]);

      finalParametreId = result.insertId;

      // Ins\u00e9rer les heads
      if (p.heads && Array.isArray(p.heads)) {
        for (const head of p.heads) {
          await conn.query(`
            INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage, type_fil)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [finalParametreId, head.type, head.numero, head.actif ? 1 : 0, head.actif ? (head.amperage || 0) : 0, head.actif ? (head.voltage || 0) : 0, head.type_fil || '3.2mm']);
        }
      }
    } else {
      return res.status(400).json({ error: 'Action invalide' });
    }

    // Mettre \u00e0 jour la coul\u00e9e
    await conn.query('UPDATE coulees SET parametre_id = ? WHERE id = ?', [finalParametreId, id]);

    await conn.commit();

    // Retourner la coul\u00e9e mise \u00e0 jour
    const [updated] = await pool.query(`
      SELECT c.*, pp.numero as parametre_numero
      FROM coulees c
      LEFT JOIN parametres_production pp ON c.parametre_id = pp.id
      WHERE c.id = ?
    `, [id]);

    res.json({ message: 'Param\u00e8tres mis \u00e0 jour', coulee: updated[0], nouveau_preset_id: finalParametreId });
  } catch (error) {
    await conn.rollback();
    console.error('Erreur PUT /coulees/:id/parametres:', error);
    res.status(500).json({ error: 'Erreur mise \u00e0 jour param\u00e8tres' });
  } finally {
    conn.release();
  }
});

// ============================================
// DELETE /api/coulees/:id - Supprimer
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Libérer la bobine
    await pool.query('UPDATE bobines SET coulee_id = NULL, statut = ? WHERE coulee_id = ?', 
      ['en_stock', id]);

    const [result] = await pool.query('DELETE FROM coulees WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Coulée non trouvée' });
    }

    res.json({ message: 'Coulée supprimée' });
  } catch (error) {
    console.error('Erreur DELETE:', error);
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;
