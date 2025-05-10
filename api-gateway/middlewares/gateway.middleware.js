const jwt = require('jsonwebtoken');
const axios = require('axios');

/**
 * Middleware pour l'API Gateway
 */
class GatewayMiddleware {
  /**
   * Vérifie le token et ajoute les informations utilisateur aux en-têtes
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   * @param {Function} next - Fonction pour passer au middleware suivant
   */
  async verifyTokenAndAddUserInfo(req, res, next) {
    try {
      // Récupérer le token du header Authorization
      const authHeader = req.headers.authorization;
      
      // Si pas de token, continuer (certaines routes ne nécessitent pas d'authentification)
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }
      
      // Extraire le token
      const token = authHeader.split(' ')[1];
      
      try {
        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Ajouter les informations de l'utilisateur à la requête
        req.user = decoded;
        
        // Ajouter les informations utilisateur aux en-têtes pour les microservices
        req.headers['x-user-id'] = decoded.sub;
        req.headers['x-user-role'] = decoded.role;
        if (decoded.service) {
          req.headers['x-user-service'] = decoded.service;
        }
      } catch (error) {
        // Ne pas bloquer la requête si le token est invalide
        // Certaines routes peuvent être accessibles sans authentification
        console.warn('Token invalide ou expiré:', error.message);
      }
      
      next();
    } catch (error) {
      console.error('Erreur dans le middleware gateway:', error);
      next(error);
    }
  }

  /**
   * Vérifie si l'utilisateur est authentifié pour les routes protégées
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   * @param {Function} next - Fonction pour passer au middleware suivant
   */
  requireAuth(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise pour accéder à cette ressource'
      });
    }
    next();
  }

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   * @param {string[]} roles - Les rôles autorisés
   * @returns {Function} Middleware pour vérifier le rôle
   */
  checkRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentification requise pour accéder à cette ressource'
        });
      }
      
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Accès interdit. Rôle insuffisant'
        });
      }
      
      next();
    };
  }

  /**
   * Vérifie l'état du service d'authentification
   * @returns {Function} Middleware pour vérifier l'état du service
   */
  checkAuthServiceHealth() {
    return async (req, res, next) => {
      try {
        const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
        
        // Tenter de contacter le service d'authentification
        await axios.get(`${authServiceUrl}/health`);
        
        next();
      } catch (error) {
        console.error('Service d\'authentification indisponible:', error.message);
        res.status(503).json({
          success: false,
          message: 'Service d\'authentification temporairement indisponible'
        });
      }
    };
  }
}

module.exports = new GatewayMiddleware();
