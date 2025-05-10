const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');

// Routes publiques (accessibles sans authentification)
router.get('/public', serviceController.getAllServices);
router.get('/public/:serviceId', serviceController.getServiceById);

// Routes authentifiées (accessibles à tous les utilisateurs authentifiés)
router.get('/', authMiddleware.verifyToken, serviceController.getAllServices);
router.get('/:serviceId', authMiddleware.verifyToken, serviceController.getServiceById);

// Routes protégées (accessibles uniquement aux superadmins)
router.post(
  '/',
  authMiddleware.verifyToken,
  authMiddleware.authorize(['superadmin']),
  validationMiddleware.validateCreateService,
  serviceController.createService
);

router.put(
  '/:serviceId',
  authMiddleware.verifyToken,
  authMiddleware.authorize(['superadmin']),
  validationMiddleware.validateUpdateService,
  serviceController.updateService
);

router.delete(
  '/:serviceId',
  authMiddleware.verifyToken,
  authMiddleware.authorize(['superadmin']),
  serviceController.deleteService
);

module.exports = router;
