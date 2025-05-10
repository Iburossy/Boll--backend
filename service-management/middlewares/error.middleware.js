const ApiError = require('../utils/api-error');
const config = require('../config/config');

/**
 * Gestionnaire d'erreurs pour les erreurs 404 (routes non trouvées)
 */
const notFound = (req, res, next) => {
  const error = new ApiError(404, `Route non trouvée - ${req.originalUrl}`);
  next(error);
};

/**
 * Gestionnaire d'erreurs global
 */
const errorHandler = (err, req, res, next) => {
  console.error('ERREUR:', err);
  
  // Définir le code de statut
  const statusCode = err.statusCode || 500;
  
  // Préparer la réponse
  const response = {
    success: false,
    message: err.message || 'Erreur interne du serveur',
    stack: config.NODE_ENV === 'development' ? err.stack : undefined
  };
  
  // Envoyer la réponse
  res.status(statusCode).json(response);
};

module.exports = {
  notFound,
  errorHandler
};
