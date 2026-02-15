/**
 * Routes API Paramètres de Production
 * CRUD complet + numérotation automatique PAR-XXX
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ============================================
// GET /api/parametres - Liste tous les presets
// ============================================
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT pp.*,
             (SELECT COUNT(*) FROM coulees WHERE parametre_id = pp.id) as nb_coulees
      FROM parametres_production pp
      ORDER BY pp.id DESC
    `);

    // Batch load heads for all presets (fix N+1)
    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      const [allHeads] = await pool.query(
        `SELECT * FROM parametres_soudure_heads WHERE parametre_id IN (?) ORDER BY type, numero`,
        [ids]
      );
      const headsByParam = {};
      for (const h of allHeads) {
        if (!headsByParam[h.parametre_id]) headsByParam[h.parametre_id] = [];
        headsByParam[h.parametre_id].push(h);
      }
      for (const row of rows) {
        row.heads = headsByParam[row.id] || [];
      }
    }

    res.json(rows);
  } catch (error) {
    console.error('Erreur GET /parametres:', error);
    res.status(500).json({ error: 'Erreur récupération paramètres' });
  }
});

// ============================================
// GET /api/parametres/prochain-numero
// ============================================
router.get('/prochain-numero', async (req, res) => {
  try {
    const { diametre } = req.query;
    let next;

    if (diametre) {
      // Format PAR-{diametre}-{seq}
      const prefix = `PAR-${diametre}-`;
      const [rows] = await pool.query(
        `SELECT numero FROM parametres_production WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`,
        [`${prefix}%`]
      );
      let seq = 1;
      if (rows.length > 0) {
        const match = rows[0].numero.match(/PAR-\d+-?(\d+)$/);
        if (match) seq = parseInt(match[1], 10) + 1;
      }
      next = `${prefix}${seq}`;
    } else {
      // Legacy format PAR-XXX
      const [rows] = await pool.query(
        `SELECT numero FROM parametres_production WHERE numero REGEXP '^PAR-[0-9]{3}$' ORDER BY id DESC LIMIT 1`
      );
      let num = 1;
      if (rows.length > 0) {
        num = parseInt(rows[0].numero.replace('PAR-', ''), 10) + 1;
      }
      next = `PAR-${String(num).padStart(3, '0')}`;
    }

    res.json({ numero: next });
  } catch (error) {
    console.error('Erreur prochain-numero:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ============================================
// GET /api/parametres/:id - Détail d'un preset
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM parametres_production WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Preset non trouvé' });
    }

    const preset = rows[0];
    const [heads] = await pool.query(
      `SELECT * FROM parametres_soudure_heads WHERE parametre_id = ? ORDER BY type, numero`,
      [preset.id]
    );
    preset.heads = heads;
    res.json(preset);
  } catch (error) {
    console.error('Erreur GET /parametres/:id:', error);
    res.status(500).json({ error: 'Erreur récupération preset' });
  }
});

// ============================================
// POST /api/parametres - Créer un nouveau preset
// ============================================
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      numero, diametre_pouce,
      // Formage
      strip_vitesse_m, strip_vitesse_cm,
      milling_edge_gauche, milling_edge_droit,
      pression_rouleaux, pression_rouleaux_unite,
      // Tackwelding
      tack_amperage, tack_voltage,
      tack_vitesse_m, tack_vitesse_cm,
      tack_frequence, tack_type_gaz, tack_debit_gaz,
      // Soudure finale
      soudure_vitesse_m, soudure_vitesse_cm,
      soudure_type_fil, soudure_type_flux,
      // Heads
      heads,
      notes
    } = req.body;

    const created_by = req.user?.operateurId || req.user?.userId || null;
    const createur_nom = req.user?.nom || null;
    const createur_prenom = req.user?.prenom || null;

    const [result] = await conn.query(`
      INSERT INTO parametres_production (
        numero, diametre_pouce,
        strip_vitesse_m, strip_vitesse_cm,
        milling_edge_gauche, milling_edge_droit,
        pression_rouleaux, pression_rouleaux_unite,
        tack_amperage, tack_voltage,
        tack_vitesse_m, tack_vitesse_cm,
        tack_frequence, tack_type_gaz, tack_debit_gaz,
        soudure_vitesse_m, soudure_vitesse_cm,
        soudure_type_fil, soudure_type_flux,
        notes, created_by, createur_nom, createur_prenom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      numero, diametre_pouce || null,
      strip_vitesse_m || 0, strip_vitesse_cm || 0,
      milling_edge_gauche || 0, milling_edge_droit || 0,
      pression_rouleaux || null, pression_rouleaux_unite || 'tonnes',
      tack_amperage || 0, tack_voltage || 0,
      tack_vitesse_m || 0, tack_vitesse_cm || 0,
      tack_frequence || null, tack_type_gaz || 'CO2', tack_debit_gaz || null,
      soudure_vitesse_m || 0, soudure_vitesse_cm || 0,
      soudure_type_fil || '1.6mm', soudure_type_flux || 'SAW',
      notes || null, created_by, createur_nom, createur_prenom
    ]);

    const presetId = result.insertId;

    // Insérer les têtes de soudure
    if (heads && Array.isArray(heads)) {
      for (const head of heads) {
        await conn.query(`
          INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [presetId, head.type, head.numero, head.actif ? 1 : 0, head.actif ? (head.amperage || 0) : 0, head.actif ? (head.voltage || 0) : 0]);
      }
    }

    await conn.commit();

    // Retourner le preset complet
    const [newPreset] = await pool.query(`SELECT * FROM parametres_production WHERE id = ?`, [presetId]);
    const [newHeads] = await pool.query(`SELECT * FROM parametres_soudure_heads WHERE parametre_id = ? ORDER BY type, numero`, [presetId]);
    newPreset[0].heads = newHeads;

    res.status(201).json(newPreset[0]);
  } catch (error) {
    await conn.rollback();
    console.error('Erreur POST /parametres:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ce numéro de preset existe déjà' });
    }
    res.status(500).json({ error: 'Erreur création preset' });
  } finally {
    conn.release();
  }
});

// ============================================
// PUT /api/parametres/:id - Modifier un preset
// ============================================
router.put('/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const {
      strip_vitesse_m, strip_vitesse_cm,
      milling_edge_gauche, milling_edge_droit,
      pression_rouleaux, pression_rouleaux_unite,
      tack_amperage, tack_voltage,
      tack_vitesse_m, tack_vitesse_cm,
      tack_frequence, tack_type_gaz, tack_debit_gaz,
      soudure_vitesse_m, soudure_vitesse_cm,
      soudure_type_fil, soudure_type_flux,
      heads,
      notes
    } = req.body;

    await conn.query(`
      UPDATE parametres_production SET
        strip_vitesse_m = ?, strip_vitesse_cm = ?,
        milling_edge_gauche = ?, milling_edge_droit = ?,
        pression_rouleaux = ?, pression_rouleaux_unite = ?,
        tack_amperage = ?, tack_voltage = ?,
        tack_vitesse_m = ?, tack_vitesse_cm = ?,
        tack_frequence = ?, tack_type_gaz = ?, tack_debit_gaz = ?,
        soudure_vitesse_m = ?, soudure_vitesse_cm = ?,
        soudure_type_fil = ?, soudure_type_flux = ?,
        notes = ?
      WHERE id = ?
    `, [
      strip_vitesse_m || 0, strip_vitesse_cm || 0,
      milling_edge_gauche || 0, milling_edge_droit || 0,
      pression_rouleaux || null, pression_rouleaux_unite || 'tonnes',
      tack_amperage || 0, tack_voltage || 0,
      tack_vitesse_m || 0, tack_vitesse_cm || 0,
      tack_frequence || null, tack_type_gaz || 'CO2', tack_debit_gaz || null,
      soudure_vitesse_m || 0, soudure_vitesse_cm || 0,
      soudure_type_fil || '1.6mm', soudure_type_flux || 'SAW',
      notes || null,
      id
    ]);

    // Recréer les heads
    if (heads && Array.isArray(heads)) {
      await conn.query(`DELETE FROM parametres_soudure_heads WHERE parametre_id = ?`, [id]);
      for (const head of heads) {
        await conn.query(`
          INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [id, head.type, head.numero, head.actif ? 1 : 0, head.actif ? (head.amperage || 0) : 0, head.actif ? (head.voltage || 0) : 0]);
      }
    }

    await conn.commit();

    const [updated] = await pool.query(`SELECT * FROM parametres_production WHERE id = ?`, [id]);
    const [updatedHeads] = await pool.query(`SELECT * FROM parametres_soudure_heads WHERE parametre_id = ? ORDER BY type, numero`, [id]);
    updated[0].heads = updatedHeads;

    res.json(updated[0]);
  } catch (error) {
    await conn.rollback();
    console.error('Erreur PUT /parametres/:id:', error);
    res.status(500).json({ error: 'Erreur modification preset' });
  } finally {
    conn.release();
  }
});

// ============================================
// DELETE /api/parametres/:id - Supprimer un preset
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier s'il est utilisé par des coulées
    const [used] = await pool.query(`SELECT COUNT(*) as count FROM coulees WHERE parametre_id = ?`, [id]);
    if (used[0].count > 0) {
      return res.status(409).json({ 
        error: `Ce preset est utilisé par ${used[0].count} coulée(s). Dissociez-les d'abord.` 
      });
    }

    await pool.query(`DELETE FROM parametres_production WHERE id = ?`, [id]);
    res.json({ message: 'Preset supprimé avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /parametres/:id:', error);
    res.status(500).json({ error: 'Erreur suppression preset' });
  }
});

// ============================================
// POST /api/parametres/:id/dupliquer - Dupliquer un preset
// ============================================
router.post('/:id/dupliquer', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;

    // Récupérer le preset source
    const [source] = await conn.query(`SELECT * FROM parametres_production WHERE id = ?`, [id]);
    if (source.length === 0) {
      return res.status(404).json({ error: 'Preset source non trouvé' });
    }

    // Générer le prochain numéro basé sur le diamètre du preset source
    const s = source[0];
    let nextNum;
    if (s.diametre_pouce) {
      const prefix = `PAR-${s.diametre_pouce}-`;
      const [last] = await conn.query(
        `SELECT numero FROM parametres_production WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`,
        [`${prefix}%`]
      );
      let seq = 1;
      if (last.length > 0) {
        const match = last[0].numero.match(/PAR-\d+-?(\d+)$/);
        if (match) seq = parseInt(match[1], 10) + 1;
      }
      nextNum = `${prefix}${seq}`;
    } else {
      const [last] = await conn.query(
        `SELECT numero FROM parametres_production WHERE numero REGEXP '^PAR-[0-9]{3}$' ORDER BY id DESC LIMIT 1`
      );
      let num = 1;
      if (last.length > 0) {
        num = parseInt(last[0].numero.replace('PAR-', ''), 10) + 1;
      }
      nextNum = `PAR-${String(num).padStart(3, '0')}`;
    }

    const created_by = req.user?.operateurId || req.user?.userId || null;

    const [result] = await conn.query(`
      INSERT INTO parametres_production (
        numero, diametre_pouce, strip_vitesse_m, strip_vitesse_cm,
        milling_edge_gauche, milling_edge_droit,
        pression_rouleaux, pression_rouleaux_unite,
        tack_amperage, tack_voltage, tack_vitesse_m, tack_vitesse_cm,
        tack_frequence, tack_type_gaz, tack_debit_gaz,
        soudure_vitesse_m, soudure_vitesse_cm,
        soudure_type_fil, soudure_type_flux,
        notes, created_by, createur_nom, createur_prenom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nextNum, s.diametre_pouce || null, s.strip_vitesse_m, s.strip_vitesse_cm,
      s.milling_edge_gauche, s.milling_edge_droit,
      s.pression_rouleaux, s.pression_rouleaux_unite,
      s.tack_amperage, s.tack_voltage, s.tack_vitesse_m, s.tack_vitesse_cm,
      s.tack_frequence, s.tack_type_gaz, s.tack_debit_gaz,
      s.soudure_vitesse_m, s.soudure_vitesse_cm,
      s.soudure_type_fil, s.soudure_type_flux,
      `Copie de ${s.numero}${s.notes ? ' - ' + s.notes : ''}`,
      created_by, req.user?.nom || null, req.user?.prenom || null
    ]);

    const newId = result.insertId;

    // Dupliquer les heads
    const [heads] = await conn.query(`SELECT * FROM parametres_soudure_heads WHERE parametre_id = ?`, [id]);
    for (const h of heads) {
      await conn.query(`
        INSERT INTO parametres_soudure_heads (parametre_id, type, numero, actif, amperage, voltage)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [newId, h.type, h.numero, h.actif, h.amperage, h.voltage]);
    }

    await conn.commit();

    const [newPreset] = await pool.query(`SELECT * FROM parametres_production WHERE id = ?`, [newId]);
    const [newHeads] = await pool.query(`SELECT * FROM parametres_soudure_heads WHERE parametre_id = ? ORDER BY type, numero`, [newId]);
    newPreset[0].heads = newHeads;

    res.status(201).json(newPreset[0]);
  } catch (error) {
    await conn.rollback();
    console.error('Erreur duplication:', error);
    res.status(500).json({ error: 'Erreur duplication preset' });
  } finally {
    conn.release();
  }
});

module.exports = router;
