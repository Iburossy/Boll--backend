const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const roleMiddleware = require('../middlewares/role.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');

/**
 * Routes pour la gestion des zones à risque
 */

// Créer une nouvelle zone (réservé aux superviseurs)
router.post('/', 
  roleMiddleware.isSupervisor, 
  validationMiddleware.validateZone, 
  zoneController.createZone
);

// Récupérer toutes les zones
router.get('/', zoneController.getZones);

// Récupérer les hotspots (zones à forte densité d'alertes)
router.get('/hotspots', zoneController.getHotspots);

// Récupérer une zone par ID
router.get('/:zoneId', zoneController.getZoneDetails);

// Mettre à jour une zone (réservé aux superviseurs)
router.put('/:zoneId', 
  roleMiddleware.isSupervisor, 
  validationMiddleware.validateZone, 
  zoneController.updateZone
);

// Assigner une zone à une équipe (réservé aux superviseurs)
router.post('/:zoneId/assign', 
  roleMiddleware.isSupervisor, 
  zoneController.assignZoneToTeam
);

// Récupérer les alertes dans une zone
router.get('/:zoneId/alerts', zoneController.getZoneAlerts);

// Récupérer les inspections dans une zone
router.get('/:zoneId/inspections', zoneController.getZoneInspections);

// Récupérer les statistiques des zones
router.get('/statistics', zoneController.getZoneStatistics);

module.exports = router;
