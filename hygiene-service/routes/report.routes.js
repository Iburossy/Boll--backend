const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const roleMiddleware = require('../middlewares/role.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration de Multer pour l'upload des pièces jointes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/reports');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'report-attachment-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

/**
 * Routes pour la gestion des rapports
 */

// Créer un nouveau rapport
router.post('/', reportController.createReport);

// Récupérer tous les rapports
router.get('/', reportController.getReports);

// Récupérer un rapport par ID
router.get('/:reportId', reportController.getReportDetails);

// Mettre à jour un rapport
router.put('/:reportId', reportController.updateReport);

// Publier un rapport (réservé aux superviseurs)
router.post('/:reportId/publish', roleMiddleware.isSupervisor, reportController.publishReport);

// Archiver un rapport (réservé aux superviseurs)
router.post('/:reportId/archive', roleMiddleware.isSupervisor, reportController.archiveReport);

// Ajouter des pièces jointes à un rapport
router.post('/:reportId/attachments', upload.array('attachments', 5), reportController.addAttachments);

// Générer un rapport PDF
router.get('/:reportId/pdf', reportController.generatePdf);

// Générer un rapport Excel
router.get('/:reportId/excel', reportController.generateExcel);

// Télécharger un rapport
router.get('/download/:reportId', reportController.downloadReport);

// Générer un rapport périodique (réservé aux superviseurs)
router.post('/generate/periodic', roleMiddleware.isSupervisor, reportController.generatePeriodicReport);

// Générer un rapport de zone (réservé aux superviseurs)
router.post('/generate/zone/:zoneId', roleMiddleware.isSupervisor, reportController.generateZoneReport);

module.exports = router;
