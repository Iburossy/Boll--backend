const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const superadminRoutes = require('./superadmin.routes');
const authMiddleware = require('../middlewares/auth.middleware');

// Route de santé (health check)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth-service' });
});

// Routes publiques
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login-anonymous', authController.loginAnonymous);
router.post('/verify-token', authController.verifyToken);
router.post('/verify-account', authController.verifyAccount);
router.post('/resend-verification-codes', authController.resendVerificationCodes);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Routes protégées
router.use(authMiddleware.verifyToken);
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.post('/logout', authController.logout);

// Routes admin
router.post('/admin/create-agent', authMiddleware.checkRole(['admin']), authController.createServiceAgent);

// Routes superadmin
router.use('/superadmin', superadminRoutes);

module.exports = router;
