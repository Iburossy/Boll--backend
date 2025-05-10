const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const roleMiddleware = require('../middlewares/role.middleware');

/**
 * Routes pour la gestion des alertes d'hygiène
 */

// Récupérer toutes les alertes d'hygiène
router.get('/', alertController.getHygieneAlerts);

// Récupérer une alerte par ID
router.get('/:alertId', alertController.getAlertDetails);

// Mettre à jour le statut d'une alerte
router.put('/:alertId/status', alertController.updateAlertStatus);

// Assigner une alerte à une équipe (réservé aux superviseurs)
router.post('/:alertId/assign', roleMiddleware.isSupervisor, alertController.assignAlertToTeam);

// Ajouter un feedback à une alerte
router.post('/:alertId/feedback', alertController.addFeedback);

// Récupérer les statistiques des alertes
router.get('/statistics', alertController.getAlertStatistics);

module.exports = router;
