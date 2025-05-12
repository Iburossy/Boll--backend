const logger = require('../utils/logger');

/**
 * Middleware pour vérifier la clé API des services externes
 */
exports.verifyApiKey = (req, res, next) => {
  try {
    // Récupérer la clé API de l'en-tête de la requête
    const apiKey = req.headers['x-service-key'];
    
    // Vérifier si la clé API est présente
    if (!apiKey) {
      logger.warn('Tentative d\'accès à une route externe sans clé API');
      return res.status(401).json({
        success: false,
        message: 'Clé API requise'
      });
    }
    
    // Vérifier si la clé API est valide
    const validApiKey = process.env.SERVICE_API_KEY;
    
    if (!validApiKey || apiKey !== validApiKey) {
      logger.warn(`Tentative d'accès avec une clé API invalide: ${apiKey}`);
      return res.status(403).json({
        success: false,
        message: 'Clé API invalide'
      });
    }
    
    // Si la clé API est valide, passer à la suite
    logger.info('Accès externe autorisé avec clé API valide');
    next();
  } catch (error) {
    logger.error(`Erreur lors de la vérification de la clé API: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de la clé API'
    });
  }
};
