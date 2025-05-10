const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const config = require('./config/config');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

// Création de l'application Express
const app = express();

// Connexion à MongoDB
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    console.log('Connexion à MongoDB établie avec succès');
  })
  .catch((err) => {
    console.error('Erreur de connexion à MongoDB:', err);
    process.exit(1);
  });

// Middlewares
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true
}));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging en développement
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes'
});
app.use('/api', limiter);

// Routes
app.use('/', routes);

// Route de base pour vérifier que le service fonctionne
app.get('/health', (req, res) => {
  res.json({
    message: 'Service de gestion des services publics - Bollé',
    version: '1.0.0',
    status: 'running'
  });
});

// Middleware pour les routes non trouvées
app.use(notFound);

// Middleware de gestion des erreurs
app.use(errorHandler);

// Démarrage du serveur
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`Service de gestion des services publics démarré sur le port ${PORT} en mode ${config.NODE_ENV}`);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err) => {
  console.error('ERREUR NON GÉRÉE:', err);
  // Ne pas arrêter le serveur en production
  if (config.NODE_ENV === 'development') {
    process.exit(1);
  }
});

module.exports = app;
