/**
 * Configuration de l'environnement pour le service d'administration
 */

module.exports = {
  // Environnement
  env: process.env.NODE_ENV || 'development',
  
  // Configuration du serveur
  port: parseInt(process.env.PORT) || 3009,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  
  // Configuration de la base de données
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bolle-admin',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // Configuration JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'admin_secret_key_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'admin_refresh_secret_key_change_in_production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes par défaut
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100 // limite chaque IP à 100 requêtes par fenêtre
  }
};
