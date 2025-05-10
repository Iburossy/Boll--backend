// Configuration des variables d'environnement
const dotenv = require('dotenv');
const path = require('path');

// Charge les variables d'environnement du fichier .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  // Configuration du serveur
  PORT: process.env.PORT || 3008,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Configuration de la base de données
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/bolle-hygiene',
  
  // Configuration JWT
  JWT_SECRET: process.env.JWT_SECRET || 'changeme-secret-hygiene-service',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '7d',
  
  // URLs des autres services
  ALERT_SERVICE_URL: process.env.ALERT_SERVICE_URL || 'http://localhost:3002',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  
  // Configuration du stockage de fichiers
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads'
};
