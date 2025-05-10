const express = require('express');
const router = express.Router();
const inspectionController = require('../controllers/inspectionController');
const roleMiddleware = require('../middlewares/role.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration de Multer pour l'upload des photos d'inspection
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/inspections');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'inspection-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

/**
 * Routes pour la gestion des inspections
 */

// Créer une nouvelle inspection (réservé aux superviseurs)
router.post('/', 
  roleMiddleware.isSupervisor, 
  validationMiddleware.validateInspection, 
  inspectionController.createInspection
);

// Récupérer toutes les inspections
router.get('/', inspectionController.getInspections);

// Récupérer une inspection par ID
router.get('/:inspectionId', inspectionController.getInspectionDetails);

// Mettre à jour une inspection
router.put('/:inspectionId', 
  validationMiddleware.validateInspection, 
  inspectionController.updateInspection
);

// Marquer une inspection comme terminée (réservé aux inspecteurs)
router.post('/:inspectionId/complete', 
  roleMiddleware.isInspector, 
  inspectionController.completeInspection
);

// Ajouter des photos à une inspection (réservé aux inspecteurs)
router.post('/:inspectionId/photos', 
  roleMiddleware.isInspector, 
  upload.array('photos', 10), 
  inspectionController.addInspectionPhotos
);

// Planifier un suivi pour une inspection
router.post('/:inspectionId/follow-up', 
  inspectionController.scheduleFollowUp
);

// Récupérer les statistiques des inspections
router.get('/statistics', inspectionController.getInspectionStatistics);

module.exports = router;
