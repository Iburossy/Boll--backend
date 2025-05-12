const express = require('express');
const router = express.Router();
const externalAlertController = require('../controllers/externalAlertController');
const apiKeyMiddleware = require('../middlewares/apiKey.middleware');

/**
 * Routes pour les interactions avec les services externes
 * Ces routes sont protégées par une authentification par clé API
 */

// Middleware pour vérifier la clé API pour toutes les routes externes
router.use(apiKeyMiddleware.verifyApiKey);

// Recevoir une alerte du service citoyen
router.post('/alerts', externalAlertController.receiveExternalAlert);

// Recevoir un commentaire sur une alerte
router.post('/alerts/:alertId/comments', externalAlertController.receiveExternalComment);

module.exports = router;
