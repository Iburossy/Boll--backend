const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Alert = require('../models/alert');
const Zone = require('../models/zone');

/**
 * Contrôleur pour la gestion des alertes provenant de services externes (comme le service citoyen)
 */

/**
 * Recevoir une alerte du service citoyen
 * @route POST /api/external/alerts
 * @access Privé (authentification par clé API)
 */
exports.receiveExternalAlert = async (req, res, next) => {
  try {
    const { alertId, category, description, location, proofs, isAnonymous, citizenId, createdAt } = req.body;
    
    logger.info(`Réception d'une alerte externe: ${alertId}`);
    
    // Vérifier que les données nécessaires sont présentes
    if (!description || !location || !location.coordinates || !proofs || proofs.length === 0) {
      logger.warn(`Données d'alerte externes incomplètes: ${JSON.stringify(req.body)}`);
      return res.status(400).json({
        success: false,
        message: 'Données d\'alerte incomplètes',
        serviceReferenceId: null
      });
    }
    
    try {
      // Vérifier si l'alerte existe déjà (pour éviter les doublons)
      const existingAlert = await Alert.findOne({ 
        'externalReferences.serviceId': 'citoyen-service',
        'externalReferences.alertId': alertId
      });
      
      if (existingAlert) {
        logger.info(`Alerte externe déjà enregistrée: ${alertId} -> ${existingAlert._id}`);
        return res.status(200).json({
          success: true,
          message: 'Alerte déjà enregistrée',
          serviceReferenceId: existingAlert._id
        });
      }
      
      // Créer une nouvelle alerte dans notre système
      const newAlert = new Alert({
        title: `Alerte d'hygiène - ${category || 'Générale'}`,
        description: description,
        status: 'new',
        priority: determinePriority(description, category),
        location: {
          type: location.type || 'Point',
          coordinates: location.coordinates,
          address: location.address
        },
        createdBy: isAnonymous ? 'Citoyen anonyme' : `Citoyen ${citizenId}`,
        createdAt: createdAt || new Date(),
        category: 'hygiene',
        attachments: convertProofsToAttachments(proofs),
        externalReferences: [{
          serviceId: 'citoyen-service',
          alertId: alertId,
          citizenId: isAnonymous ? null : citizenId
        }]
      });
      
      // Sauvegarder l'alerte
      await newAlert.save();
      
      // Vérifier si l'alerte est dans une zone connue et mettre à jour le compteur de la zone
      updateZoneAlertCount(newAlert.location.coordinates);
      
      logger.info(`Alerte externe enregistrée avec succès: ${alertId} -> ${newAlert._id}`);
      
      res.status(201).json({
        success: true,
        message: 'Alerte enregistrée avec succès',
        serviceReferenceId: newAlert._id
      });
    } catch (error) {
      logger.error(`Erreur lors de l'enregistrement de l'alerte externe: ${error.message}`);
      res.status(500).json({
        success: false,
        message: `Erreur lors de l'enregistrement de l'alerte: ${error.message}`,
        serviceReferenceId: null
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Recevoir un commentaire sur une alerte externe
 * @route POST /api/external/alerts/:alertId/comments
 * @access Privé (authentification par clé API)
 */
exports.receiveExternalComment = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { text, authorType, citizenId } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Le texte du commentaire est requis'
      });
    }
    
    try {
      // Trouver l'alerte correspondante
      const alert = await Alert.findOne({
        'externalReferences.serviceId': 'citoyen-service',
        'externalReferences.alertId': alertId
      });
      
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alerte non trouvée'
        });
      }
      
      // Ajouter le commentaire
      const authorName = authorType === 'citizen' 
        ? (citizenId ? `Citoyen ${citizenId}` : 'Citoyen anonyme')
        : 'Service Citoyen';
      
      alert.comments.push({
        author: authorName,
        text: text,
        createdAt: new Date()
      });
      
      await alert.save();
      
      logger.info(`Commentaire externe ajouté à l'alerte: ${alertId}`);
      
      res.status(200).json({
        success: true,
        message: 'Commentaire ajouté avec succès'
      });
    } catch (error) {
      logger.error(`Erreur lors de l'ajout du commentaire externe: ${error.message}`);
      res.status(500).json({
        success: false,
        message: `Erreur lors de l'ajout du commentaire: ${error.message}`
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Déterminer la priorité d'une alerte en fonction de sa description et de sa catégorie
 * @param {string} description - Description de l'alerte
 * @param {string} category - Catégorie de l'alerte
 * @returns {string} Priorité de l'alerte
 */
function determinePriority(description, category) {
  // Mots-clés indiquant une priorité élevée
  const highPriorityKeywords = [
    'urgent', 'dangereux', 'danger', 'toxique', 'maladie', 'infection',
    'contamination', 'insalubre', 'insalubrité', 'rats', 'rongeurs', 'nuisible'
  ];
  
  // Mots-clés indiquant une priorité critique
  const criticalPriorityKeywords = [
    'épidémie', 'épidémique', 'mortel', 'décès', 'mort', 'hospitalisation',
    'empoisonnement', 'intoxication'
  ];
  
  const lowerDescription = description.toLowerCase();
  
  // Vérifier les mots-clés critiques
  for (const keyword of criticalPriorityKeywords) {
    if (lowerDescription.includes(keyword)) {
      return 'critical';
    }
  }
  
  // Vérifier les mots-clés de priorité élevée
  for (const keyword of highPriorityKeywords) {
    if (lowerDescription.includes(keyword)) {
      return 'high';
    }
  }
  
  // Par défaut, priorité moyenne
  return 'medium';
}

/**
 * Convertir les preuves du format du service citoyen au format du service d'hygiène
 * @param {Array} proofs - Preuves au format du service citoyen
 * @returns {Array} Pièces jointes au format du service d'hygiène
 */
function convertProofsToAttachments(proofs) {
  if (!Array.isArray(proofs) || proofs.length === 0) {
    return [];
  }
  
  return proofs.map(proof => {
    // Extraire le nom de fichier de l'URL
    const urlParts = proof.url.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    return {
      filename: filename,
      path: proof.url,
      mimetype: getMimeTypeFromProofType(proof.type),
      size: proof.size || 0,
      uploadedAt: new Date()
    };
  });
}

/**
 * Obtenir le type MIME à partir du type de preuve
 * @param {string} proofType - Type de preuve (photo, video, audio)
 * @returns {string} Type MIME correspondant
 */
function getMimeTypeFromProofType(proofType) {
  switch (proofType) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Mettre à jour le compteur d'alertes d'une zone
 * @param {Array} coordinates - Coordonnées [longitude, latitude]
 */
async function updateZoneAlertCount(coordinates) {
  try {
    // Trouver la zone qui contient ces coordonnées
    const zone = await Zone.findOne({
      geometry: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          }
        }
      }
    });
    
    if (zone) {
      // Incrémenter le compteur d'alertes de la zone
      zone.alertCount = (zone.alertCount || 0) + 1;
      zone.lastAlertDate = new Date();
      await zone.save();
      
      logger.info(`Zone ${zone.name} mise à jour avec une nouvelle alerte`);
    }
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour de la zone: ${error.message}`);
    // Ne pas bloquer le processus principal en cas d'erreur
  }
}
