require('dotenv').config();

module.exports = {
  // Environnement
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Serveur
  PORT: process.env.PORT || 3007,
  
  // Base de données
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/bolle-service-management',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'bolle-service-management-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  
  // Services
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  ALERT_SERVICE_URL: process.env.ALERT_SERVICE_URL || 'http://localhost:3002',
  
  // Cors
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};
