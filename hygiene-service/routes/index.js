const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

// Importer les routes spécifiques
const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const alertRoutes = require('./alert.routes');
const inspectionRoutes = require('./inspection.routes');
const zoneRoutes = require('./zone.routes');
const teamRoutes = require('./team.routes');
const reportRoutes = require('./report.routes');
const externalRoutes = require('./external.routes');

// Route de base pour vérifier l'état du service
router.get('/', (req, res) => {
  res.json({ 
    message: 'Service d\'hygiène de Bollé',
    version: '1.0.0',
    status: 'online'
  });
});

// Routes d'authentification (certaines sont publiques, d'autres protégées)
router.use('/auth', authRoutes);

// Appliquer le middleware d'authentification à toutes les autres routes
router.use('/dashboard', authMiddleware.verifyToken, authMiddleware.isHygieneService, dashboardRoutes);
router.use('/alerts', authMiddleware.verifyToken, authMiddleware.isHygieneService, alertRoutes);
router.use('/inspections', authMiddleware.verifyToken, authMiddleware.isHygieneService, inspectionRoutes);
router.use('/zones', authMiddleware.verifyToken, authMiddleware.isHygieneService, zoneRoutes);
router.use('/teams', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamRoutes);
router.use('/reports', authMiddleware.verifyToken, authMiddleware.isHygieneService, reportRoutes);

// Routes pour les API externes (service citoyen)
router.use('/api/external', externalRoutes);

module.exports = router;
