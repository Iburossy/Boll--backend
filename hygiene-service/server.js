require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const errorHandler = require('./utils/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3008;

// Middleware de base
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de journalisation
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bolle-hygiene', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => logger.info('Connecté à MongoDB'))
.catch(err => logger.error('Erreur de connexion à MongoDB:', err));

// Routes
app.use('/', routes);

// Route de base pour vérifier l'état du service
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'hygiene-service',
    timestamp: new Date().toISOString()
  });
});

// Middleware de gestion des erreurs
app.use(errorHandler);

// Démarrage du serveur
app.listen(PORT, () => {
  logger.info(`Service d'hygiène en cours d'exécution sur le port ${PORT} en mode ${process.env.NODE_ENV || 'development'}`);
});
