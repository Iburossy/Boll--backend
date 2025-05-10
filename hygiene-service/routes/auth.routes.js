const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

/**
 * Routes pour l'authentification des agents du service d'hygiène
 */

// Routes publiques
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password/:resetToken', authController.resetPassword);

// Routes protégées (nécessitent un token JWT)
router.use(authMiddleware.verifyToken);

// Routes pour tous les agents authentifiés
router.get('/me', authController.getMe);
router.put('/me', authController.updateMe);
router.put('/change-password', authController.changePassword);

// Routes réservées aux administrateurs
router.use('/users', roleMiddleware.isAdmin);
router.post('/register', authController.register);
router.get('/users', authController.getUsers);
router.get('/users/:userId', authController.getUser);
router.put('/users/:userId', authController.updateUser);
router.put('/users/:userId/reset-password', authController.adminResetPassword);
router.delete('/users/:userId', authController.deleteUser);

module.exports = router;
