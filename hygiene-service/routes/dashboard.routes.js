const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const roleMiddleware = require('../middlewares/role.middleware');

/**
 * Routes pour le tableau de bord du service d'hygiène
 */

// Récupérer le résumé global du tableau de bord
router.get('/summary', dashboardController.getSummary);

// Récupérer les statistiques des alertes
router.get('/alerts', dashboardController.getAlertStats);

// Récupérer les statistiques des inspections
router.get('/inspections', dashboardController.getInspectionStats);

// Récupérer les performances des équipes (réservé aux superviseurs)
router.get('/teams', roleMiddleware.isSupervisor, dashboardController.getTeamPerformance);

// Récupérer la carte de chaleur des alertes
router.get('/heatmap', dashboardController.getAlertHeatmap);

// Récupérer les alertes récentes
router.get('/recent-alerts', dashboardController.getRecentAlerts);

// Récupérer les inspections à venir
router.get('/upcoming-inspections', dashboardController.getUpcomingInspections);

// Récupérer les zones à risque élevé
router.get('/high-risk-zones', dashboardController.getHighRiskZones);

// Récupérer les statistiques par période
router.get('/stats/:period', dashboardController.getStatsByPeriod);

module.exports = router;
