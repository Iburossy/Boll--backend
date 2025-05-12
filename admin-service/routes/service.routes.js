const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Routes pour la gestion des services partenaires
 */

// Route publique pour obtenir les services actifs et disponibles (pour les citoyens)
router.get('/public', serviceController.getPublicServices);

// Routes protégées (nécessitent une authentification)
router.use(authMiddleware.protect);
router.use(authMiddleware.isAdmin);

// Routes pour la gestion des services
router.route('/')
  .get(serviceController.getAllServices)
  .post(serviceController.registerService);

router.route('/:id')
  .get(serviceController.getServiceById)
  .put(serviceController.updateService)
  .delete(authMiddleware.isSuperAdmin, serviceController.deleteService);

// Routes pour la gestion de la disponibilité et de l'activation
router.post('/:id/check-availability', serviceController.checkServiceAvailability);
router.patch('/:id/toggle-active', serviceController.toggleServiceActive);

module.exports = router;
