require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3009;

// Middleware de sécurité et de base
app.use(helmet()); // Sécurité
app.use(cors()); // Gestion des CORS
app.use(morgan('combined')); // Logging HTTP
app.use(express.json()); // Parsing du JSON
app.use(express.urlencoded({ extended: true })); // Parsing des URL encodées

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes par défaut
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limite chaque IP à 100 requêtes par fenêtre par défaut
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Connexion à la base de données MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('Connecté à MongoDB');
})
.catch((err) => {
  logger.error(`Erreur de connexion à MongoDB: ${err.message}`);
  process.exit(1);
});

// Routes de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Service d\'administration Bollé',
    version: '1.0.0',
    status: 'online'
  });
});

// Route pour vérifier l'état du service
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'admin-service',
    timestamp: new Date().toISOString()
  });
});

// Importation des routes
const authRoutes = require('./routes/auth.routes');
const serviceRoutes = require('./routes/service.routes');
const statsRoutes = require('./routes/stats.routes');

// Utilisation des routes
app.use('/auth', authRoutes);
app.use('/services', serviceRoutes);
app.use('/stats', statsRoutes);

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  logger.error(`${err.stack}`);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  logger.info(`Service d'administration en cours d'exécution sur le port ${PORT} en mode ${process.env.NODE_ENV}`);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err) => {
  logger.error(`Erreur non gérée: ${err.message}`);
  // Fermeture propre du serveur
  process.exit(1);
});

module.exports = app; // Pour les tests
