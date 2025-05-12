const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Routes pour la gestion des statistiques des services
 */

// Toutes les routes nécessitent une authentification
router.use(authMiddleware.protect);
router.use(authMiddleware.isAdmin);

// Routes pour les statistiques globales
router.get('/global', statsController.getGlobalStats);
router.get('/period/:period', statsController.getStatsByPeriod);
router.get('/services', statsController.getAllServicesStats);

// Routes pour les statistiques d'un service spécifique
router.route('/services/:id')
  .get(statsController.getServiceStats)
  .put(statsController.updateServiceStats);

// Routes pour ajouter des statistiques journalières et mensuelles
router.post('/services/:id/daily', statsController.addDailyStat);
router.post('/services/:id/monthly', statsController.addMonthlyStat);

module.exports = router;
