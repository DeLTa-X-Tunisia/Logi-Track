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
      UPDATE coulees SET statut = 'en_production' WHERE id = ?
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
            INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [finalParametreId, head.type, head.numero, head.actif ? 1 : 0, head.actif ? (head.amperage || 0) : 0, head.actif ? (head.voltage || 0) : 0]);
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
