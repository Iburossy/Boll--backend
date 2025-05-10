const winston = require('winston');
const path = require('path');

// Définition des niveaux de log et des couleurs
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Définition des couleurs pour chaque niveau
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Ajout des couleurs à winston
winston.addColors(colors);

// Format de log personnalisé
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`,
  ),
);

// Définition des transports (où les logs seront stockés/affichés)
const transports = [
  // Console pour tous les logs
  new winston.transports.Console(),
  
  // Fichier pour les erreurs
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
  }),
  
  // Fichier pour tous les logs
  new winston.transports.File({ 
    filename: path.join('logs', 'all.log') 
  }),
];

// Création du logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
});

module.exports = logger;
