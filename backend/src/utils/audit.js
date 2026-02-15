/**
 * Utilitaire Audit Trail - LogiTrack
 * Enregistre toutes les actions critiques pour la traçabilité API 5L
 */

const pool = require('../config/database');

/**
 * Enregistrer une action dans l'audit trail
 * @param {Object} options
 * @param {string} options.action - Type d'action (CREATE, UPDATE, DELETE, VALIDATE, CERTIFY, LOGIN...)
 * @param {string} options.entite - Type d'entité (tube, bobine, coulee, checklist, user...)
 * @param {string|number} options.entiteId - ID de l'entité
 * @param {Object} options.req - Express request (pour extraire user + IP)
 * @param {Object} [options.details] - Détails du changement
 */
async function logAudit({ action, entite, entiteId, req, details = null }) {
  try {
    const userId = req?.user?.userId || null;
    const operateurId = req?.user?.operateurId || null;
    const userName = req?.user ? 
      `${req.user.prenom || ''} ${req.user.nom || req.user.username || ''}`.trim() : 
      'Système';
    const ip = req?.ip || req?.connection?.remoteAddress || null;

    await pool.query(
      `INSERT INTO audit_trail (action, entite, entite_id, user_id, operateur_id, user_name, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [action, entite, String(entiteId || ''), userId, operateurId, userName, 
       details ? JSON.stringify(details) : null, ip]
    );
  } catch (error) {
    // Ne jamais faire crasher l'app à cause de l'audit
    console.error('⚠️ Erreur audit trail:', error.message);
  }
}

module.exports = { logAudit };
