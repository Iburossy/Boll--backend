const jwt = require('jsonwebtoken');
const axios = require('axios');
const ApiError = require('../utils/api-error');
const config = require('../config/config');

/**
 * Middleware pour vérifier le token JWT
 */
const verifyToken = async (req, res, next) => {
  try {
    // Vérifier si les en-têtes de l'API Gateway sont présents
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    const userService = req.headers['x-user-service'];
    
    // Si les en-têtes de l'API Gateway sont présents, utiliser ces informations
    if (userId && userRole) {
      console.log('[AUTH MIDDLEWARE] verifyToken - Informations utilisateur reçues de l\'API Gateway');
      req.user = {
        sub: userId,
        role: userRole,
        service: userService
      };
      return next();
    }
    
    // Sinon, vérifier le token JWT
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new ApiError(401, 'Accès non autorisé. Token manquant.');
    }
    
    console.log('[AUTH MIDDLEWARE] verifyToken - Token reçu:', token.substring(0, 10) + '...');
    
    // Essayer de vérifier le token localement d'abord
    try {
      console.log('[AUTH MIDDLEWARE] verifyToken - Tentative de vérification locale du token');
      const decoded = jwt.verify(token, config.JWT_SECRET);
      console.log('[AUTH MIDDLEWARE] verifyToken - Token vérifié localement avec succès');
      req.user = decoded;
      return next();
    } catch (jwtError) {
      console.log('[AUTH MIDDLEWARE] verifyToken - Échec de la vérification locale, tentative via le service d\'authentification');
      
      // Si la vérification locale échoue, essayer via le service d'authentification
      try {
        console.log('[AUTH MIDDLEWARE] verifyToken - URL du service d\'authentification:', `${config.AUTH_SERVICE_URL}/api/auth/verify-token`);
        const response = await axios.post(`${config.AUTH_SERVICE_URL}/api/auth/verify-token`, { token });
        console.log('[AUTH MIDDLEWARE] verifyToken - Réponse du service d\'authentification:', response.data);
        
        if (!response.data.success) {
          throw new ApiError(401, 'Token invalide ou expiré');
        }
        
        // Ajouter les informations de l'utilisateur à la requête
        req.user = response.data.data;
        next();
      } catch (error) {
        console.error('[AUTH MIDDLEWARE] verifyToken - Erreur lors de la vérification du token:', error.message);
        throw new ApiError(401, 'Authentification échouée');
      }
    }
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] verifyToken - Erreur globale:', error.message);
    if (error.response) {
      return next(new ApiError(error.response.status, error.response.data.message));
    }
    next(error);
  }
};

/**
 * Middleware pour vérifier les rôles
 * @param {Array} roles - Tableau des rôles autorisés
 */
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Utilisateur non authentifié'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Vous n\'avez pas les permissions nécessaires'));
    }
    
    next();
  };
};

module.exports = {
  verifyToken,
  authorize
};
