const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'logitrack_api5l_secret_key_change_in_production_2026';

/**
 * Middleware pour vérifier le token JWT
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Token d\'authentification requis',
      code: 'TOKEN_REQUIRED'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Session expirée, veuillez vous reconnecter',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(403).json({ 
        error: 'Token invalide',
        code: 'TOKEN_INVALID'
      });
    }

    req.user = decoded;
    // Ajouter type et id normalisés pour faciliter l'usage
    if (decoded.userId) {
      req.user.type = 'admin';
      req.user.id = decoded.userId;
    } else if (decoded.operateurId) {
      req.user.type = 'operateur';
      req.user.id = decoded.operateurId;
    }
    next();
  });
};

/**
 * Middleware pour vérifier le rôle
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Accès non autorisé pour ce rôle',
        code: 'FORBIDDEN'
      });
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier l'accès admin uniquement
 */
const requireAdmin = requireRole('admin');

/**
 * Signer un token JWT (encapsule le secret)
 */
const signToken = (payload, options = {}) => {
  return jwt.sign(payload, JWT_SECRET, options);
};

module.exports = { 
  authenticateToken, 
  requireRole,
  requireAdmin,
  signToken
};
