const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Routes pour l'authentification des administrateurs
 */

// Routes publiques
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Routes protégées
router.use(authMiddleware.protect);

router.get('/me', authController.getMe);
router.put('/me', authController.updateMe);
router.put('/change-password', authController.changePassword);
router.post('/logout', authController.logout);

// Routes réservées aux superadmins
router.post('/register', authMiddleware.isSuperAdmin, authController.register);

module.exports = router;
