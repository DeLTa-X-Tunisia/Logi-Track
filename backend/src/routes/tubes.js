/**
 * Routes API pour les tubes - LogiTrack
 * Système de suivi de production avec 12 étapes
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');
const { uploadTubeEtapePhotos, tubesUploadsDir } = require('../config/upload');
const { logAudit } = require('../utils/audit');

// ============================================
// Définition des 12 étapes de production
// ============================================
const ETAPES_PRODUCTION = [
  { numero: 1,  code: 'FORMAGE',      nom: 'Formage',                       icon: 'Cylinder',  color: 'blue',   offline: false },
  { numero: 2,  code: 'POINTAGE',     nom: 'Pointage (GMAW)',               icon: 'Flame',     color: 'orange', offline: false },
  { numero: 3,  code: 'CV_POINTAGE',  nom: 'Contrôle visuel pointage',      icon: 'Eye',       color: 'purple', offline: false },
  { numero: 4,  code: 'SAW_ID_OD',    nom: 'SAW ID/OD',                     icon: 'Flame',     color: 'amber',  offline: true  },
  { numero: 5,  code: 'CV_CORDON',    nom: 'Contrôle visuel cordon',        icon: 'Eye',       color: 'purple', offline: false },
  { numero: 6,  code: 'COUPE',        nom: 'Coupe',                         icon: 'Scissors',  color: 'green',  offline: false },
  { numero: 7,  code: 'CND',          nom: 'CND (Xray/UT)',                 icon: 'Scan',      color: 'red',    offline: false },
  { numero: 8,  code: 'CV_APRES_CND', nom: 'Contrôle visuel après CND',     icon: 'Eye',       color: 'purple', offline: false },
  { numero: 9,  code: 'HYDROTEST',    nom: 'Hydrotest',                     icon: 'Droplet',   color: 'cyan',   offline: false },
  { numero: 10, code: 'CV_FUITE',     nom: 'Contrôle visuel fuite/déform.', icon: 'Eye',       color: 'purple', offline: false },
  { numero: 11, code: 'CHANFREIN',    nom: 'Chanfrein',                     icon: 'Scissors',  color: 'green',  offline: false },
  { numero: 12, code: 'CV_CHANFREIN', nom: 'Contrôle visuel chanfrein',     icon: 'Eye',       color: 'purple', offline: false },
];

// Table de conversion diamètre pouces - mm
const DIAMETRES = [
  { pouce: '8"',  mm: 219.1  }, { pouce: '10"', mm: 273.1  }, { pouce: '12"', mm: 323.9  },
  { pouce: '14"', mm: 355.6  }, { pouce: '16"', mm: 406.4  }, { pouce: '18"', mm: 457.2  },
  { pouce: '20"', mm: 508.0  }, { pouce: '22"', mm: 558.8  }, { pouce: '24"', mm: 609.6  },
  { pouce: '26"', mm: 660.4  }, { pouce: '28"', mm: 711.2  }, { pouce: '30"', mm: 762.0  },
  { pouce: '32"', mm: 812.8  }, { pouce: '34"', mm: 863.6  }, { pouce: '36"', mm: 914.4  },
  { pouce: '38"', mm: 965.2  }, { pouce: '40"', mm: 1016.0 }, { pouce: '42"', mm: 1066.8 },
  { pouce: '44"', mm: 1117.6 }, { pouce: '46"', mm: 1168.4 }, { pouce: '48"', mm: 1219.2 },
  { pouce: '52"', mm: 1320.8 }, { pouce: '56"', mm: 1422.4 }, { pouce: '60"', mm: 1524.0 },
  { pouce: '64"', mm: 1625.6 }, { pouce: '68"', mm: 1727.2 }, { pouce: '72"', mm: 1828.8 },
  { pouce: '76"', mm: 1930.4 }, { pouce: '80"', mm: 2032.0 }, { pouce: '82"', mm: 2082.8 },
];

// ============================================
// GET /api/tubes/etapes - Définition des étapes
// ============================================
router.get('/etapes', (req, res) => {
  res.json(ETAPES_PRODUCTION);
});

// ============================================
// GET /api/tubes/diametres - Table de conversion
// ============================================
router.get('/diametres', (req, res) => {
  res.json(DIAMETRES);
});

// ============================================
// GET /api/tubes/stats - Statistiques globales
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'en_production' THEN 1 ELSE 0 END) as en_production,
        SUM(CASE WHEN statut = 'termine' THEN 1 ELSE 0 END) as termines,
        SUM(CASE WHEN statut = 'en_attente' THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN statut = 'rebut' THEN 1 ELSE 0 END) as rebuts,
        SUM(CASE WHEN statut = 'termine' AND decision = 'en_attente' THEN 1 ELSE 0 END) as decision_en_attente,
        SUM(CASE WHEN decision = 'certifie_api' THEN 1 ELSE 0 END) as certifie_api,
        SUM(CASE WHEN decision = 'certifie_hydraulique' THEN 1 ELSE 0 END) as certifie_hydraulique,
        SUM(CASE WHEN decision = 'declasse' THEN 1 ELSE 0 END) as declasse
      FROM tubes
    `);
    
    const [nc] = await pool.query(`
      SELECT COUNT(DISTINCT tube_id) as non_conformes
      FROM tube_etapes WHERE statut = 'non_conforme'
    `);

    res.json({ ...stats[0], non_conformes: nc[0].non_conformes });
  } catch (error) {
    console.error('Erreur GET /tubes/stats:', error);
    res.status(500).json({ error: 'Erreur stats tubes' });
  }
});

// ============================================
// GET /api/tubes/prochain-numero - Prochain numéro
// ============================================
router.get('/prochain-numero', async (req, res) => {
  try {
    // Toujours utiliser le MAX global pour garantir la continuité de la séquence
    const [last] = await pool.query('SELECT MAX(CAST(numero AS UNSIGNED)) as max_num FROM tubes');
    res.json({ numero: (last[0].max_num || 0) + 1 });
  } catch (error) {
    console.error('Erreur prochain-numero:', error);
    res.status(500).json({ error: 'Erreur prochain numéro' });
  }
});

// ============================================
// GET /api/tubes - Liste tous les tubes
// ============================================
router.get('/', async (req, res) => {
  try {
    const { statut, etape, coulee_id, search, decision } = req.query;
    let query = `
      SELECT t.*, c.numero as coulee_numero, c2.numero as coulee_numero_2,
             b.numero as bobine_numero, b.epaisseur as bobine_epaisseur,
             pp.numero as parametre_numero
      FROM tubes t
      LEFT JOIN coulees c ON t.coulee_id = c.id
      LEFT JOIN coulees c2 ON t.coulee_id_2 = c2.id
      LEFT JOIN bobines b ON c.bobine_id = b.id
      LEFT JOIN parametres_production pp ON t.parametre_id = pp.id
      WHERE 1=1
    `;
    const params = [];
    
    if (statut) { query += ' AND t.statut = ?'; params.push(statut); }
    if (etape) { query += ' AND t.etape_courante = ?'; params.push(parseInt(etape)); }
    if (coulee_id) { query += ' AND t.coulee_id = ?'; params.push(parseInt(coulee_id)); }
    if (decision) { query += ' AND t.decision = ?'; params.push(decision); }
    if (search) { query += ' AND (t.numero LIKE ? OR c.numero LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = (page - 1) * limit;

    // Count total for pagination metadata
    const countQuery = query.replace(/SELECT t\.\*.*FROM tubes t/s, 'SELECT COUNT(*) as total FROM tubes t');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const [tubes] = await pool.query(query, params);

    // Batch load etapes for all tubes (fix N+1)
    if (tubes.length > 0) {
      const tubeIds = tubes.map(t => t.id);
      const [allEtapes] = await pool.query(
        'SELECT * FROM tube_etapes WHERE tube_id IN (?) ORDER BY etape_numero',
        [tubeIds]
      );
      const etapesByTube = {};
      for (const e of allEtapes) {
        if (!etapesByTube[e.tube_id]) etapesByTube[e.tube_id] = [];
        etapesByTube[e.tube_id].push(e);
      }
      for (const tube of tubes) {
        tube.etapes = etapesByTube[tube.id] || [];
      }
    }

    res.json({
      data: tubes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Erreur GET /tubes:', error);
    res.status(500).json({ error: 'Erreur récupération tubes' });
  }
});

// ============================================
// GET /api/tubes/:id - Détail d'un tube
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const [tubes] = await pool.query(`
      SELECT t.*, c.numero as coulee_numero, c2.numero as coulee_numero_2,
             c.parametre_id as coulee_parametre_id,
             b.numero as bobine_numero, b.epaisseur as bobine_epaisseur,
             b.poids as bobine_poids, b.largeur as bobine_largeur,
             pp.numero as parametre_numero
      FROM tubes t
      LEFT JOIN coulees c ON t.coulee_id = c.id
      LEFT JOIN coulees c2 ON t.coulee_id_2 = c2.id
      LEFT JOIN bobines b ON c.bobine_id = b.id
      LEFT JOIN parametres_production pp ON t.parametre_id = pp.id
      WHERE t.id = ?
    `, [req.params.id]);
    
    if (tubes.length === 0) return res.status(404).json({ error: 'Tube non trouvé' });

    const tube = tubes[0];
    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [tube.id]
    );
    tube.etapes = etapes;
    res.json(tube);
  } catch (error) {
    console.error('Erreur GET /tubes/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/tubes - Créer un tube
// ============================================
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let { coulee_id, type_tube, parametre_id, parametres, numero, diametre_mm, diametre_pouce, longueur, epaisseur, notes } = req.body;

    if (!numero || !diametre_mm) {
      conn.release();
      return res.status(400).json({ error: 'numero et diametre_mm sont requis' });
    }

    // Valider type_tube
    if (type_tube && !['normal', 'cross_welding'].includes(type_tube)) {
      conn.release();
      return res.status(400).json({ error: 'type_tube doit être "normal" ou "cross_welding"' });
    }

    // Pour cross welding, on a besoin de la coulée courante ET de la prochaine
    let coulee_id_2 = null;

    if (type_tube === 'cross_welding') {
      // Récupérer les deux coulées en production (courante + suivante)
      const [activesCoulees] = await conn.query(
        `SELECT id, numero, statut, bobine_id FROM coulees WHERE statut = 'en_production' ORDER BY created_at ASC`
      );

      if (activesCoulees.length < 2) {
        conn.release();
        return res.status(400).json({ 
          error: 'Cross Welding impossible : la prochaine coulée doit être engagée (en production) avant de créer un tube CW.' 
        });
      }

      // La première est la coulée courante, la deuxième est la prochaine
      coulee_id = activesCoulees[0].id;
      coulee_id_2 = activesCoulees[1].id;
    } else {
      // Tube normal : vérifier que la coulée fournie est encore active, sinon auto-détecter
      if (coulee_id) {
        const [checkCoulee] = await conn.query(
          `SELECT id FROM coulees WHERE id = ? AND statut IN ('en_production','pret_production')`, [coulee_id]
        );
        if (checkCoulee.length === 0) {
          // La coulée fournie n'est plus active, auto-détecter
          coulee_id = null;
        }
      }
      if (!coulee_id) {
        const [lastCoulee] = await conn.query(
          `SELECT id FROM coulees WHERE statut IN ('en_production','pret_production') ORDER BY created_at DESC LIMIT 1`
        );
        if (lastCoulee.length === 0) { conn.release(); return res.status(400).json({ error: 'Aucune coulée active trouvée' }); }
        coulee_id = lastCoulee[0].id;
      }
    }

    const [coulee] = await conn.query('SELECT id, parametre_id FROM coulees WHERE id = ?', [coulee_id]);
    if (coulee.length === 0) { conn.release(); return res.status(404).json({ error: 'Coulée non trouvée' }); }

    // Gérer les paramètres de production
    let finalParametreId = parametre_id || coulee[0].parametre_id || null;
    
    // Si des paramètres modifiés sont envoyés, créer un nouveau preset
    if (parametres && typeof parametres === 'object') {
      const [last] = await conn.query(`SELECT numero FROM parametres_production ORDER BY id DESC LIMIT 1`);
      let nextNum = 'PAR-001';
      if (last.length > 0) {
        const n = parseInt(last[0].numero.replace('PAR-', ''), 10);
        nextNum = `PAR-${String(n + 1).padStart(3, '0')}`;
      }
      const p = parametres;
      const created_by = req.user?.operateurId || req.user?.userId || null;

      const [paramResult] = await conn.query(`
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
        p.notes || `Modifié pour tube N°${numero}`,
        created_by, req.user?.nom || null, req.user?.prenom || null
      ]);
      finalParametreId = paramResult.insertId;

      // Insérer les heads
      if (p.heads && Array.isArray(p.heads)) {
        for (const head of p.heads) {
          await conn.query(`
            INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage, type_fil)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [finalParametreId, head.type, head.numero, head.actif ? 1 : 0, head.actif ? (head.amperage || 0) : 0, head.actif ? (head.voltage || 0) : 0, head.type_fil || '3.2mm']);
        }
      }
    }

    const operateur_id = req.user?.operateurId || req.user?.userId || null;
    const operateur_nom = req.user?.nom || null;
    const operateur_prenom = req.user?.prenom || null;

    const [result] = await conn.query(`
      INSERT INTO tubes (coulee_id, coulee_id_2, type_tube, parametre_id, numero, diametre_mm, diametre_pouce, longueur, epaisseur, 
                         operateur_id, operateur_nom, operateur_prenom, notes, etape_courante, statut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'en_production')
    `, [coulee_id, coulee_id_2, type_tube || 'normal', finalParametreId, numero, diametre_mm, diametre_pouce || null, longueur || null, 
        epaisseur || null, operateur_id, operateur_nom, operateur_prenom, notes || null]);

    const tubeId = result.insertId;

    // Cross Welding : fermer automatiquement la coulée précédente (coulée 1)
    if (type_tube === 'cross_welding' && coulee_id) {
      // Libérer la bobine de la coulée précédente
      const [prevCoulee] = await conn.query('SELECT bobine_id FROM coulees WHERE id = ?', [coulee_id]);
      if (prevCoulee.length > 0 && prevCoulee[0].bobine_id) {
        await conn.query('UPDATE bobines SET statut = ? WHERE id = ?', ['epuisee', prevCoulee[0].bobine_id]);
      }
      await conn.query(`UPDATE coulees SET statut = 'termine', date_fin = NOW() WHERE id = ?`, [coulee_id]);
    }

    // Pré-générer les 12 étapes (étape 1 en 'en_cours')
    const etapeValues = ETAPES_PRODUCTION.map(e => [
      tubeId, e.numero, e.code,
      e.numero === 1 ? 'en_cours' : 'en_attente',
      e.numero === 1 ? new Date() : null,
      e.offline ? 1 : 0
    ]);

    await conn.query(
      `INSERT INTO tube_etapes (tube_id, etape_numero, etape_code, statut, started_at, offline) VALUES ?`,
      [etapeValues]
    );

    await conn.commit();

    const [newTube] = await pool.query(`
      SELECT t.*, c.numero as coulee_numero, c2.numero as coulee_numero_2, pp.numero as parametre_numero FROM tubes t
      LEFT JOIN coulees c ON t.coulee_id = c.id
      LEFT JOIN coulees c2 ON t.coulee_id_2 = c2.id
      LEFT JOIN parametres_production pp ON t.parametre_id = pp.id
      WHERE t.id = ?
    `, [tubeId]);

    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [tubeId]
    );
    newTube[0].etapes = etapes;

    // Audit trail
    logAudit({ action: 'CREATE', entite: 'tube', entiteId: tubeId, req, details: { numero: newTube[0].numero, diametre_mm, coulee_id } });

    res.status(201).json(newTube[0]);
  } catch (error) {
    await conn.rollback();
    console.error('Erreur POST /tubes:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Ce numéro de tube existe déjà' });
    res.status(500).json({ error: 'Erreur création tube' });
  } finally {
    conn.release();
  }
});

// ============================================
// PUT /api/tubes/:id/valider-etape - Valider une étape
// ============================================
router.put('/:id/valider-etape', async (req, res) => {
  try {
    const { id } = req.params;
    const { etape_numero, commentaire } = req.body;
    const operateur_id = req.user?.operateurId || req.user?.userId || null;
    const operateur_nom = req.user?.nom || null;
    const operateur_prenom = req.user?.prenom || null;

    const [tube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    if (tube.length === 0) return res.status(404).json({ error: 'Tube non trouvé' });
    if (tube[0].statut === 'en_attente') {
      return res.status(400).json({ error: 'Tube bloqué (non-conformité). Résolvez-la d\'abord.' });
    }

    // Valider l'étape
    await pool.query(`
      UPDATE tube_etapes SET statut = 'valide', 
        operateur_id = ?, operateur_nom = ?, operateur_prenom = ?,
        commentaire = ?, completed_at = NOW()
      WHERE tube_id = ? AND etape_numero = ?
    `, [operateur_id, operateur_nom, operateur_prenom, commentaire || null, id, etape_numero]);

    // Passer à l'étape suivante
    const nextEtape = etape_numero + 1;
    if (nextEtape <= 12) {
      await pool.query(`
        UPDATE tube_etapes SET statut = 'en_cours', started_at = NOW()
        WHERE tube_id = ? AND etape_numero = ? AND statut = 'en_attente'
      `, [id, nextEtape]);
      await pool.query('UPDATE tubes SET etape_courante = ? WHERE id = ?', [nextEtape, id]);
    } else {
      const [remaining] = await pool.query(
        "SELECT COUNT(*) as cnt FROM tube_etapes WHERE tube_id = ? AND statut NOT IN ('valide','saute')", [id]
      );
      if (remaining[0].cnt === 0) {
        await pool.query("UPDATE tubes SET statut = 'termine', etape_courante = 12, date_fin_production = NOW() WHERE id = ?", [id]);
      }
    }

    const [updatedTube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [id]
    );
    updatedTube[0].etapes = etapes;

    // Audit trail - validation d'étape
    logAudit({ action: 'VALIDATE', entite: 'tube', entiteId: id, req, details: { numero: updatedTube[0].numero, etape_numero, commentaire } });

    res.json(updatedTube[0]);
  } catch (error) {
    console.error('Erreur valider-etape:', error);
    res.status(500).json({ error: 'Erreur validation étape' });
  }
});

// ============================================
// PUT /api/tubes/:id/non-conforme - Marquer non conforme (bloque le tube)
// ============================================
router.put('/:id/non-conforme', async (req, res) => {
  try {
    const { id } = req.params;
    const { etape_numero, commentaire } = req.body;
    const operateur_id = req.user?.operateurId || req.user?.userId || null;
    const operateur_nom = req.user?.nom || null;
    const operateur_prenom = req.user?.prenom || null;

    await pool.query(`
      UPDATE tube_etapes SET statut = 'non_conforme',
        operateur_id = ?, operateur_nom = ?, operateur_prenom = ?,
        commentaire = ?, completed_at = NOW()
      WHERE tube_id = ? AND etape_numero = ?
    `, [operateur_id, operateur_nom, operateur_prenom, commentaire || 'Non conformité détectée', id, etape_numero]);

    await pool.query("UPDATE tubes SET statut = 'en_attente' WHERE id = ?", [id]);

    const [updatedTube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [id]
    );
    updatedTube[0].etapes = etapes;
    res.json(updatedTube[0]);
  } catch (error) {
    console.error('Erreur non-conforme:', error);
    res.status(500).json({ error: 'Erreur marquage non-conforme' });
  }
});

// ============================================
// PUT /api/tubes/:id/resoudre-nc - Résoudre NC (reprise/rebut/dérogation)
// ============================================
router.put('/:id/resoudre-nc', async (req, res) => {
  try {
    const { id } = req.params;
    const { etape_numero, action, commentaire } = req.body;

    if (action === 'rebut') {
      await pool.query("UPDATE tubes SET statut = 'rebut' WHERE id = ?", [id]);
      await pool.query(`
        UPDATE tube_etapes SET commentaire = CONCAT(IFNULL(commentaire,''), ' | REBUT: ', ?)
        WHERE tube_id = ? AND etape_numero = ?
      `, [commentaire || 'Décision rebut', id, etape_numero]);

    } else if (action === 'reprise') {
      await pool.query(`
        UPDATE tube_etapes SET statut = 'en_cours', completed_at = NULL,
          commentaire = CONCAT(IFNULL(commentaire,''), ' | REPRISE: ', ?)
        WHERE tube_id = ? AND etape_numero = ?
      `, [commentaire || 'Reprise après NC', id, etape_numero]);
      await pool.query("UPDATE tubes SET statut = 'en_production', etape_courante = ? WHERE id = ?", [etape_numero, id]);

    } else if (action === 'derogation') {
      await pool.query(`
        UPDATE tube_etapes SET statut = 'valide',
          commentaire = CONCAT(IFNULL(commentaire,''), ' | DÉROGATION: ', ?)
        WHERE tube_id = ? AND etape_numero = ?
      `, [commentaire || 'Dérogation accordée', id, etape_numero]);

      const nextEtape = etape_numero + 1;
      if (nextEtape <= 12) {
        await pool.query(`
          UPDATE tube_etapes SET statut = 'en_cours', started_at = NOW()
          WHERE tube_id = ? AND etape_numero = ? AND statut = 'en_attente'
        `, [id, nextEtape]);
        await pool.query("UPDATE tubes SET statut = 'en_production', etape_courante = ? WHERE id = ?", [nextEtape, id]);
      } else {
        await pool.query("UPDATE tubes SET statut = 'termine', etape_courante = 12, date_fin_production = NOW() WHERE id = ?", [id]);
      }
    }

    const [updatedTube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [id]
    );
    updatedTube[0].etapes = etapes;
    res.json(updatedTube[0]);
  } catch (error) {
    console.error('Erreur résoudre NC:', error);
    res.status(500).json({ error: 'Erreur résolution non-conformité' });
  }
});

// ============================================
// PUT /api/tubes/:id/sauter-etape - Passer (ignorer) une étape
// ============================================
router.put('/:id/sauter-etape', async (req, res) => {
  try {
    const { id } = req.params;
    const { etape_numero, motif } = req.body;
    const operateur_id = req.user?.operateurId || req.user?.userId || null;
    const operateur_nom = req.user?.nom || 'Système';
    const operateur_prenom = req.user?.prenom || '';

    const [etape] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? AND etape_numero = ?', [id, etape_numero]
    );
    if (etape.length === 0) return res.status(404).json({ error: 'Étape non trouvée' });
    if (etape[0].statut !== 'en_cours') return res.status(400).json({ error: 'Seules les étapes en cours peuvent être passées' });

    const commentairePassage = motif ? `PASSÉE: ${motif}` : 'PASSÉE (sans motif)';

    await pool.query(`
      UPDATE tube_etapes SET statut = 'saute', completed_at = NOW(),
        operateur_id = ?, operateur_nom = ?, operateur_prenom = ?,
        commentaire = ?
      WHERE tube_id = ? AND etape_numero = ?
    `, [operateur_id, operateur_nom, operateur_prenom, commentairePassage, id, etape_numero]);

    const nextEtape = etape_numero + 1;
    if (nextEtape <= 12) {
      await pool.query(`
        UPDATE tube_etapes SET statut = 'en_cours', started_at = NOW()
        WHERE tube_id = ? AND etape_numero = ? AND statut = 'en_attente'
      `, [id, nextEtape]);
      await pool.query('UPDATE tubes SET etape_courante = ? WHERE id = ?', [nextEtape, id]);
    }

    const [updatedTube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [id]
    );
    updatedTube[0].etapes = etapes;
    res.json(updatedTube[0]);
  } catch (error) {
    console.error('Erreur sauter-etape:', error);
    res.status(500).json({ error: 'Erreur saut étape' });
  }
});

// ============================================
// PUT /api/tubes/:id/valider-offline - Valider étape sautée (retour SAW)
// ============================================
router.put('/:id/valider-offline', async (req, res) => {
  try {
    const { id } = req.params;
    const { etape_numero, commentaire } = req.body;
    const operateur_id = req.user?.operateurId || req.user?.userId || null;
    const operateur_nom = req.user?.nom || null;
    const operateur_prenom = req.user?.prenom || null;

    await pool.query(`
      UPDATE tube_etapes SET statut = 'valide',
        operateur_id = ?, operateur_nom = ?, operateur_prenom = ?,
        commentaire = ?, completed_at = NOW()
      WHERE tube_id = ? AND etape_numero = ? AND statut = 'saute'
    `, [operateur_id, operateur_nom, operateur_prenom, commentaire || null, id, etape_numero]);

    const [remaining] = await pool.query(
      "SELECT COUNT(*) as cnt FROM tube_etapes WHERE tube_id = ? AND statut NOT IN ('valide','saute')", [id]
    );
    if (remaining[0].cnt === 0) {
      await pool.query("UPDATE tubes SET statut = 'termine', date_fin_production = NOW() WHERE id = ?", [id]);
    }

    const [updatedTube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [id]
    );
    updatedTube[0].etapes = etapes;
    res.json(updatedTube[0]);
  } catch (error) {
    console.error('Erreur valider-offline:', error);
    res.status(500).json({ error: 'Erreur validation offline' });
  }
});

// ============================================
// PUT /api/tubes/:id/debut-decision - Marquer début de décision
// ============================================
router.put('/:id/debut-decision', async (req, res) => {
  try {
    const { id } = req.params;
    const [tube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    if (tube.length === 0) return res.status(404).json({ error: 'Tube non trouvé' });
    if (tube[0].statut !== 'termine') return res.status(400).json({ error: 'Le tube doit être terminé pour ouvrir la décision' });

    // Ne marquer que si pas déjà marqué
    if (!tube[0].date_debut_decision) {
      await pool.query('UPDATE tubes SET date_debut_decision = NOW() WHERE id = ?', [id]);
    }

    const [updatedTube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    res.json(updatedTube[0]);
  } catch (error) {
    console.error('Erreur debut-decision:', error);
    res.status(500).json({ error: 'Erreur début décision' });
  }
});

// ============================================
// PUT /api/tubes/:id/decision - Enregistrer la décision finale
// ============================================
router.put('/:id/decision', async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, commentaire } = req.body;
    const decision_par = req.user ? `${req.user.prenom || ''} ${req.user.nom || ''}`.trim() : 'Système';

    const validDecisions = ['certifie_api', 'certifie_hydraulique', 'declasse'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: 'Décision invalide. Valeurs acceptées: certifie_api, certifie_hydraulique, declasse' });
    }

    const [tube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    if (tube.length === 0) return res.status(404).json({ error: 'Tube non trouvé' });
    if (tube[0].statut !== 'termine') return res.status(400).json({ error: 'Le tube doit être terminé pour prendre une décision' });

    await pool.query(`
      UPDATE tubes SET 
        decision = ?, decision_date = NOW(), decision_par = ?,
        decision_commentaire = ?, date_fin_decision = NOW()
      WHERE id = ?
    `, [decision, decision_par, commentaire || null, id]);

    const [updatedTube] = await pool.query('SELECT * FROM tubes WHERE id = ?', [id]);
    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [id]
    );
    updatedTube[0].etapes = etapes;

    // === Notification temps réel ===
    const decisionLabels = {
      certifie_api: 'Certifié API 5L',
      certifie_hydraulique: 'Certifié Hydraulique',
      declasse: 'Déclassé'
    };
    const decisionLabel = decisionLabels[decision] || decision;
    const notifTitre = `Décision Finale — Tube N°${updatedTube[0].numero}`;
    const notifMessage = `Le tube N°${updatedTube[0].numero} a été déclaré "${decisionLabel}" par ${decision_par}.`;

    // Sauvegarder en DB
    try {
      await pool.query(`
        INSERT INTO notifications (type, titre, message, tube_id, tube_numero, decision, created_by)
        VALUES ('decision', ?, ?, ?, ?, ?, ?)
      `, [notifTitre, notifMessage, id, updatedTube[0].numero, decision, decision_par]);
    } catch (notifErr) {
      console.error('Erreur sauvegarde notification:', notifErr);
    }

    // Émettre via Socket.io à tous les clients connectés
    const io = req.app.get('io');
    if (io) {
      io.emit('notification', {
        type: 'decision',
        titre: notifTitre,
        message: notifMessage,
        tube_id: parseInt(id),
        tube_numero: updatedTube[0].numero,
        decision,
        created_by: decision_par,
        created_at: new Date().toISOString()
      });
      console.log(`🔔 Notification émise: ${notifTitre}`);
    }

    // Audit trail - décision finale
    logAudit({ action: 'DECISION', entite: 'tube', entiteId: id, req, details: { numero: updatedTube[0].numero, decision, commentaire, decision_par } });

    res.json(updatedTube[0]);
  } catch (error) {
    console.error('Erreur decision:', error);
    res.status(500).json({ error: 'Erreur enregistrement décision' });
  }
});

// ============================================
// ROUTES PHOTOS D'ÉTAPES
// ============================================

// GET /api/tubes/:id/etape/:etape/photos - Photos d'une étape
router.get('/:id/etape/:etape/photos', async (req, res) => {
  try {
    const [photos] = await pool.query(`
      SELECT tep.*, o.nom as uploader_nom, o.prenom as uploader_prenom
      FROM tube_etape_photos tep
      LEFT JOIN operateurs o ON tep.uploaded_by = o.id
      WHERE tep.tube_id = ? AND tep.etape_numero = ?
      ORDER BY tep.created_at ASC
    `, [req.params.id, req.params.etape]);
    res.json(photos);
  } catch (error) {
    console.error('Erreur GET photos étape:', error);
    res.status(500).json({ error: 'Erreur récupération photos' });
  }
});

// GET /api/tubes/:id/photos - Toutes les photos d'un tube (toutes étapes)
router.get('/:id/photos', async (req, res) => {
  try {
    const [photos] = await pool.query(`
      SELECT tep.*, o.nom as uploader_nom, o.prenom as uploader_prenom
      FROM tube_etape_photos tep
      LEFT JOIN operateurs o ON tep.uploaded_by = o.id
      WHERE tep.tube_id = ?
      ORDER BY tep.etape_numero ASC, tep.created_at ASC
    `, [req.params.id]);
    res.json(photos);
  } catch (error) {
    console.error('Erreur GET all photos tube:', error);
    res.status(500).json({ error: 'Erreur récupération photos' });
  }
});

// POST /api/tubes/:id/etape/:etape/photos - Upload photos pour une étape
router.post('/:id/etape/:etape/photos', uploadTubeEtapePhotos.array('photos', 5), async (req, res) => {
  try {
    const tubeId = req.params.id;
    const etapeNumero = parseInt(req.params.etape);
    const uploaded_by = req.user?.operateurId || req.user?.userId || null;
    const description = req.body.description || null;

    // Vérifier que le tube existe
    const [tube] = await pool.query('SELECT id FROM tubes WHERE id = ?', [tubeId]);
    if (tube.length === 0) {
      if (req.files) req.files.forEach(f => fs.unlinkSync(f.path));
      return res.status(404).json({ error: 'Tube non trouvé' });
    }

    // Vérifier le nombre de photos pour cette étape (max 10)
    const [existing] = await pool.query(
      'SELECT COUNT(*) as count FROM tube_etape_photos WHERE tube_id = ? AND etape_numero = ?',
      [tubeId, etapeNumero]
    );
    const newCount = req.files ? req.files.length : 0;
    if (existing[0].count + newCount > 10) {
      if (req.files) req.files.forEach(f => fs.unlinkSync(f.path));
      return res.status(400).json({ 
        error: `Maximum 10 photos par étape. Actuellement: ${existing[0].count}` 
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const insertedPhotos = [];
    for (const file of req.files) {
      const [result] = await pool.query(
        `INSERT INTO tube_etape_photos 
         (tube_id, etape_numero, filename, original_name, mimetype, size, path, description, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tubeId, etapeNumero, file.filename, file.originalname, file.mimetype, file.size,
         `/uploads/tubes/${file.filename}`, description, uploaded_by]
      );
      insertedPhotos.push({
        id: result.insertId,
        filename: file.filename,
        original_name: file.originalname,
        path: `/uploads/tubes/${file.filename}`,
        etape_numero: etapeNumero
      });
    }

    res.json({ message: `${insertedPhotos.length} photo(s) ajoutée(s)`, photos: insertedPhotos });
  } catch (error) {
    console.error('Erreur POST photos étape:', error);
    res.status(500).json({ error: 'Erreur upload photos' });
  }
});

// DELETE /api/tubes/:id/photos/:photoId - Supprimer une photo
router.delete('/:id/photos/:photoId', async (req, res) => {
  try {
    const [photo] = await pool.query(
      'SELECT * FROM tube_etape_photos WHERE id = ? AND tube_id = ?',
      [req.params.photoId, req.params.id]
    );
    if (photo.length === 0) return res.status(404).json({ error: 'Photo non trouvée' });

    // Supprimer le fichier
    const filePath = path.join(tubesUploadsDir, photo[0].filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Supprimer de la base
    await pool.query('DELETE FROM tube_etape_photos WHERE id = ?', [req.params.photoId]);
    res.json({ message: 'Photo supprimée' });
  } catch (error) {
    console.error('Erreur DELETE photo:', error);
    res.status(500).json({ error: 'Erreur suppression photo' });
  }
});

// ============================================
// GET /api/tubes/:id/pdf - Rapport PDF du tube avec photos
// ============================================
router.get('/:id/pdf', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');

    // Récupérer le tube
    const [tubes] = await pool.query(`
      SELECT t.*, c.numero as coulee_numero, c2.numero as coulee_numero_2,
             b.numero as bobine_numero, b.epaisseur as bobine_epaisseur,
             b.largeur as bobine_largeur, b.poids as bobine_poids,
             pp.numero as parametre_numero
      FROM tubes t
      LEFT JOIN coulees c ON t.coulee_id = c.id
      LEFT JOIN coulees c2 ON t.coulee_id_2 = c2.id
      LEFT JOIN bobines b ON c.bobine_id = b.id
      LEFT JOIN parametres_production pp ON t.parametre_id = pp.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (tubes.length === 0) return res.status(404).json({ error: 'Tube non trouvé' });
    const tube = tubes[0];

    // Récupérer les étapes
    const [etapes] = await pool.query(
      'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [tube.id]
    );

    // Récupérer les photos
    const [photos] = await pool.query(
      'SELECT * FROM tube_etape_photos WHERE tube_id = ? ORDER BY etape_numero, created_at', [tube.id]
    );

    // Grouper photos par étape
    const photosByEtape = {};
    for (const p of photos) {
      if (!photosByEtape[p.etape_numero]) photosByEtape[p.etape_numero] = [];
      photosByEtape[p.etape_numero].push(p);
    }

    // Récupérer les paramètres du projet
    const [projetRows] = await pool.query('SELECT * FROM projet_parametres LIMIT 1');
    const projet = projetRows.length > 0 ? projetRows[0] : {};

    // Récupérer les paramètres de soudage
    let parametres = null;
    let soudureHeads = [];
    if (tube.parametre_id) {
      const [paramRows] = await pool.query('SELECT * FROM parametres_production WHERE id = ?', [tube.parametre_id]);
      if (paramRows.length > 0) parametres = paramRows[0];
      const [headsRows] = await pool.query('SELECT * FROM parametres_soudure_heads WHERE parametre_id = ? ORDER BY type, numero', [tube.parametre_id]);
      soudureHeads = headsRows;
    }

    // Créer le PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Rapport Tube N°${tube.numero}`,
        Author: 'LogiTrack',
        Subject: 'Rapport de production tube spirale'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=tube_${tube.numero}.pdf`);
    doc.pipe(res);

    const primary = '#1e40af';
    const accent = '#2563eb';
    const gray = '#6b7280';
    const lightGray = '#f3f4f6';
    const border = '#e5e7eb';
    const green = '#16a34a';
    const red = '#dc2626';
    const amber = '#d97706';
    const pageWidth = doc.page.width - 80;

    const footerText = `LogiTrack — Rapport Tube N°${tube.numero} — ${new Date().toLocaleDateString('fr-FR')}`;
    const drawFooter = () => {
      const savedY = doc.y;
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 35;
      doc.save();
      doc.strokeColor(border).lineWidth(0.5)
         .moveTo(40, footerY - 5).lineTo(40 + pageWidth, footerY - 5).stroke();
      doc.fillColor(gray).fontSize(7).font('Helvetica')
         .text(footerText, 40, footerY, { align: 'center', width: pageWidth });
      doc.restore();
      doc.page.margins.bottom = 40;
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
    let logosEndX = headerLeft + 10;

    // Logo entreprise
    if (projet.logo_path) {
      try {
        const logoPath = path.join(__dirname, '..', '..', projet.logo_path);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, logosEndX, logoY, { fit: [logoMaxW, logoMaxH] });
          logosEndX += logoMaxW + 8;
        }
      } catch (e) { /* skip */ }
    }

    // Séparateur vertical entre logos
    if (projet.logo_path && projet.client_logo_path) {
      doc.strokeColor('#d1d5db').lineWidth(0.5)
         .moveTo(logosEndX, logoY + 3).lineTo(logosEndX, logoY + logoMaxH - 3).stroke();
      logosEndX += 8;
    }

    // Logo client
    if (projet.client_logo_path) {
      try {
        const clientLogoPath = path.join(__dirname, '..', '..', projet.client_logo_path);
        if (fs.existsSync(clientLogoPath)) {
          doc.image(clientLogoPath, logosEndX, logoY, { fit: [logoMaxW, logoMaxH] });
          logosEndX += logoMaxW + 8;
        }
      } catch (e) { /* skip */ }
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
         .text(projet.client_nom, textStartX, textY, { width: textMaxW, lineBreak: false });
      textY += 15;
    }
    if (projet.projet_nom) {
      doc.fillColor(gray).fontSize(7.5).font('Helvetica')
         .text(projet.projet_nom, textStartX, textY, { width: textMaxW, lineBreak: false });
      textY += 10;
    }
    if (projet.client_adresse || projet.projet_adresse) {
      doc.fillColor(gray).fontSize(7).font('Helvetica')
         .text([projet.client_adresse, projet.projet_adresse].filter(Boolean).join(' — '), textStartX, textY, { width: textMaxW, lineBreak: false });
      textY += 10;
    }
    if (projet.projet_code) {
      doc.fillColor(accent).fontSize(9).font('Helvetica-Bold')
         .text(projet.projet_code, textStartX, textY, { lineBreak: false });
    }

    // =========================================
    // TITRE DU RAPPORT
    // =========================================
    let yPos = headerTop + headerHeight + 14;

    doc.fillColor(primary).fontSize(16).font('Helvetica-Bold')
       .text(`Rapport Tube N°${tube.numero}`, 40, yPos, { align: 'center', width: pageWidth });
    yPos += 20;

    doc.fillColor(gray).fontSize(8).font('Helvetica')
       .text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 40, yPos, { align: 'center', width: pageWidth });
    yPos += 16;

    // Ligne de séparation
    doc.strokeColor(accent).lineWidth(1).moveTo(40, yPos).lineTo(40 + pageWidth, yPos).stroke();
    yPos += 8;

    doc.y = yPos;

    // =========================================
    // INFORMATIONS GÉNÉRALES
    // =========================================
    doc.fillColor(primary).fontSize(11).font('Helvetica-Bold')
       .text('INFORMATIONS GÉNÉRALES', 40, doc.y);
    doc.y += 5;
    doc.strokeColor(accent).lineWidth(1).moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
    doc.y += 10;

    const colW = pageWidth / 3;
    const infoRows = [
      [
        { label: 'Numéro', value: tube.numero },
        { label: 'Diamètre', value: `${tube.diametre_mm} mm ${tube.diametre_pouce ? `(${tube.diametre_pouce})` : ''}` },
        { label: 'Type', value: tube.type_tube === 'cross_welding' ? 'Cross Welding' : 'Normal' },
      ],
      [
        { label: 'Coulée', value: tube.coulee_numero || '-' },
        { label: 'Épaisseur', value: tube.epaisseur ? `${tube.epaisseur} mm` : (tube.bobine_epaisseur ? `${tube.bobine_epaisseur} mm` : '-') },
        { label: 'Longueur', value: tube.longueur ? `${tube.longueur} m` : '-' },
      ],
      [
        { label: 'Bobine', value: tube.bobine_numero || '-' },
        { label: 'Statut', value: tube.statut === 'termine' ? 'Terminé' : tube.statut === 'en_production' ? 'En production' : tube.statut },
        { label: 'Paramètres', value: tube.parametre_numero || '-' },
      ],
    ];

    for (const row of infoRows) {
      const y = doc.y;
      row.forEach((item, i) => {
        doc.fillColor(gray).fontSize(7).font('Helvetica').text(item.label, 45 + i * colW, y);
        doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text(item.value || '-', 45 + i * colW, y + 10);
      });
      doc.y = y + 28;
    }

    // Décision finale
    if (tube.decision && tube.decision !== 'en_attente') {
      doc.y += 8;
      const decisionLabels = {
        certifie_api: 'CERTIFIÉ API 5L',
        certifie_hydraulique: 'CERTIFIÉ HYDRAULIQUE',
        declasse: 'DÉCLASSÉ'
      };

      const isAPI = tube.decision === 'certifie_api';
      const isHydraulique = tube.decision === 'certifie_hydraulique';
      const isDeclasse = tube.decision === 'declasse';

      // Theme colors per decision type
      let dTheme;
      if (isAPI) {
        dTheme = {
          bgDark: '#0c1a3e',
          bgLight: '#162050',
          accent: '#d4a853',
          accentLight: '#e8c97a',
          text: '#ffffff',
          subText: '#c5cde8',
          badge: '🏆',
          subtitle: 'Spécification API 5L — PSL2 — Conforme',
        };
      } else if (isHydraulique) {
        dTheme = {
          bgDark: '#0a2342',
          bgLight: '#0f3460',
          accent: '#4fc3f7',
          accentLight: '#81d4fa',
          text: '#ffffff',
          subText: '#b0c4de',
          badge: '🔧',
          subtitle: 'Épreuve hydrostatique réussie — Conforme',
        };
      } else {
        dTheme = {
          bgDark: '#7c2d12',
          bgLight: '#9a3412',
          accent: '#fb923c',
          accentLight: '#fdba74',
          text: '#ffffff',
          subText: '#fed7aa',
          badge: '⚠️',
          subtitle: 'Non conforme aux critères de certification',
        };
      }

      const dBoxX = 40;
      const dBoxW = pageWidth;
      const dBoxH = isDeclasse ? 48 : 70;
      const dBoxY = doc.y;

      // Gradient-like background
      const dGrad = doc.linearGradient(dBoxX, dBoxY, dBoxX + dBoxW, dBoxY);
      dGrad.stop(0, dTheme.bgDark);
      dGrad.stop(1, dTheme.bgLight);
      doc.roundedRect(dBoxX, dBoxY, dBoxW, dBoxH, 6).fill(dGrad);

      // Accent left bar
      doc.roundedRect(dBoxX, dBoxY, 5, dBoxH, 3).fill(dTheme.accent);

      // Top accent line
      doc.moveTo(dBoxX + 15, dBoxY).lineTo(dBoxX + dBoxW - 15, dBoxY).lineWidth(1.5).stroke(dTheme.accent);

      // Corner ornaments
      const ornS = 12;
      // Top-left
      doc.moveTo(dBoxX + 6, dBoxY + 6).lineTo(dBoxX + 6 + ornS, dBoxY + 6).lineWidth(1.5).stroke(dTheme.accent);
      doc.moveTo(dBoxX + 6, dBoxY + 6).lineTo(dBoxX + 6, dBoxY + 6 + ornS).lineWidth(1.5).stroke(dTheme.accent);
      // Top-right
      doc.moveTo(dBoxX + dBoxW - 6, dBoxY + 6).lineTo(dBoxX + dBoxW - 6 - ornS, dBoxY + 6).lineWidth(1.5).stroke(dTheme.accent);
      doc.moveTo(dBoxX + dBoxW - 6, dBoxY + 6).lineTo(dBoxX + dBoxW - 6, dBoxY + 6 + ornS).lineWidth(1.5).stroke(dTheme.accent);
      // Bottom-left
      doc.moveTo(dBoxX + 6, dBoxY + dBoxH - 6).lineTo(dBoxX + 6 + ornS, dBoxY + dBoxH - 6).lineWidth(1.5).stroke(dTheme.accent);
      doc.moveTo(dBoxX + 6, dBoxY + dBoxH - 6).lineTo(dBoxX + 6, dBoxY + dBoxH - 6 - ornS).lineWidth(1.5).stroke(dTheme.accent);
      // Bottom-right
      doc.moveTo(dBoxX + dBoxW - 6, dBoxY + dBoxH - 6).lineTo(dBoxX + dBoxW - 6 - ornS, dBoxY + dBoxH - 6).lineWidth(1.5).stroke(dTheme.accent);
      doc.moveTo(dBoxX + dBoxW - 6, dBoxY + dBoxH - 6).lineTo(dBoxX + dBoxW - 6, dBoxY + dBoxH - 6 - ornS).lineWidth(1.5).stroke(dTheme.accent);

      // Seal circle on the left
      const sealCX = dBoxX + 40;
      const sealCY = dBoxY + dBoxH / 2;
      const sealCR = isDeclasse ? 14 : 18;
      doc.circle(sealCX, sealCY, sealCR).lineWidth(1.5).stroke(dTheme.accent);
      doc.circle(sealCX, sealCY, sealCR - 3).lineWidth(0.6).stroke(dTheme.accent);
      // Dots around seal
      for (let a = 0; a < 360; a += 30) {
        const rad = (a * Math.PI) / 180;
        const dx = sealCX + (sealCR - 1) * Math.cos(rad);
        const dy = sealCY + (sealCR - 1) * Math.sin(rad);
        doc.circle(dx, dy, 0.7).fill(dTheme.accent);
      }

      // Checkmark or icon in seal
      if (isDeclasse) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(dTheme.accent);
        doc.text('!', sealCX - 4, sealCY - 6, { lineBreak: false });
      } else {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(dTheme.accent);
        doc.text('✓', sealCX - 5, sealCY - 5, { lineBreak: false });
      }

      // Decision title
      const dTextX = dBoxX + 68;
      const dTitleY = isDeclasse ? dBoxY + 10 : dBoxY + 12;
      doc.font('Helvetica-Bold').fontSize(14).fillColor(dTheme.accent);
      doc.text(`Décision : ${decisionLabels[tube.decision] || tube.decision}`, dTextX, dTitleY, { lineBreak: false });

      // Subtitle / norm reference
      if (!isDeclasse) {
        doc.font('Helvetica').fontSize(8.5).fillColor(dTheme.subText);
        doc.text(dTheme.subtitle, dTextX, dTitleY + 19, { lineBreak: false });
      }

      // Decision info line
      const dInfoY = isDeclasse ? dBoxY + 30 : dBoxY + 42;
      doc.font('Helvetica').fontSize(7.5).fillColor(dTheme.subText);
      const dateStr = tube.decision_date ? new Date(tube.decision_date).toLocaleString('fr-FR') : '-';
      doc.text(`Par ${tube.decision_par || '-'} le ${dateStr}`, dTextX, dInfoY, { lineBreak: false });

      // Certificate number badge on right (only for certified tubes)
      if (!isDeclasse) {
        const certNum = `CERT-${isAPI ? 'API' : 'HYD'}-${String(tube.numero).padStart(4, '0')}`;
        const badgeW = 110;
        const badgeH = 20;
        const badgeX = dBoxX + dBoxW - badgeW - 15;
        const badgeY = dBoxY + dBoxH / 2 - badgeH / 2;
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3).lineWidth(0.8).fillAndStroke(dTheme.bgDark, dTheme.accent);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(dTheme.accent);
        doc.text(certNum, badgeX, badgeY + 5.5, { width: badgeW, align: 'center', lineBreak: false });
      }

      // Bottom accent line
      doc.moveTo(dBoxX + 15, dBoxY + dBoxH).lineTo(dBoxX + dBoxW - 15, dBoxY + dBoxH).lineWidth(1.5).stroke(dTheme.accent);

      doc.y = dBoxY + dBoxH + 12;
    }

    // =========================================
    // PARAMÈTRES DE SOUDAGE
    // =========================================
    if (parametres) {
      if (doc.y + 160 > doc.page.height - 50) {
        drawFooter();
        doc.addPage();
      }

      doc.y += 5;
      doc.fillColor(primary).fontSize(11).font('Helvetica-Bold')
         .text('PARAMÈTRES DE SOUDAGE', 40, doc.y);
      doc.y += 5;
      doc.strokeColor(accent).lineWidth(1).moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
      doc.y += 10;

      // Reference
      const refY = doc.y;
      doc.rect(40, refY, pageWidth, 18).fill('#eff6ff');
      doc.rect(40, refY, pageWidth, 18).stroke(border);
      doc.fillColor(primary).fontSize(8).font('Helvetica-Bold')
         .text(`Référence : ${parametres.numero}`, 48, refY + 5, { lineBreak: false });
      doc.fillColor(gray).fontSize(7).font('Helvetica')
         .text(`Diamètre : ${parametres.diametre_pouce}"`, 250, refY + 5, { lineBreak: false });
      if (parametres.createur_prenom && parametres.createur_nom) {
        doc.fillColor(gray).fontSize(7).font('Helvetica')
           .text(`Créé par : ${parametres.createur_prenom} ${parametres.createur_nom}`, 380, refY + 5, { lineBreak: false });
      }
      doc.y = refY + 22;

      // Paramètres en 2 colonnes - ligne/formage et pointage
      const pColW = (pageWidth - 10) / 2;
      const pRowH = 14;

      // COLONNE GAUCHE: Strip & Formage
      const leftX = 40;
      const rightX = 40 + pColW + 10;
      const paramStartY = doc.y;

      // Section Strip/Formage
      const sectY1 = paramStartY;
      doc.rect(leftX, sectY1, pColW, pRowH).fill(primary);
      doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold')
         .text('STRIP / FORMAGE', leftX + 6, sectY1 + 4, { lineBreak: false });
      let py = sectY1 + pRowH;

      const stripParams = [
        { label: 'Vitesse Strip', value: `${parametres.strip_vitesse_m || 0} m ${parametres.strip_vitesse_cm || 0} cm/min` },
        { label: 'Milling Edge G', value: `${parametres.milling_edge_gauche || 0} mm` },
        { label: 'Milling Edge D', value: `${parametres.milling_edge_droit || 0} mm` },
        { label: 'Pression Rouleaux', value: parametres.pression_rouleaux ? `${parametres.pression_rouleaux} ${parametres.pression_rouleaux_unite || 'tonnes'}` : '-' },
      ];

      stripParams.forEach((p, idx) => {
        const bg = idx % 2 === 0 ? '#f8fafc' : 'white';
        doc.rect(leftX, py, pColW, pRowH).fill(bg);
        doc.rect(leftX, py, pColW, pRowH).stroke(border);
        doc.fillColor(gray).fontSize(6).font('Helvetica')
           .text(p.label, leftX + 6, py + 4, { lineBreak: false });
        doc.fillColor('#111827').fontSize(6.5).font('Helvetica-Bold')
           .text(p.value, leftX + pColW / 2, py + 4, { width: pColW / 2 - 6, lineBreak: false });
        py += pRowH;
      });

      // COLONNE DROITE: Tack Weld (Pointage)
      const sectY2 = paramStartY;
      doc.rect(rightX, sectY2, pColW, pRowH).fill(primary);
      doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold')
         .text('POINTAGE (TACK WELD)', rightX + 6, sectY2 + 4, { lineBreak: false });
      py = sectY2 + pRowH;

      const tackParams = [
        { label: 'Ampérage', value: `${parametres.tack_amperage || 0} A` },
        { label: 'Voltage', value: `${parametres.tack_voltage || 0} V` },
        { label: 'Vitesse', value: `${parametres.tack_vitesse_m || 0} m ${parametres.tack_vitesse_cm || 0} cm/min` },
        { label: 'Type Gaz / Débit', value: `${(parametres.tack_type_gaz || 'CO2').replace('_', '+')} ${parametres.tack_debit_gaz ? `/ ${parametres.tack_debit_gaz} L/min` : ''}` },
      ];

      tackParams.forEach((p, idx) => {
        const bg = idx % 2 === 0 ? '#f8fafc' : 'white';
        doc.rect(rightX, py, pColW, pRowH).fill(bg);
        doc.rect(rightX, py, pColW, pRowH).stroke(border);
        doc.fillColor(gray).fontSize(6).font('Helvetica')
           .text(p.label, rightX + 6, py + 4, { lineBreak: false });
        doc.fillColor('#111827').fontSize(6.5).font('Helvetica-Bold')
           .text(p.value, rightX + pColW / 2, py + 4, { width: pColW / 2 - 6, lineBreak: false });
        py += pRowH;
      });

      doc.y = paramStartY + pRowH + (4 * pRowH) + 8;

      // Soudure SAW - paramètres généraux
      const sawY = doc.y;
      const sawColW = pageWidth / 3;
      doc.rect(40, sawY, pageWidth, pRowH).fill(primary);
      doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold')
         .text('SOUDURE SAW', 46, sawY + 4, { lineBreak: false });
      doc.y = sawY + pRowH;

      const sawRow = doc.y;
      const sawParams = [
        { label: 'Vitesse Soudure', value: `${parametres.soudure_vitesse_m || 0} m ${parametres.soudure_vitesse_cm || 0} cm/min` },
        { label: 'Type Flux', value: parametres.soudure_type_flux || '-' },
      ];
      const sawColW2 = pageWidth / 2;

      sawParams.forEach((p, idx) => {
        const sx = 40 + idx * sawColW2;
        doc.rect(sx, sawRow, sawColW2, pRowH).fill('#f8fafc');
        doc.rect(sx, sawRow, sawColW2, pRowH).stroke(border);
        doc.fillColor(gray).fontSize(6).font('Helvetica')
           .text(p.label, sx + 6, sawRow + 4, { lineBreak: false });
        doc.fillColor('#111827').fontSize(6.5).font('Helvetica-Bold')
           .text(p.value, sx + sawColW2 / 2, sawRow + 4, { width: sawColW2 / 2 - 6, lineBreak: false });
      });
      doc.y = sawRow + pRowH + 6;

      // Têtes de soudure ID/OD
      if (soudureHeads.length > 0) {
        const idHeads = soudureHeads.filter(h => h.type === 'ID');
        const odHeads = soudureHeads.filter(h => h.type === 'OD');

        const headsStartY = doc.y;

        // ID Heads
        if (idHeads.length > 0) {
          doc.rect(leftX, headsStartY, pColW, pRowH).fill('#1e40af');
          doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold')
             .text('TÊTES ID (Intérieur)', leftX + 6, headsStartY + 4, { lineBreak: false });

          let hy = headsStartY + pRowH;
          // Sub-header with Fil column
          const subHdrW = [pColW * 0.22, pColW * 0.13, pColW * 0.22, pColW * 0.22, pColW * 0.21];
          const subHdrs = ['Tête', 'Actif', 'Fil', 'Ampérage', 'Voltage'];
          let shx = leftX;
          subHdrs.forEach((sh, si) => {
            doc.rect(shx, hy, subHdrW[si], 12).fill('#e0e7ff');
            doc.rect(shx, hy, subHdrW[si], 12).stroke(border);
            doc.fillColor(primary).fontSize(5.5).font('Helvetica-Bold')
               .text(sh, shx + 3, hy + 3, { lineBreak: false });
            shx += subHdrW[si];
          });
          hy += 12;

          for (const head of idHeads) {
            const bg = head.actif ? 'white' : '#fef2f2';
            shx = leftX;
            const vals = [`Tête ${head.numero}`, head.actif ? 'Oui' : 'Non', head.type_fil || '3.2mm', head.actif ? `${head.amperage} A` : '-', head.actif ? `${head.voltage} V` : '-'];
            vals.forEach((v, vi) => {
              doc.rect(shx, hy, subHdrW[vi], 12).fill(bg);
              doc.rect(shx, hy, subHdrW[vi], 12).stroke(border);
              const fc = vi === 1 ? (head.actif ? green : red) : '#374151';
              doc.fillColor(fc).fontSize(6).font(vi === 0 ? 'Helvetica-Bold' : 'Helvetica')
                 .text(v, shx + 3, hy + 3, { lineBreak: false });
              shx += subHdrW[vi];
            });
            hy += 12;
          }
        }

        // OD Heads
        if (odHeads.length > 0) {
          doc.rect(rightX, headsStartY, pColW, pRowH).fill('#1e40af');
          doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold')
             .text('TÊTES OD (Extérieur)', rightX + 6, headsStartY + 4, { lineBreak: false });

          let hy = headsStartY + pRowH;
          const subHdrW = [pColW * 0.22, pColW * 0.13, pColW * 0.22, pColW * 0.22, pColW * 0.21];
          const subHdrs = ['Tête', 'Actif', 'Fil', 'Ampérage', 'Voltage'];
          let shx = rightX;
          subHdrs.forEach((sh, si) => {
            doc.rect(shx, hy, subHdrW[si], 12).fill('#e0e7ff');
            doc.rect(shx, hy, subHdrW[si], 12).stroke(border);
            doc.fillColor(primary).fontSize(5.5).font('Helvetica-Bold')
               .text(sh, shx + 3, hy + 3, { lineBreak: false });
            shx += subHdrW[si];
          });
          hy += 12;

          for (const head of odHeads) {
            const bg = head.actif ? 'white' : '#fef2f2';
            shx = rightX;
            const vals = [`Tête ${head.numero}`, head.actif ? 'Oui' : 'Non', head.type_fil || '3.2mm', head.actif ? `${head.amperage} A` : '-', head.actif ? `${head.voltage} V` : '-'];
            vals.forEach((v, vi) => {
              doc.rect(shx, hy, subHdrW[vi], 12).fill(bg);
              doc.rect(shx, hy, subHdrW[vi], 12).stroke(border);
              const fc = vi === 1 ? (head.actif ? green : red) : '#374151';
              doc.fillColor(fc).fontSize(6).font(vi === 0 ? 'Helvetica-Bold' : 'Helvetica')
                 .text(v, shx + 3, hy + 3, { lineBreak: false });
              shx += subHdrW[vi];
            });
            hy += 12;
          }
        }

        const maxHeadRows = Math.max(idHeads.length, odHeads.length);
        doc.y = headsStartY + pRowH + 12 + (maxHeadRows * 12) + 8;
      }

      doc.y += 5;
    }

    // =========================================
    // ÉTAPES DE PRODUCTION
    // =========================================
    doc.y += 5;
    doc.fillColor(primary).fontSize(11).font('Helvetica-Bold')
       .text('ÉTAPES DE PRODUCTION', 40, doc.y);
    doc.y += 5;
    doc.strokeColor(accent).lineWidth(1).moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
    doc.y += 10;

    const ETAPE_NOMS = {
      1: 'Formage', 2: 'Pointage (GMAW)', 3: 'CV Pointage',
      4: 'SAW ID/OD', 5: 'CV Cordon', 6: 'Coupe',
      7: 'CND (Xray/UT)', 8: 'CV après CND', 9: 'Hydrotest',
      10: 'CV Fuite/Déform.', 11: 'Chanfrein', 12: 'CV Chanfrein'
    };

    const statutLabels = { valide: 'Validé', non_conforme: 'Non Conforme', saute: 'Passée', en_cours: 'En cours', en_attente: 'En attente' };
    const statutColors = { valide: green, non_conforme: red, saute: amber, en_cours: accent, en_attente: gray };

    // Helper formatage durée pour PDF
    function formatDurationPdf(ms) {
      if (!ms || ms <= 0) return '-';
      const totalSec = Math.floor(ms / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      if (days > 0) return `${days}j ${hours}h ${mins}min`;
      if (hours > 0) return `${hours}h ${mins}min`;
      return `${mins}min`;
    }

    for (const etape of etapes) {
      // Check if we need a new page
      if (doc.y > doc.page.height - 120) {
        drawFooter();
        doc.addPage();
      }

      const sColor = statutColors[etape.statut] || gray;
      const y = doc.y;

      // Dot
      doc.circle(52, y + 6, 5).fill(sColor);
      if (etape.statut === 'valide') {
        doc.fillColor('white').fontSize(6).font('Helvetica-Bold').text('✓', 49, y + 3);
      } else if (etape.statut === 'non_conforme') {
        doc.fillColor('white').fontSize(6).font('Helvetica-Bold').text('✗', 49.5, y + 3);
      } else {
        doc.fillColor('white').fontSize(6).font('Helvetica-Bold').text(String(etape.etape_numero), etape.etape_numero >= 10 ? 48 : 49.5, y + 3);
      }

      // Étape info
      doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold')
         .text(`${etape.etape_numero}. ${ETAPE_NOMS[etape.etape_numero] || etape.etape_code}`, 65, y);
      doc.fillColor(sColor).fontSize(7).font('Helvetica-Bold')
         .text(statutLabels[etape.statut] || etape.statut, 65 + 180, y + 1);

      doc.y = y + 14;

      // Opérateur + date + durée
      if (etape.operateur_prenom || etape.completed_at) {
        let info = '';
        if (etape.operateur_prenom) info += `Par ${etape.operateur_prenom} ${(etape.operateur_nom || '')[0] || ''}.`;
        if (etape.completed_at) info += ` le ${new Date(etape.completed_at).toLocaleString('fr-FR')}`;
        // Durée de l'étape
        if (etape.started_at && etape.completed_at) {
          const durationMs = new Date(etape.completed_at) - new Date(etape.started_at);
          info += ` · Durée: ${formatDurationPdf(durationMs)}`;
        }
        doc.fillColor(gray).fontSize(7).font('Helvetica').text(info.trim(), 65, doc.y);
        doc.y += 12;
      }

      // Délai inter-étape
      if (etape.etape_numero > 1) {
        const prevEtape = etapes.find(e => e.etape_numero === etape.etape_numero - 1);
        if (prevEtape?.completed_at && etape.started_at) {
          const delayMs = new Date(etape.started_at) - new Date(prevEtape.completed_at);
          if (delayMs > 60000) { // > 1 min
            const isLong = delayMs > 3600000; // > 1h
            doc.fillColor(isLong ? amber : gray).fontSize(6.5).font('Helvetica-Oblique')
               .text(`⏱ Attente avant cette étape : ${formatDurationPdf(delayMs)}`, 65, doc.y);
            doc.y += 10;
          }
        }
      }

      // Commentaire
      if (etape.commentaire) {
        doc.fillColor('#374151').fontSize(7).font('Helvetica-Oblique')
           .text(`💬 ${etape.commentaire}`, 65, doc.y, { width: pageWidth - 30 });
        doc.y += doc.heightOfString(`💬 ${etape.commentaire}`, { width: pageWidth - 30, fontSize: 7 }) + 4;
      }

      // Photos de l'étape
      const etapePhotos = photosByEtape[etape.etape_numero] || [];
      if (etapePhotos.length > 0) {
        const photoSize = 80;
        const photoGap = 8;
        const photosPerRow = Math.floor((pageWidth - 25) / (photoSize + photoGap));

        for (let i = 0; i < etapePhotos.length; i += photosPerRow) {
          if (doc.y + photoSize + 10 > doc.page.height - 60) {
            drawFooter();
            doc.addPage();
          }

          const rowPhotos = etapePhotos.slice(i, i + photosPerRow);
          for (let j = 0; j < rowPhotos.length; j++) {
            const photo = rowPhotos[j];
            const photoPath = path.join(__dirname, '../../uploads/tubes', photo.filename);
            if (fs.existsSync(photoPath)) {
              try {
                doc.image(photoPath, 65 + j * (photoSize + photoGap), doc.y, {
                  width: photoSize,
                  height: photoSize,
                  fit: [photoSize, photoSize]
                });
              } catch (e) {
                // Skip invalid images
                doc.rect(65 + j * (photoSize + photoGap), doc.y, photoSize, photoSize)
                   .fillAndStroke(lightGray, border);
                doc.fillColor(gray).fontSize(6).text('Image non disponible', 65 + j * (photoSize + photoGap) + 5, doc.y + 35);
              }
            }
          }
          doc.y += photoSize + 6;
        }
      }

      // Ligne séparatrice
      doc.y += 2;
      if (etape.etape_numero < 12) {
        doc.strokeColor(border).lineWidth(0.3).moveTo(65, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
        doc.y += 6;
      }
    }

    // =========================================
    // ANALYSE DES TEMPS
    // =========================================
    // Always start on a new page for clean layout
    drawFooter();
    doc.addPage();

    doc.fillColor(primary).fontSize(11).font('Helvetica-Bold')
       .text('ANALYSE DES TEMPS', 40, doc.y);
    doc.y += 5;
    doc.strokeColor(accent).lineWidth(1).moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
    doc.y += 12;

    // Tableau des temps - colonnes bien calibrées
    const tableLeft = 40;
    const tableWidth = pageWidth;
    const tColW = [
      Math.round(tableWidth * 0.26),  // Étape
      Math.round(tableWidth * 0.18),  // Début
      Math.round(tableWidth * 0.18),  // Fin
      Math.round(tableWidth * 0.18),  // Durée
    ];
    tColW.push(tableWidth - tColW[0] - tColW[1] - tColW[2] - tColW[3]); // Attente avant
    const timeHeaders = ['Étape', 'Début', 'Fin', 'Durée', 'Attente avant'];
    const rowH = 16;
    const headerH = 18;

    // Draw header
    let tx = tableLeft;
    const hdrY = doc.y;
    timeHeaders.forEach((h, i) => {
      doc.rect(tx, hdrY, tColW[i], headerH).fill(primary);
      doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
         .text(h, tx + 4, hdrY + 5, { width: tColW[i] - 8, lineBreak: false });
      tx += tColW[i];
    });
    doc.y = hdrY + headerH;

    let totalProductionMs = 0;
    let totalWaitMs = 0;
    let longestEtape = { name: '-', duration: 0 };
    let longestWait = { from: '-', to: '-', duration: 0 };

    for (const etape of etapes) {
      if (doc.y + rowH > doc.page.height - 60) {
        // Draw table bottom border before page break
        doc.strokeColor(border).lineWidth(0.5).moveTo(tableLeft, doc.y).lineTo(tableLeft + tableWidth, doc.y).stroke();
        drawFooter();
        doc.addPage();
        // Redraw header on new page
        tx = tableLeft;
        const hdrY2 = doc.y;
        timeHeaders.forEach((h, i) => {
          doc.rect(tx, hdrY2, tColW[i], headerH).fill(primary);
          doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
             .text(h, tx + 4, hdrY2 + 5, { width: tColW[i] - 8, lineBreak: false });
          tx += tColW[i];
        });
        doc.y = hdrY2 + headerH;
      }

      const etapeName = `${etape.etape_numero}. ${ETAPE_NOMS[etape.etape_numero] || etape.etape_code}`;
      const debut = etape.started_at ? new Date(etape.started_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
      const fin = etape.completed_at ? new Date(etape.completed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

      let duration = '-';
      let durationMs = 0;
      if (etape.started_at && etape.completed_at) {
        durationMs = new Date(etape.completed_at) - new Date(etape.started_at);
        duration = formatDurationPdf(durationMs);
        totalProductionMs += durationMs;
        if (durationMs > longestEtape.duration) {
          longestEtape = { name: etapeName, duration: durationMs };
        }
      } else if (etape.started_at && !etape.completed_at) {
        duration = 'En cours...';
      }

      let waitStr = '-';
      let waitMs = 0;
      if (etape.etape_numero > 1) {
        const prev = etapes.find(e => e.etape_numero === etape.etape_numero - 1);
        if (prev?.completed_at && etape.started_at) {
          waitMs = new Date(etape.started_at) - new Date(prev.completed_at);
          if (waitMs > 60000) {
            waitStr = formatDurationPdf(waitMs);
            totalWaitMs += waitMs;
            if (waitMs > longestWait.duration) {
              const prevName = ETAPE_NOMS[prev.etape_numero] || prev.etape_code;
              longestWait = { from: prevName, to: ETAPE_NOMS[etape.etape_numero] || etape.etape_code, duration: waitMs };
            }
          } else {
            waitStr = '< 1min';
          }
        }
      }

      const isLongWait = waitMs > 3600000;
      const rowBg = etape.statut === 'non_conforme' ? '#fef2f2' : (etape.etape_numero % 2 === 0 ? '#f8fafc' : 'white');

      // Draw row cells with borders
      const rowY = doc.y;
      tx = tableLeft;
      const rowData = [etapeName, debut, fin, duration, waitStr];
      rowData.forEach((val, i) => {
        // Cell background
        doc.rect(tx, rowY, tColW[i], rowH).fill(rowBg);
        // Cell border
        doc.rect(tx, rowY, tColW[i], rowH).stroke(border);
        // Text color
        let fontColor = '#374151';
        let fontName = 'Helvetica';
        if (i === 0) { fontName = 'Helvetica-Bold'; fontColor = '#111827'; }
        if (i === 3 && durationMs > 0) fontColor = '#1e40af';
        if (i === 3 && duration === 'En cours...') { fontColor = accent; fontName = 'Helvetica-Oblique'; }
        if (i === 4 && isLongWait) { fontColor = red; fontName = 'Helvetica-Bold'; }
        else if (i === 4 && waitMs > 60000) fontColor = amber;

        doc.fillColor(fontColor).fontSize(6.5).font(fontName)
           .text(val, tx + 4, rowY + 5, { width: tColW[i] - 8, lineBreak: false });
        tx += tColW[i];
      });
      doc.y = rowY + rowH;
    }

    // Table bottom border
    doc.strokeColor(border).lineWidth(0.5)
       .moveTo(tableLeft, doc.y).lineTo(tableLeft + tableWidth, doc.y).stroke();

    // =========================================
    // Résumé des temps - cards layout
    // =========================================
    doc.y += 14;
    const firstStarted = etapes.find(e => e.started_at);
    const lastCompleted = [...etapes].reverse().find(e => e.completed_at);
    const totalElapsed = (firstStarted && lastCompleted) ? new Date(lastCompleted.completed_at) - new Date(firstStarted.started_at) : 0;
    const efficiency = totalElapsed > 0 ? Math.round((totalProductionMs / totalElapsed) * 100) : 0;

    // Check space for summary
    if (doc.y + 75 > doc.page.height - 50) {
      drawFooter();
      doc.addPage();
    }

    // Summary title
    doc.fillColor(primary).fontSize(9).font('Helvetica-Bold')
       .text('Résumé des performances', tableLeft, doc.y);
    doc.y += 14;

    // 4 metric cards in a row
    const cardGap = 6;
    const cardCount = 4;
    const cardW = (tableWidth - cardGap * (cardCount - 1)) / cardCount;
    const cardH = 42;

    const metrics = [
      { label: 'Temps total', value: totalElapsed > 0 ? formatDurationPdf(totalElapsed) : '-', color: primary, bgColor: '#eff6ff' },
      { label: 'Production', value: formatDurationPdf(totalProductionMs), color: green, bgColor: '#f0fdf4' },
      { label: 'Attente cumulée', value: formatDurationPdf(totalWaitMs), color: totalWaitMs > 3600000 ? red : amber, bgColor: totalWaitMs > 3600000 ? '#fef2f2' : '#fffbeb' },
      { label: 'Efficacité', value: `${efficiency}%`, color: efficiency >= 70 ? green : efficiency >= 40 ? amber : red, bgColor: efficiency >= 70 ? '#f0fdf4' : efficiency >= 40 ? '#fffbeb' : '#fef2f2' },
    ];

    const cardsY = doc.y;
    metrics.forEach((m, i) => {
      const cx = tableLeft + i * (cardW + cardGap);
      // Card background
      doc.roundedRect(cx, cardsY, cardW, cardH, 3).fillAndStroke(m.bgColor, m.color + '40');
      // Label
      doc.fillColor(gray).fontSize(6).font('Helvetica')
         .text(m.label, cx + 8, cardsY + 6, { width: cardW - 16, lineBreak: false });
      // Value
      doc.fillColor(m.color).fontSize(12).font('Helvetica-Bold')
         .text(m.value, cx + 8, cardsY + 18, { width: cardW - 16, lineBreak: false });
    });
    doc.y = cardsY + cardH + 10;

    // Bottom detail rows
    if (doc.y + 30 > doc.page.height - 50) {
      drawFooter();
      doc.addPage();
    }

    const detailRows = [
      { icon: '⏱', label: 'Étape la plus longue', value: `${longestEtape.name} — ${formatDurationPdf(longestEtape.duration)}` },
      { icon: '⏳', label: 'Plus long délai inter-étape', value: longestWait.duration > 0 ? `${longestWait.from} → ${longestWait.to} — ${formatDurationPdf(longestWait.duration)}` : 'Aucun délai significatif' },
    ];

    detailRows.forEach(row => {
      const drY = doc.y;
      doc.rect(tableLeft, drY, tableWidth, 14).fill('#f8fafc');
      doc.rect(tableLeft, drY, tableWidth, 14).stroke(border);
      doc.fillColor(gray).fontSize(6.5).font('Helvetica')
         .text(`${row.icon}  ${row.label} :`, tableLeft + 6, drY + 4, { lineBreak: false });
      doc.fillColor('#111827').fontSize(6.5).font('Helvetica-Bold')
         .text(row.value, tableLeft + 160, drY + 4, { width: tableWidth - 170, lineBreak: false });
      doc.y = drY + 14;
    });

    doc.y += 12;

    // =========================================
    // TRAÇABILITÉ
    // =========================================
    if (doc.y > doc.page.height - 80) {
      drawFooter();
      doc.addPage();
    }

    doc.fillColor(primary).fontSize(11).font('Helvetica-Bold')
       .text('TRAÇABILITÉ', 40, doc.y);
    doc.y += 5;
    doc.strokeColor(accent).lineWidth(1).moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).stroke();
    doc.y += 10;

    const traceItems = [
      { label: 'Création', value: tube.created_at ? new Date(tube.created_at).toLocaleString('fr-FR') : '-' },
      { label: 'Fin production', value: tube.date_fin_production ? new Date(tube.date_fin_production).toLocaleString('fr-FR') : '-' },
      { label: 'Durée totale', value: totalElapsed > 0 ? formatDurationPdf(totalElapsed) : '-' },
      { label: 'Décision le', value: tube.decision_date ? new Date(tube.decision_date).toLocaleString('fr-FR') : '-' },
      { label: 'Nombre photos', value: String(photos.length) },
    ];

    traceItems.forEach(item => {
      doc.fillColor(gray).fontSize(7).font('Helvetica').text(item.label + ' :', 45, doc.y, { continued: true });
      doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold').text('  ' + item.value);
      doc.y += 4;
    });

    drawFooter();
    doc.end();

  } catch (error) {
    console.error('Erreur GET /tubes/:id/pdf:', error);
    res.status(500).json({ error: 'Erreur génération PDF' });
  }
});

// ============================================
// DELETE /api/tubes/:id - Supprimer un tube
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const [tube] = await pool.query('SELECT id FROM tubes WHERE id = ?', [req.params.id]);
    if (tube.length === 0) return res.status(404).json({ error: 'Tube non trouvé' });

    // Supprimer les fichiers photos associés
    const [photos] = await pool.query('SELECT filename FROM tube_etape_photos WHERE tube_id = ?', [req.params.id]);
    for (const photo of photos) {
      const filePath = path.join(tubesUploadsDir, photo.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM tubes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tube supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /tubes:', error);
    res.status(500).json({ error: 'Erreur suppression tube' });
  }
});

// ============================================
// GET /api/tubes/:id/certificat - Certificat PDF (API 5L ou Hydraulique)
// ============================================
router.get('/:id/certificat', async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');

    const [tubes] = await pool.query(`
      SELECT t.*, c.numero as coulee_numero, c2.numero as coulee_numero_2,
             b.numero as bobine_numero, b.epaisseur as bobine_epaisseur,
             b.largeur as bobine_largeur, b.poids as bobine_poids,
             pp.numero as parametre_numero
      FROM tubes t
      LEFT JOIN coulees c ON t.coulee_id = c.id
      LEFT JOIN coulees c2 ON t.coulee_id_2 = c2.id
      LEFT JOIN bobines b ON c.bobine_id = b.id
      LEFT JOIN parametres_production pp ON t.parametre_id = pp.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (tubes.length === 0) return res.status(404).json({ error: 'Tube non trouvé' });
    const tube = tubes[0];

    if (!tube.decision || (tube.decision !== 'certifie_api' && tube.decision !== 'certifie_hydraulique')) {
      return res.status(400).json({ error: 'Ce tube n\'a pas de certification valide' });
    }

    const [projetRows] = await pool.query('SELECT * FROM projet_parametres LIMIT 1');
    const projet = projetRows.length > 0 ? projetRows[0] : {};

    const isAPI = tube.decision === 'certifie_api';
    const certType = isAPI ? 'API 5L' : 'HYDRAULIQUE';
    const certNumber = `CERT-${isAPI ? 'API' : 'HYD'}-${String(tube.numero).padStart(4, '0')}-${new Date(tube.decision_date || Date.now()).getFullYear()}`;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: `Certificat ${certType} - Tube N°${tube.numero}`,
        Author: 'LogiTrack - Danieli Centro Tube',
        Subject: `Certificat de conformité ${certType}`
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=certificat_${certType.toLowerCase().replace(' ', '_')}_tube_${tube.numero}.pdf`);
    doc.pipe(res);

    const W = 595.28;
    const H = 841.89;
    const path = require('path');

    // ──────────────────────────────────────────────
    // LIGHT THEMES — ink-friendly, elegant
    // ──────────────────────────────────────────────
    let t;
    if (isAPI) {
      t = {
        accent: '#b8860b',        // dark gold
        accentLight: '#d4a853',   // gold
        accentPale: '#f5e6c8',    // pale gold bg
        accentFaint: '#faf3e3',   // very faint gold
        border: '#c9a227',        // gold border
        borderLight: '#e0cc8a',   // light gold border
        title: '#1a1a2e',         // near-black
        text: '#2d2d2d',          // dark gray text
        textLight: '#666666',     // gray labels
        textMuted: '#999999',     // muted
        tableBg: '#fdfaf3',       // warm off-white
        tableAlt: '#f7f0e0',     // alternating row
        tableHeader: '#b8860b',   // gold header
        tableHeaderText: '#ffffff',
        sealBg: '#faf3e3',
      };
    } else {
      t = {
        accent: '#1565c0',        // deep blue
        accentLight: '#42a5f5',   // medium blue
        accentPale: '#e3f2fd',    // pale blue bg
        accentFaint: '#f0f7ff',   // very faint blue
        border: '#1976d2',        // blue border
        borderLight: '#90caf9',   // light blue border
        title: '#0d1b2a',         // near-black
        text: '#2d2d2d',          // dark gray text
        textLight: '#666666',     // gray labels
        textMuted: '#999999',     // muted
        tableBg: '#f8fbff',       // cool off-white
        tableAlt: '#eaf4fe',     // alternating row
        tableHeader: '#1565c0',   // blue header
        tableHeaderText: '#ffffff',
        sealBg: '#e8f0fe',
      };
    }

    // ──────────────────────────────────────────────
    // WHITE BACKGROUND
    // ──────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill('#ffffff');

    // ──────────────────────────────────────────────
    // DECORATIVE BORDERS — elegant double frame
    // ──────────────────────────────────────────────
    // Outer border — thick accent
    doc.rect(18, 18, W - 36, H - 36).lineWidth(2.5).stroke(t.accent);
    // Inner border — thin accent
    doc.rect(25, 25, W - 50, H - 50).lineWidth(0.8).stroke(t.borderLight);

    // Corner ornaments — L-shapes
    const crnSz = 30;
    const crnPts = [
      { x: 25, y: 25, dx: 1, dy: 1 },
      { x: W - 25, y: 25, dx: -1, dy: 1 },
      { x: 25, y: H - 25, dx: 1, dy: -1 },
      { x: W - 25, y: H - 25, dx: -1, dy: -1 }
    ];
    crnPts.forEach(cp => {
      doc.moveTo(cp.x, cp.y).lineTo(cp.x + crnSz * cp.dx, cp.y).lineWidth(2).stroke(t.accent);
      doc.moveTo(cp.x, cp.y).lineTo(cp.x, cp.y + crnSz * cp.dy).lineWidth(2).stroke(t.accent);
    });

    // Top accent stripe — thin colored bar
    doc.rect(25, 25, W - 50, 4).fill(t.accent);

    // ──────────────────────────────────────────────
    // LOGOS
    // ──────────────────────────────────────────────
    let cursorY = 48;
    try {
      if (projet.logo_path) {
        const logoPath = path.join(__dirname, '..', '..', projet.logo_path);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 55, cursorY, { width: 80, height: 42 });
        }
      }
      if (projet.client_logo_path) {
        const clientLogoPath = path.join(__dirname, '..', '..', projet.client_logo_path);
        if (fs.existsSync(clientLogoPath)) {
          doc.image(clientLogoPath, W - 55 - 80, cursorY, { width: 80, height: 42 });
        }
      }
    } catch (e) { /* ignore logo errors */ }

    // ──────────────────────────────────────────────
    // TITLE SECTION
    // ──────────────────────────────────────────────
    cursorY = 105;

    // Decorative line with diamond
    const lineW = 160;
    doc.moveTo(W / 2 - lineW, cursorY).lineTo(W / 2 - 8, cursorY).lineWidth(1).stroke(t.accent);
    doc.moveTo(W / 2 + 8, cursorY).lineTo(W / 2 + lineW, cursorY).lineWidth(1).stroke(t.accent);
    doc.save();
    doc.translate(W / 2, cursorY);
    doc.rotate(45);
    doc.rect(-4.5, -4.5, 9, 9).lineWidth(1.2).stroke(t.accent);
    doc.restore();

    cursorY += 18;

    // "CERTIFICAT DE CONFORMITÉ"
    doc.font('Helvetica').fontSize(11).fillColor(t.textLight);
    doc.text('CERTIFICAT DE CONFORMITÉ', 0, cursorY, { width: W, align: 'center', characterSpacing: 3, lineBreak: false });
    cursorY += 28;

    // Main title
    doc.font('Helvetica-Bold').fontSize(isAPI ? 34 : 30).fillColor(t.accent);
    doc.text(isAPI ? 'API 5L / PSL2' : 'ÉPREUVE HYDRAULIQUE', 0, cursorY, { width: W, align: 'center', lineBreak: false });
    cursorY += isAPI ? 45 : 42;

    // Subtitle
    doc.font('Helvetica').fontSize(10).fillColor(t.textLight);
    doc.text(
      isAPI
        ? 'Spécification pour tubes de conduite — Niveau de spécification de produit 2'
        : 'Certification d\'épreuve hydrostatique selon les normes en vigueur',
      70, cursorY, { width: W - 140, align: 'center' }
    );
    cursorY += 24;

    // Second decorative line
    doc.moveTo(W / 2 - lineW, cursorY).lineTo(W / 2 - 8, cursorY).lineWidth(1).stroke(t.accent);
    doc.moveTo(W / 2 + 8, cursorY).lineTo(W / 2 + lineW, cursorY).lineWidth(1).stroke(t.accent);
    doc.save();
    doc.translate(W / 2, cursorY);
    doc.rotate(45);
    doc.rect(-3.5, -3.5, 7, 7).lineWidth(1).stroke(t.accent);
    doc.restore();

    cursorY += 22;

    // ──────────────────────────────────────────────
    // CERTIFICATE NUMBER BADGE
    // ──────────────────────────────────────────────
    const bW = 280;
    const bH = 24;
    const bX = (W - bW) / 2;
    doc.roundedRect(bX, cursorY, bW, bH, 12).lineWidth(1).stroke(t.accent);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(t.accent);
    doc.text(certNumber, bX, cursorY + 7, { width: bW, align: 'center', characterSpacing: 1, lineBreak: false });
    cursorY += bH + 18;

    // ──────────────────────────────────────────────
    // PROJECT INFO — 2x2 grid on pale background
    // ──────────────────────────────────────────────
    const piX = 55;
    const piW = W - 110;
    const piH = 58;
    doc.roundedRect(piX, cursorY, piW, piH, 5).fill(t.accentFaint);
    doc.roundedRect(piX, cursorY, piW, piH, 5).lineWidth(0.6).stroke(t.borderLight);

    const c1X = piX + 15;
    const c2X = piX + piW / 2 + 10;
    let iy = cursorY + 8;

    doc.font('Helvetica').fontSize(7).fillColor(t.textMuted);
    doc.text('CLIENT', c1X, iy, { lineBreak: false });
    doc.text('PROJET', c2X, iy, { lineBreak: false });
    iy += 11;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(t.title);
    doc.text(projet.client_nom || '—', c1X, iy, { lineBreak: false });
    doc.text(projet.projet_nom || '—', c2X, iy, { width: piW / 2 - 25, lineBreak: false });
    iy += 17;
    doc.font('Helvetica').fontSize(7).fillColor(t.textMuted);
    doc.text('CODE PROJET', c1X, iy, { lineBreak: false });
    doc.text('DATE DE CERTIFICATION', c2X, iy, { lineBreak: false });
    iy += 11;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(t.title);
    doc.text(projet.projet_code || '—', c1X, iy, { lineBreak: false });
    const decisionDate = tube.decision_date ? new Date(tube.decision_date) : new Date();
    doc.text(decisionDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }), c2X, iy, { lineBreak: false });

    cursorY += piH + 22;

    // ──────────────────────────────────────────────
    // CERTIFICATION STATEMENT — elegant encadré
    // ──────────────────────────────────────────────
    const stX = 50;
    const stW = W - 100;
    const stH = 80;
    // Pale background box
    doc.roundedRect(stX, cursorY, stW, stH, 6).fill(t.accentPale);
    // Left accent bar
    doc.roundedRect(stX, cursorY, 4, stH, 2).fill(t.accent);

    let stY = cursorY + 12;
    doc.font('Helvetica').fontSize(10).fillColor(t.text);
    doc.text('Il est certifié par la présente que le tube ci-dessous désigné', stX + 18, stY, { width: stW - 36, align: 'center' });
    stY += 15;
    doc.text(
      isAPI
        ? 'a été fabriqué, contrôlé et éprouvé conformément aux exigences de la norme'
        : 'a subi avec succès l\'épreuve hydrostatique conformément aux exigences de la norme',
      stX + 18, stY, { width: stW - 36, align: 'center' }
    );
    stY += 18;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(t.accent);
    doc.text(
      isAPI
        ? 'API SPEC 5L — 46ème Édition — PSL2'
        : 'API SPEC 5L & ASME B31.8 — Épreuve Hydrostatique',
      stX + 18, stY, { width: stW - 36, align: 'center' }
    );
    stY += 17;
    doc.font('Helvetica').fontSize(10).fillColor(t.text);
    doc.text(
      isAPI
        ? 'et satisfait à toutes les conditions requises pour la certification API 5L / PSL2.'
        : 'et répond à toutes les conditions d\'acceptation pour la certification hydraulique.',
      stX + 18, stY, { width: stW - 36, align: 'center' }
    );

    cursorY += stH + 18;

    // ──────────────────────────────────────────────
    // TUBE DATA TABLE — clean, light
    // ──────────────────────────────────────────────
    const tblX = 55;
    const tblW = W - 110;
    const tblCellH = 34;
    const cellW = tblW / 2;

    const dataRows = [
      [
        { label: 'NUMÉRO DE TUBE', value: `N° ${tube.numero}` },
        { label: 'NUMÉRO DE COULÉE', value: tube.coulee_numero || '—' },
      ],
      [
        { label: 'NUMÉRO DE BOBINE', value: tube.bobine_numero || '—' },
        { label: 'CLASSE / GRADE', value: tube.classe || '—' },
      ],
      [
        { label: 'DIAMÈTRE', value: `${tube.diametre_mm || '—'} mm  (${tube.diametre_pouce || '—'})` },
        { label: 'ÉPAISSEUR', value: `${tube.epaisseur || tube.bobine_epaisseur || '—'} mm` },
      ],
      [
        { label: 'NORME', value: tube.norme || 'API 5L' },
        { label: 'LONGUEUR', value: tube.longueur ? `${tube.longueur} mm` : '—' },
      ],
    ];

    // Table header
    doc.roundedRect(tblX, cursorY, tblW, 22, 4).fill(t.tableHeader);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(t.tableHeaderText);
    doc.text('CARACTÉRISTIQUES DU TUBE', tblX, cursorY + 6, { width: tblW, align: 'center', characterSpacing: 1, lineBreak: false });
    cursorY += 22;

    dataRows.forEach((row, ri) => {
      const rY = cursorY;
      const bgColor = ri % 2 === 0 ? t.tableBg : t.tableAlt;
      doc.rect(tblX, rY, tblW, tblCellH).fill(bgColor);
      doc.rect(tblX, rY, tblW, tblCellH).lineWidth(0.4).stroke(t.borderLight);
      doc.moveTo(tblX + cellW, rY).lineTo(tblX + cellW, rY + tblCellH).lineWidth(0.4).stroke(t.borderLight);

      row.forEach((cell, ci) => {
        const cx = tblX + ci * cellW + 12;
        doc.font('Helvetica').fontSize(7).fillColor(t.textMuted);
        doc.text(cell.label, cx, rY + 5, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(11).fillColor(t.title);
        doc.text(cell.value, cx, rY + 17, { lineBreak: false });
      });

      cursorY += tblCellH;
    });

    // Table bottom accent
    doc.rect(tblX, cursorY, tblW, 2).fill(t.accent);

    cursorY += 25;

    // ──────────────────────────────────────────────
    // SEAL / STAMP — light elegant
    // ──────────────────────────────────────────────
    const sealR = 38;
    const sealCX = W / 2;
    const sealCY = cursorY + sealR;

    // Faint circle background
    doc.circle(sealCX, sealCY, sealR + 2).fill(t.accentFaint);
    // Outer ring
    doc.circle(sealCX, sealCY, sealR).lineWidth(2).stroke(t.accent);
    // Inner ring
    doc.circle(sealCX, sealCY, sealR - 4).lineWidth(0.7).stroke(t.accent);

    // Dots around
    for (let a = 0; a < 360; a += 15) {
      const rad = (a * Math.PI) / 180;
      const px = sealCX + (sealR - 2) * Math.cos(rad);
      const py = sealCY + (sealR - 2) * Math.sin(rad);
      doc.circle(px, py, 0.8).fill(t.accent);
    }

    // Seal text
    doc.font('Helvetica-Bold').fontSize(7).fillColor(t.accent);
    doc.text(isAPI ? 'CERTIFIÉ' : 'ÉPROUVÉ', sealCX - 25, sealCY - 16, { width: 50, align: 'center', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(t.accent);
    doc.text(isAPI ? 'API' : 'HYD', sealCX - 25, sealCY - 5, { width: 50, align: 'center', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(isAPI ? 10 : 7).fillColor(t.accent);
    doc.text(isAPI ? '5L' : 'HYDRAULIQUE', sealCX - 30, sealCY + 12, { width: 60, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(5.5).fillColor(t.textLight);
    doc.text('CONFORME', sealCX - 25, sealCY + 24, { width: 50, align: 'center', lineBreak: false });

    cursorY = sealCY + sealR + 25;

    // ──────────────────────────────────────────────
    // SIGNATURES
    // ──────────────────────────────────────────────
    const sigW = 170;
    const sigYPos = cursorY;
    const sigLX = 80;
    const sigRX = W - 80 - sigW;

    // Left
    doc.font('Helvetica').fontSize(8).fillColor(t.textLight);
    doc.text('Responsable Qualité', sigLX, sigYPos, { width: sigW, align: 'center', lineBreak: false });
    doc.moveTo(sigLX + 15, sigYPos + 28).lineTo(sigLX + sigW - 15, sigYPos + 28).lineWidth(0.6).dash(3, { space: 2 }).stroke(t.borderLight);
    doc.undash();
    doc.font('Helvetica').fontSize(6.5).fillColor(t.textMuted);
    doc.text('Signature & Cachet', sigLX, sigYPos + 33, { width: sigW, align: 'center', lineBreak: false });

    // Right
    doc.font('Helvetica').fontSize(8).fillColor(t.textLight);
    doc.text('Directeur de Production', sigRX, sigYPos, { width: sigW, align: 'center', lineBreak: false });
    doc.moveTo(sigRX + 15, sigYPos + 28).lineTo(sigRX + sigW - 15, sigYPos + 28).lineWidth(0.6).dash(3, { space: 2 }).stroke(t.borderLight);
    doc.undash();
    doc.font('Helvetica').fontSize(6.5).fillColor(t.textMuted);
    doc.text('Signature & Cachet', sigRX, sigYPos + 33, { width: sigW, align: 'center', lineBreak: false });

    if (tube.decision_par) {
      doc.font('Helvetica').fontSize(7).fillColor(t.textLight);
      doc.text(`Certifié par : ${tube.decision_par}`, 0, sigYPos + 50, { width: W, align: 'center', lineBreak: false });
    }

    // ──────────────────────────────────────────────
    // FOOTER
    // ──────────────────────────────────────────────
    const ftY = H - 55;
    doc.moveTo(50, ftY).lineTo(W - 50, ftY).lineWidth(0.4).stroke(t.borderLight);
    doc.font('Helvetica').fontSize(7).fillColor(t.textLight);
    doc.text('Danieli Centro Tube — LogiTrack Production Management System', 0, ftY + 7, { width: W, align: 'center', lineBreak: false });
    doc.text(
      `${projet.projet_adresse || ''} ${projet.client_adresse ? '• ' + projet.client_adresse : ''}`,
      0, ftY + 18, { width: W, align: 'center', lineBreak: false }
    );
    doc.font('Helvetica').fontSize(5.5).fillColor(t.textMuted);
    doc.text('Ce certificat est généré électroniquement et ne nécessite pas de signature manuscrite pour être valide.', 0, ftY + 32, { width: W, align: 'center', lineBreak: false });

    doc.end();

  } catch (error) {
    console.error('Erreur certificat PDF:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération certificat' });
  }
});

module.exports = router;
