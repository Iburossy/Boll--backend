const express = require('express');
const router = express.Router();
const alertTypeController = require('../controllers/alert-type.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Routes publiques (accessibles sans authentification)
router.get('/public', alertTypeController.getAllAlertTypes);
router.get('/public/:alertTypeId', alertTypeController.getAlertTypeById);

// Routes authentifiées (accessibles à tous les utilisateurs authentifiés)
router.get('/', authMiddleware.verifyToken, alertTypeController.getAllAlertTypes);
router.get('/:alertTypeId', authMiddleware.verifyToken, alertTypeController.getAlertTypeById);

// Routes protégées (accessibles uniquement aux superadmins et admins)
router.post(
  '/',
  authMiddleware.verifyToken,
  authMiddleware.authorize(['superadmin', 'admin']),
  alertTypeController.createAlertType
);

router.put(
  '/:alertTypeId',
  authMiddleware.verifyToken,
  authMiddleware.authorize(['superadmin', 'admin']),
  alertTypeController.updateAlertType
);

router.delete(
  '/:alertTypeId',
  authMiddleware.verifyToken,
  authMiddleware.authorize(['superadmin', 'admin']),
  alertTypeController.deleteAlertType
);

module.exports = router;
