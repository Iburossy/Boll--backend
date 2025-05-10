const logger = require('./logger');

/**
 * Middleware de gestion centralisée des erreurs
 */
const errorHandler = (err, req, res, next) => {
  // Log de l'erreur
  logger.error(`${err.name}: ${err.message}\n${err.stack}`);
  
  // Détermination du code d'état HTTP
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Gestion des erreurs spécifiques de Mongoose
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Ressource non trouvée';
  }
  
  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }
  
  // Erreur de duplication (unique constraint)
  if (err.code === 11000) {
    statusCode = 400;
    message = `Valeur en doublon pour le champ ${Object.keys(err.keyValue).join(', ')}`;
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token non valide';
  }

  // Erreur d'expiration JWT
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expiré';
  }

  // Réponse au client
  res.status(statusCode).json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;
