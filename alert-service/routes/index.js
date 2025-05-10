const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Routes publiques
router.get('/public', alertController.getPublicAlerts);
router.get('/hotspots', alertController.getHotspots);

// Routes protégées par authentification
router.use(authMiddleware.verifyToken);

// Routes pour les citoyens
router.post('/', upload.array('media', 5), alertController.createAlert);
router.get('/user/:userId', alertController.getUserAlerts);
router.get('/:alertId', alertController.getAlertById);
router.put('/:alertId', alertController.updateAlert);
router.delete('/:alertId', alertController.deleteAlert);
router.post('/:alertId/upvote', alertController.upvoteAlert);
router.post('/:alertId/feedback', alertController.addFeedback);

// Routes pour les services (police, hygiène, etc.)
router.use('/service', authMiddleware.verifyServiceAccess);
router.get('/service/:serviceType', alertController.getServiceAlerts);
router.put('/service/:alertId/status', alertController.updateAlertStatus);
router.put('/service/:alertId/assign', alertController.assignAlert);
router.post('/service/:alertId/feedback', alertController.addServiceFeedback);

module.exports = router;
