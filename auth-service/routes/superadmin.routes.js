const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadmin.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Middleware pour vérifier que l'utilisateur est un superadmin
router.use('/', authMiddleware.verifyToken, (req, res, next) => {
  // Vérifier si l'utilisateur est un superadmin
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Accès interdit. Vous devez être superadmin.'
    });
  }
});

// Routes pour la gestion des utilisateurs
router.get('/users', superadminController.getAllUsers);
router.get('/users/role/:role', superadminController.getUsersByRole);
router.post('/admin', superadminController.createAdmin);
router.post('/agent', superadminController.createAgent);
router.put('/user/:userId', superadminController.updateUser);
router.patch('/user/:userId/disable', superadminController.disableUser);

// Routes pour la vérification d'identité
router.patch('/user/:userId/approve-identity', superadminController.approveIdentityVerification);
router.patch('/user/:userId/reject-identity', superadminController.rejectIdentityVerification);

module.exports = router;
