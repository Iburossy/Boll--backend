const express = require('express');
const router = express.Router();
const serviceRoutes = require('./service.routes');
const alertTypeRoutes = require('./alert-type.routes');

// Routes pour les services
router.use('/services', serviceRoutes);

// Routes pour les types d'alertes
router.use('/alert-types', alertTypeRoutes);

module.exports = router;
