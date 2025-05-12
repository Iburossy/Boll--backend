const winston = require('winston');
const config = require('../config/env');

// Format personnalisé pour les logs
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Configuration du logger
const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    logFormat
  ),
  transports: [
    // Logs dans la console
    new winston.transports.Console(),
    // Logs dans les fichiers
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
  // Ne pas quitter en cas d'erreur non gérée
  exitOnError: false
});

// Création du dossier logs s'il n'existe pas
const fs = require('fs');
const path = require('path');
const logDir = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

module.exports = logger;
