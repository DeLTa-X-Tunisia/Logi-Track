/**
 * Routes API pour les tubes - LogiTrack
 * Système de suivi de production avec 12 étapes
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

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
    
    query += ' ORDER BY t.created_at DESC';
    const [tubes] = await pool.query(query, params);

    // Récupérer les étapes pour chaque tube
    for (const tube of tubes) {
      const [etapes] = await pool.query(
        'SELECT * FROM tube_etapes WHERE tube_id = ? ORDER BY etape_numero', [tube.id]
      );
      tube.etapes = etapes;
    }

    res.json(tubes);
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
            INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [finalParametreId, head.type, head.numero, head.actif ? 1 : 0, head.actif ? (head.amperage || 0) : 0, head.actif ? (head.voltage || 0) : 0]);
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
    res.json(updatedTube[0]);
  } catch (error) {
    console.error('Erreur decision:', error);
    res.status(500).json({ error: 'Erreur enregistrement décision' });
  }
});

// ============================================
// DELETE /api/tubes/:id - Supprimer un tube
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const [tube] = await pool.query('SELECT id FROM tubes WHERE id = ?', [req.params.id]);
    if (tube.length === 0) return res.status(404).json({ error: 'Tube non trouvé' });
    await pool.query('DELETE FROM tubes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tube supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /tubes:', error);
    res.status(500).json({ error: 'Erreur suppression tube' });
  }
});

module.exports = router;
