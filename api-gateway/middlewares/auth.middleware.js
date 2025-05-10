const jwt = require('jsonwebtoken');

/**
 * Middleware pour vérifier l'authentification via JWT
 */
class AuthMiddleware {
  /**
   * Vérifie si le token JWT est valide
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   * @param {Function} next - Fonction pour passer au middleware suivant
   */
  verifyToken(req, res, next) {
    try {
      // Récupérer le token du header Authorization
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Accès non autorisé. Token manquant'
        });
      }
      
      // Extraire le token
      const token = authHeader.split(' ')[1];
      
      // Vérifier le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Ajouter les informations de l'utilisateur à la requête
      req.user = decoded;
      
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Accès non autorisé. Token invalide'
      });
    }
  }

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   * @param {string[]} roles - Les rôles autorisés
   * @returns {Function} Middleware pour vérifier le rôle
   */
  checkRole(roles) {
    return (req, res, next) => {
      try {
        // Vérifier si l'utilisateur a été authentifié
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Accès non autorisé. Utilisateur non authentifié'
          });
        }
        
        // Vérifier si l'utilisateur a le rôle requis
        if (!roles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: 'Accès interdit. Rôle insuffisant'
          });
        }
        
        next();
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la vérification du rôle'
        });
      }
    };
  }

  /**
   * Vérifie si l'utilisateur est un administrateur
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   * @param {Function} next - Fonction pour passer au middleware suivant
   */
  isAdmin(req, res, next) {
    return this.checkRole(['admin', 'superadmin'])(req, res, next);
  }

  /**
   * Vérifie si l'utilisateur est un agent de service
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   * @param {Function} next - Fonction pour passer au middleware suivant
   */
  isServiceAgent(req, res, next) {
    return this.checkRole(['agent', 'admin', 'superadmin'])(req, res, next);
  }

  /**
   * Vérifie si l'utilisateur a accès à un service spécifique
   * @param {string} serviceType - Le type de service requis
   * @returns {Function} Middleware pour vérifier l'accès au service
   */
  hasServiceAccess(serviceType) {
    return (req, res, next) => {
      try {
        // Vérifier si l'utilisateur a été authentifié
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Accès non autorisé. Utilisateur non authentifié'
          });
        }
        
        // Les administrateurs ont accès à tous les services
        if (['admin', 'superadmin'].includes(req.user.role)) {
          return next();
        }
        
        // Vérifier si l'agent a accès au service spécifié
        if (req.user.role === 'agent' && req.user.service === serviceType) {
          return next();
        }
        
        res.status(403).json({
          success: false,
          message: 'Accès interdit. Service non autorisé'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la vérification de l\'accès au service'
        });
      }
    };
  }
}

module.exports = new AuthMiddleware();
