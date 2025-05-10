const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Middleware pour vérifier le token JWT
 */
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Token JWT manquant ou format incorrect');
    return res.status(401).json({ error: 'Token JWT manquant ou format incorrect' });
  }
  
  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
    if (err) {
      logger.warn(`Erreur de vérification du token: ${err.message}`);
      return res.status(403).json({ error: 'Token JWT invalide ou expiré' });
    }
    
    // Stocker les informations de l'utilisateur dans la requête
    req.user = decoded;
    next();
  });
};

/**
 * Middleware pour vérifier si l'utilisateur est un agent du service d'hygiène
 */
exports.isHygieneService = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  // Vérifier si l'utilisateur a le rôle 'service' et le type de service 'hygiene'
  if (req.user.role !== 'service' || req.user.serviceType !== 'hygiene') {
    logger.warn(`Accès non autorisé: ${req.user.id} (${req.user.role}) a tenté d'accéder à une route du service d'hygiène`);
    return res.status(403).json({ error: 'Accès réservé au service d\'hygiène' });
  }
  
  next();
};
