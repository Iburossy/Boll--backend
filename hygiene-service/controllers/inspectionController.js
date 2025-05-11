const mongoose = require('mongoose');
const Inspection = require('../models/inspection');
const Team = require('../models/team');
const Alert = require('../models/alert');
const logger = require('../utils/logger');
const config = require('../config/env');
const path = require('path');
const fs = require('fs');

/**
 * Contrôleur pour la gestion des inspections d'hygiène
 */

/**
 * Créer une nouvelle inspection
 * @route POST /inspections
 * @access Privé (Superviseur)
 */
exports.createInspection = async (req, res, next) => {
  try {
    const { alertId, teamId, scheduledDate, status, findings, violationLevel, recommendations, followUpRequired, followUpDate, location } = req.body;
    
    // Vérifier si l'alerte existe dans notre modèle local
    try {
      const alert = await Alert.findById(alertId);
      
      if (!alert) {
        logger.error(`Alerte ${alertId} non trouvée`);
        return res.status(404).json({ error: 'Alerte non trouvée' });
      }
    } catch (error) {
      logger.error(`Erreur lors de la vérification de l'alerte ${alertId}: ${error.message}`);
      return res.status(404).json({ error: 'Alerte non trouvée' });
    }
    
    // Vérifier si l'équipe existe si un teamId est fourni
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ error: 'Équipe non trouvée' });
      }
      
      // Vérifier si l'équipe est disponible
      if (!team.isAvailable()) {
        return res.status(400).json({ error: 'L\'équipe a atteint sa capacité maximale d\'inspections actives' });
      }
      
      // Incrémenter le compteur d'inspections actives de l'équipe
      team.activeInspections += 1;
      await team.save();
    }
    
    // Créer l'inspection
    const inspection = new Inspection({
      alertId,
      inspectorId: req.user.id,
      teamId,
      scheduledDate,
      status: status || 'scheduled',
      findings,
      violationLevel: violationLevel || 'none',
      recommendations,
      followUpRequired: followUpRequired || false,
      followUpDate,
      location
    });
    
    await inspection.save();
    
    // Mettre à jour le statut de l'alerte si nécessaire
    if (alertId) {
      try {
        await Alert.findByIdAndUpdate(alertId, {
          status: 'in_progress'
        });
        logger.info(`Statut de l'alerte ${alertId} mis à jour vers 'in_progress'`);
      } catch (error) {
        logger.warn(`Erreur lors de la mise à jour du statut de l'alerte ${alertId}: ${error.message}`);
      }
    }
    
    // Envoyer une notification à l'équipe si un teamId est fourni
    if (teamId) {
      try {
        await axios.post(`${config.NOTIFICATION_SERVICE_URL}/notifications`, {
          recipients: [teamId],
          title: 'Nouvelle inspection assignée',
          message: `Une nouvelle inspection a été planifiée pour le ${new Date(scheduledDate).toLocaleDateString()}`,
          type: 'inspection_assigned',
          data: {
            inspectionId: inspection._id,
            alertId: inspection.alertId,
            scheduledDate: inspection.scheduledDate
          }
        }, {
          headers: {
            'Authorization': req.headers.authorization
          }
        });
      } catch (error) {
        logger.error(`Erreur lors de l'envoi de la notification à l'équipe ${teamId}: ${error.message}`);
      }
    }
    
    res.status(201).json({
      success: true,
      data: inspection
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer toutes les inspections avec filtrage et pagination
 * @route GET /inspections
 * @access Privé
 */
exports.getInspections = async (req, res, next) => {
  try {
    // Récupérer les paramètres de filtrage et pagination
    const { status, alertId, inspectorId, teamId, startDate, endDate, overdue, page = 1, limit = 10 } = req.query;
    
    // Construire le filtre pour la requête MongoDB
    const filter = {};
    
    // Validation et application des filtres
    if (status) {
      // Vérifier que le statut est valide
      const validStatuses = ['scheduled', 'in-progress', 'completed', 'cancelled'];
      if (validStatuses.includes(status)) {
        filter.status = status;
      } else {
        logger.warn(`Statut d'inspection invalide: ${status}`);
      }
    }
    
    if (alertId) {
      // Vérifier que l'ID d'alerte est valide
      if (mongoose.Types.ObjectId.isValid(alertId)) {
        filter.alertId = alertId;
      } else {
        logger.warn(`ID d'alerte invalide: ${alertId}`);
        return res.status(400).json({ 
          success: false, 
          error: 'ID d\'alerte invalide' 
        });
      }
    }
    
    if (inspectorId) {
      filter.inspectorId = inspectorId;
    }
    
    if (teamId) {
      // Vérifier que l'ID d'équipe est valide
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        filter.teamId = teamId;
      } else {
        logger.warn(`ID d'équipe invalide: ${teamId}`);
        return res.status(400).json({ 
          success: false, 
          error: 'ID d\'\u00e9quipe invalide' 
        });
      }
    }
    
    // Filtrage par date
    if (startDate || endDate) {
      filter.scheduledDate = {};
      
      if (startDate) {
        try {
          filter.scheduledDate.$gte = new Date(startDate);
        } catch (error) {
          logger.warn(`Format de date de début invalide: ${startDate}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Format de date de début invalide' 
          });
        }
      }
      
      if (endDate) {
        try {
          filter.scheduledDate.$lte = new Date(endDate);
        } catch (error) {
          logger.warn(`Format de date de fin invalide: ${endDate}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Format de date de fin invalide' 
          });
        }
      }
    }
    
    // Filtrage des inspections en retard
    if (overdue === 'true') {
      filter.status = { $in: ['scheduled', 'in-progress'] };
      filter.scheduledDate = { $lt: new Date() };
    }
    
    try {
      // Calculer le nombre total d'inspections correspondant au filtre
      const total = await Inspection.countDocuments(filter);
      
      // Calculer le nombre de pages et les informations de pagination
      const limitNum = parseInt(limit) || 10;
      const pageNum = parseInt(page) || 1;
      const totalPages = Math.ceil(total / limitNum);
      const skip = (pageNum - 1) * limitNum;
      
      // Récupérer les inspections avec pagination
      const inspections = await Inspection.find(filter)
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limitNum);
      
      // Normaliser les données des inspections avant de les renvoyer
      const normalizedInspections = inspections.map(inspection => inspection.normalize());
      
      logger.info(`${normalizedInspections.length} inspections récupérées avec succès (page ${pageNum}/${totalPages})`);
      
      res.json({
        success: true,
        data: normalizedInspections,
        pagination: {
          total,
          totalPages,
          currentPage: pageNum,
          limit: limitNum
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des inspections: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la récupération des inspections',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les détails d'une inspection
 * @route GET /inspections/:inspectionId
 * @access Privé
 */
exports.getInspectionDetails = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    
    // Vérifier que l'ID d'inspection est valide
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      logger.warn(`ID d'inspection invalide: ${inspectionId}`);
      return res.status(400).json({ 
        success: false, 
        error: 'ID d\'inspection invalide' 
      });
    }
    
    try {
      const inspection = await Inspection.findById(inspectionId);
      
      if (!inspection) {
        logger.warn(`Inspection non trouvée: ${inspectionId}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Inspection non trouvée' 
        });
      }
      
      // Récupérer l'alerte associée si elle existe
      let alert = null;
      if (inspection.alertId) {
        try {
          alert = await Alert.findById(inspection.alertId);
        } catch (alertError) {
          logger.warn(`Erreur lors de la récupération de l'alerte associée: ${alertError.message}`);
        }
      }
      
      // Récupérer l'équipe associée si elle existe
      let team = null;
      if (inspection.teamId) {
        try {
          team = await Team.findById(inspection.teamId);
        } catch (teamError) {
          logger.warn(`Erreur lors de la récupération de l'équipe associée: ${teamError.message}`);
        }
      }
      
      // Normaliser les données de l'inspection avant de les renvoyer
      const normalizedInspection = inspection.normalize();
      
      // Ajouter les informations de l'alerte et de l'équipe
      if (alert) {
        normalizedInspection.alert = {
          id: alert._id,
          title: alert.title,
          description: alert.description,
          status: alert.status,
          priority: alert.priority
        };
      }
      
      if (team) {
        normalizedInspection.team = {
          id: team._id,
          name: team.name,
          members: team.members ? team.members.length : 0
        };
      }
      
      logger.info(`Détails de l'inspection ${inspectionId} récupérés avec succès`);
      
      res.json({
        success: true,
        data: normalizedInspection
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des détails de l'inspection ${inspectionId}: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la récupération des détails de l\'inspection',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour une inspection
 * @route PUT /inspections/:inspectionId
 * @access Privé
 */
exports.updateInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const { teamId, scheduledDate, status, findings, violationLevel, recommendations, followUpRequired, followUpDate, location } = req.body;
    
    // Vérifier que l'ID d'inspection est valide
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      logger.warn(`ID d'inspection invalide: ${inspectionId}`);
      return res.status(400).json({ 
        success: false, 
        error: 'ID d\'inspection invalide' 
      });
    }
    
    try {
      // Vérifier si l'inspection existe
      let inspection = await Inspection.findById(inspectionId);
      
      if (!inspection) {
        logger.warn(`Inspection non trouvée: ${inspectionId}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Inspection non trouvée' 
        });
      }
      
      // Validation du statut si fourni
      if (status) {
        const validStatuses = ['scheduled', 'in-progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
          logger.warn(`Statut d'inspection invalide: ${status}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Statut d\'inspection invalide' 
          });
        }
      }
      
      // Validation de la date planifiée si fournie
      if (scheduledDate) {
        try {
          const parsedDate = new Date(scheduledDate);
          if (isNaN(parsedDate.getTime())) {
            throw new Error('Date invalide');
          }
        } catch (error) {
          logger.warn(`Format de date planifiée invalide: ${scheduledDate}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Format de date planifiée invalide' 
          });
        }
      }
      
      // Vérifier si l'équipe existe si un nouveau teamId est fourni
      if (teamId && teamId !== inspection.teamId) {
        // Vérifier que l'ID d'équipe est valide
        if (!mongoose.Types.ObjectId.isValid(teamId)) {
          logger.warn(`ID d'équipe invalide: ${teamId}`);
          return res.status(400).json({ 
            success: false, 
            error: 'ID d\'\u00e9quipe invalide' 
          });
        }
        
        try {
          const team = await Team.findById(teamId);
          if (!team) {
            logger.warn(`Équipe non trouvée: ${teamId}`);
            return res.status(404).json({ 
              success: false, 
              error: 'Équipe non trouvée' 
            });
          }
          
          // Vérifier si l'équipe est disponible
          if (!team.isAvailable()) {
            logger.warn(`L'équipe ${teamId} a atteint sa capacité maximale`);
            return res.status(400).json({ 
              success: false, 
              error: 'L\'\u00e9quipe a atteint sa capacité maximale d\'inspections actives' 
            });
          }
          
          // Mettre à jour les compteurs d'inspections des équipes
          if (inspection.teamId) {
            try {
              const oldTeam = await Team.findById(inspection.teamId);
              if (oldTeam) {
                oldTeam.activeInspections = Math.max(0, oldTeam.activeInspections - 1);
                await oldTeam.save();
                logger.info(`Compteur d'inspections actives de l'équipe ${inspection.teamId} décrémenté`);
              }
            } catch (error) {
              logger.warn(`Erreur lors de la mise à jour de l'ancienne équipe: ${error.message}`);
            }
          }
          
          team.activeInspections += 1;
          await team.save();
          logger.info(`Compteur d'inspections actives de l'équipe ${teamId} incrémenté`);
        } catch (error) {
          logger.error(`Erreur lors de la mise à jour des équipes: ${error.message}`);
          return res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la mise à jour des équipes',
            message: error.message 
          });
        }
      }
      
      // Préparer les données à mettre à jour
      const updateData = {};
      
      if (teamId) updateData.teamId = teamId;
      if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate);
      if (status) updateData.status = status;
      if (findings) updateData.findings = findings;
      if (violationLevel) updateData.violationLevel = violationLevel;
      if (recommendations) updateData.recommendations = recommendations;
      if (followUpRequired !== undefined) updateData.followUpRequired = followUpRequired;
      if (followUpDate) updateData.followUpDate = new Date(followUpDate);
      if (location) updateData.location = location;
      
      // Mettre à jour l'inspection avec les nouvelles données
      Object.assign(inspection, updateData);
      
      // Sauvegarder les modifications
      await inspection.save();
      
      logger.info(`Inspection ${inspectionId} mise à jour avec succès`);
      
      // Normaliser les données de l'inspection avant de les renvoyer
      const normalizedInspection = inspection.normalize();
      
      res.json({
        success: true,
        data: normalizedInspection,
        message: 'Inspection mise à jour avec succès'
      });
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour de l'inspection ${inspectionId}: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la mise à jour de l\'inspection',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Marquer une inspection comme terminée
 * @route POST /inspections/:inspectionId/complete
 * @access Privé (Inspecteur)
 */
exports.completeInspection = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const { findings, violationLevel, recommendations, followUpRequired, followUpDate } = req.body;
    
    // Vérifier que l'ID d'inspection est valide
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      logger.warn(`ID d'inspection invalide: ${inspectionId}`);
      return res.status(400).json({ 
        success: false, 
        error: 'ID d\'inspection invalide' 
      });
    }
    
    try {
      // Vérifier si l'inspection existe
      const inspection = await Inspection.findById(inspectionId);
      
      if (!inspection) {
        logger.warn(`Inspection non trouvée: ${inspectionId}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Inspection non trouvée' 
        });
      }
      
      // Vérifier si l'inspection peut être marquée comme terminée
      if (inspection.status === 'completed' || inspection.status === 'cancelled') {
        logger.warn(`Tentative de compléter une inspection déjà ${inspection.status}: ${inspectionId}`);
        return res.status(400).json({ 
          success: false, 
          error: `L'inspection est déjà ${inspection.status}` 
        });
      }
      
      // Validation du niveau de violation si fourni
      if (violationLevel) {
        const validLevels = ['none', 'minor', 'moderate', 'severe', 'critical'];
        if (!validLevels.includes(violationLevel)) {
          logger.warn(`Niveau de violation invalide: ${violationLevel}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Niveau de violation invalide' 
          });
        }
      }
      
      // Validation de la date de suivi si fournie
      if (followUpDate) {
        try {
          const parsedDate = new Date(followUpDate);
          if (isNaN(parsedDate.getTime())) {
            throw new Error('Date invalide');
          }
        } catch (error) {
          logger.warn(`Format de date de suivi invalide: ${followUpDate}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Format de date de suivi invalide' 
          });
        }
      }
      
      // Mettre à jour l'inspection
      inspection.status = 'completed';
      inspection.completionDate = new Date();
      inspection.findings = findings || inspection.findings;
      inspection.violationLevel = violationLevel || inspection.violationLevel;
      inspection.recommendations = recommendations || inspection.recommendations;
      inspection.followUpRequired = followUpRequired !== undefined ? followUpRequired : inspection.followUpRequired;
      
      if (followUpDate) {
        inspection.followUpDate = new Date(followUpDate);
      }
      
      // Sauvegarder les modifications
      await inspection.save();
      
      // Mettre à jour le compteur d'inspections de l'équipe
      if (inspection.teamId) {
        try {
          const team = await Team.findById(inspection.teamId);
          if (team) {
            team.activeInspections = Math.max(0, team.activeInspections - 1);
            team.completedInspections = (team.completedInspections || 0) + 1;
            await team.save();
            logger.info(`Compteurs d'inspections de l'équipe ${inspection.teamId} mis à jour`);
          }
        } catch (teamError) {
          logger.warn(`Erreur lors de la mise à jour des compteurs de l'équipe ${inspection.teamId}: ${teamError.message}`);
        }
      }
      
      // Déterminer le statut de l'alerte en fonction du niveau de violation
      let alertStatus = 'resolved';
      if (inspection.violationLevel === 'severe' || inspection.violationLevel === 'critical') {
        alertStatus = 'processing'; // Nécessite plus d'actions
      }
      
      // Mettre à jour le statut de l'alerte associée
      if (inspection.alertId) {
        try {
          const alert = await Alert.findById(inspection.alertId);
          
          if (alert) {
            // Mettre à jour le statut de l'alerte
            alert.status = alertStatus;
            
            // Ajouter un commentaire à l'alerte
            alert.comments = alert.comments || [];
            alert.comments.push({
              text: `Inspection ${inspection.status}. ${findings || ''}`,
              author: req.user ? req.user.name : 'Système',
              createdAt: new Date()
            });
            
            await alert.save();
            logger.info(`Alerte ${inspection.alertId} mise à jour avec statut '${alertStatus}' et commentaire ajouté`);
          } else {
            logger.warn(`Alerte ${inspection.alertId} non trouvée lors de la complétion de l'inspection`);
          }
        } catch (alertError) {
          logger.error(`Erreur lors de la mise à jour de l'alerte ${inspection.alertId}: ${alertError.message}`);
        }
      }
      
      // Normaliser les données de l'inspection avant de les renvoyer
      const normalizedInspection = inspection.normalize();
      
      logger.info(`Inspection ${inspectionId} marquée comme terminée avec succès`);
      
      res.json({
        success: true,
        data: normalizedInspection,
        message: 'Inspection marquée comme terminée avec succès'
      });
    } catch (error) {
      logger.error(`Erreur lors de la complétion de l'inspection ${inspectionId}: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la complétion de l\'inspection',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Ajouter des photos à une inspection
 * @route POST /inspections/:inspectionId/photos
 * @access Privé (Inspecteur)
 */
exports.addInspectionPhotos = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    
    // Vérifier que l'ID d'inspection est valide
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      logger.warn(`ID d'inspection invalide: ${inspectionId}`);
      return res.status(400).json({ 
        success: false, 
        error: 'ID d\'inspection invalide' 
      });
    }
    
    try {
      // Vérifier si l'inspection existe
      const inspection = await Inspection.findById(inspectionId);
      
      if (!inspection) {
        logger.warn(`Inspection non trouvée: ${inspectionId}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Inspection non trouvée' 
        });
      }
      
      // Vérifier si des fichiers ont été uploadés
      if (!req.files || req.files.length === 0) {
        logger.warn(`Tentative d'ajout de photos sans fichiers pour l'inspection ${inspectionId}`);
        return res.status(400).json({ 
          success: false, 
          error: 'Aucune photo n\'a été fournie' 
        });
      }
      
      // Vérifier le nombre maximum de photos (limite à 10 par exemple)
      const maxPhotos = 10;
      if ((inspection.photos || []).length + req.files.length > maxPhotos) {
        logger.warn(`Tentative d'ajout de trop de photos pour l'inspection ${inspectionId}`);
        return res.status(400).json({ 
          success: false, 
          error: `Nombre maximum de photos (${maxPhotos}) dépassé` 
        });
      }
      
      // Vérifier que les fichiers sont bien des images
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
      const invalidFiles = req.files.filter(file => !validMimeTypes.includes(file.mimetype));
      
      if (invalidFiles.length > 0) {
        logger.warn(`Types de fichiers invalides détectés pour l'inspection ${inspectionId}`);
        return res.status(400).json({ 
          success: false, 
          error: 'Certains fichiers ne sont pas des images valides (jpeg, png, gif)' 
        });
      }
      
      // Créer le dossier de destination si nécessaire
      const uploadDir = path.join(__dirname, '../uploads/inspections');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Ajouter les photos à l'inspection
      const photos = req.files.map(file => ({
        url: `/uploads/inspections/${file.filename}`,
        caption: req.body.caption || '',
        timestamp: new Date()
      }));
      
      // Initialiser le tableau de photos s'il n'existe pas
      inspection.photos = inspection.photos || [];
      
      // Ajouter les nouvelles photos
      inspection.photos = [...inspection.photos, ...photos];
      
      // Sauvegarder les modifications
      await inspection.save();
      
      logger.info(`${photos.length} photos ajoutées à l'inspection ${inspectionId}`);
      
      // Normaliser les données de l'inspection avant de les renvoyer
      const normalizedInspection = inspection.normalize();
      
      res.json({
        success: true,
        data: normalizedInspection,
        message: `${photos.length} photos ajoutées avec succès`
      });
    } catch (error) {
      logger.error(`Erreur lors de l'ajout de photos à l'inspection ${inspectionId}: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de l\'ajout de photos',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Planifier un suivi pour une inspection
 * @route POST /inspections/:inspectionId/follow-up
 * @access Privé
 */
exports.scheduleFollowUp = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;
    const { followUpDate, notes, reason } = req.body;
    
    // Validation des champs requis
    if (!followUpDate) {
      logger.warn('Tentative de planification de suivi sans date');
      return res.status(400).json({ 
        success: false, 
        error: 'La date de suivi est obligatoire' 
      });
    }
    
    // Vérifier que l'ID d'inspection est valide
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      logger.warn(`ID d'inspection invalide: ${inspectionId}`);
      return res.status(400).json({ 
        success: false, 
        error: 'ID d\'inspection invalide' 
      });
    }
    
    try {
      // Vérifier si l'inspection existe
      const inspection = await Inspection.findById(inspectionId);
      
      if (!inspection) {
        logger.warn(`Inspection non trouvée: ${inspectionId}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Inspection non trouvée' 
        });
      }
      
      // Validation de la date de suivi
      let parsedDate;
      try {
        parsedDate = new Date(followUpDate);
        if (isNaN(parsedDate.getTime())) {
          throw new Error('Date invalide');
        }
        
        // Vérifier que la date de suivi est dans le futur
        const now = new Date();
        if (parsedDate <= now) {
          logger.warn(`Date de suivi dans le passé: ${followUpDate}`);
          return res.status(400).json({ 
            success: false, 
            error: 'La date de suivi doit être dans le futur' 
          });
        }
      } catch (error) {
        logger.warn(`Format de date de suivi invalide: ${followUpDate}`);
        return res.status(400).json({ 
          success: false, 
          error: 'Format de date de suivi invalide' 
        });
      }
      
      // Mettre à jour l'inspection
      inspection.followUpRequired = true;
      inspection.followUpDate = parsedDate;
      
      // Ajouter les notes de suivi si fournies
      if (notes) {
        inspection.recommendations = inspection.recommendations 
          ? `${inspection.recommendations}\n\nNotes de suivi: ${notes}` 
          : `Notes de suivi: ${notes}`;
      }
      
      // Ajouter la raison du suivi si fournie
      if (reason) {
        inspection.followUpReason = reason;
      }
      
      // Sauvegarder les modifications
      await inspection.save();
      
      logger.info(`Suivi planifié avec succès pour l'inspection ${inspectionId} pour le ${parsedDate.toISOString()}`);
      
      // Normaliser les données de l'inspection avant de les renvoyer
      const normalizedInspection = inspection.normalize();
      
      res.json({
        success: true,
        data: normalizedInspection,
        message: 'Suivi planifié avec succès'
      });
    } catch (error) {
      logger.error(`Erreur lors de la planification du suivi pour l'inspection ${inspectionId}: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la planification du suivi',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les statistiques des inspections
 * @route GET /inspections/statistics
 * @access Privé
 */
exports.getInspectionStatistics = async (req, res, next) => {
  try {
    const { startDate, endDate, teamId } = req.query;
    
    // Construire le filtre de base
    const baseFilter = {};
    
    // Ajouter le filtre de date si fourni
    if (startDate || endDate) {
      baseFilter.scheduledDate = {};
      
      if (startDate) {
        try {
          baseFilter.scheduledDate.$gte = new Date(startDate);
        } catch (error) {
          logger.warn(`Format de date de début invalide: ${startDate}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Format de date de début invalide' 
          });
        }
      }
      
      if (endDate) {
        try {
          baseFilter.scheduledDate.$lte = new Date(endDate);
        } catch (error) {
          logger.warn(`Format de date de fin invalide: ${endDate}`);
          return res.status(400).json({ 
            success: false, 
            error: 'Format de date de fin invalide' 
          });
        }
      }
    }
    
    // Ajouter le filtre d'équipe si fourni
    if (teamId) {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        logger.warn(`ID d'équipe invalide: ${teamId}`);
        return res.status(400).json({ 
          success: false, 
          error: 'ID d\'\u00e9quipe invalide' 
        });
      }
      baseFilter.teamId = teamId;
    }
    
    try {
      // Statistiques globales
      const totalInspections = await Inspection.countDocuments(baseFilter);
      const completedInspections = await Inspection.countDocuments({ ...baseFilter, status: 'completed' });
      const scheduledInspections = await Inspection.countDocuments({ ...baseFilter, status: 'scheduled' });
      const inProgressInspections = await Inspection.countDocuments({ ...baseFilter, status: 'in-progress' });
      const cancelledInspections = await Inspection.countDocuments({ ...baseFilter, status: 'cancelled' });
      const overdueInspections = await Inspection.countDocuments({
        ...baseFilter,
        status: { $in: ['scheduled', 'in-progress'] },
        scheduledDate: { $lt: new Date() }
      });
      
      // Statistiques par niveau de violation
      const violationStats = await Inspection.aggregate([
        { $match: { ...baseFilter, status: 'completed' } },
        { $group: { _id: '$violationLevel', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      // Statistiques par équipe
      const teamStatsQuery = [
        { $match: { ...baseFilter, teamId: { $exists: true, $ne: null } } },
        { $group: { 
          _id: '$teamId', 
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ 
            $and: [
              { $in: ['$status', ['scheduled', 'in-progress']] },
              { $lt: ['$scheduledDate', new Date()] }
            ]
          }, 1, 0] } },
          avgCompletionTime: { 
            $avg: { 
              $cond: [
                { $and: [
                  { $eq: ['$status', 'completed'] },
                  { $ne: ['$completionDate', null] }
                ]},
                { $divide: [{ $subtract: ['$completionDate', '$scheduledDate'] }, 86400000] }, // Convertir en jours
                null
              ]
            }
          }
        }},
        { $sort: { total: -1 } }
      ];
      
      const teamStats = await Inspection.aggregate(teamStatsQuery);
      
      // Statistiques temporelles (par mois)
      let timeRangeStart = new Date();
      timeRangeStart.setMonth(timeRangeStart.getMonth() - 6); // Par défaut, 6 derniers mois
      
      if (startDate) {
        timeRangeStart = new Date(startDate);
      }
      
      const timeRangeEnd = endDate ? new Date(endDate) : new Date();
      
      const timeStatsQuery = [
        { $match: { scheduledDate: { $gte: timeRangeStart, $lte: timeRangeEnd } } },
        { $group: {
          _id: { 
            year: { $year: '$scheduledDate' },
            month: { $month: '$scheduledDate' }
          },
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ 
            $and: [
              { $in: ['$status', ['scheduled', 'in-progress']] },
              { $lt: ['$scheduledDate', new Date()] }
            ]
          }, 1, 0] } }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ];
      
      const timeStats = await Inspection.aggregate(timeStatsQuery);
      
      // Statistiques des suivis
      const followUpStats = await Inspection.aggregate([
        { $match: { ...baseFilter, followUpRequired: true } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $ne: ['$status', 'completed'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ 
            $and: [
              { $ne: ['$status', 'completed'] },
              { $lt: ['$followUpDate', new Date()] }
            ]
          }, 1, 0] } }
        }}
      ]);
      
      // Préparer la réponse
      const response = {
        success: true,
        data: {
          summary: {
            total: totalInspections,
            completed: completedInspections,
            scheduled: scheduledInspections,
            inProgress: inProgressInspections,
            cancelled: cancelledInspections,
            overdue: overdueInspections,
            completionRate: totalInspections > 0 ? parseFloat(((completedInspections / totalInspections) * 100).toFixed(1)) : 0
          },
          violationStats: violationStats.map(stat => ({
            level: stat._id || 'non spécifié',
            count: stat.count,
            percentage: totalInspections > 0 ? parseFloat(((stat.count / completedInspections) * 100).toFixed(1)) : 0
          })),
          followUp: followUpStats.length > 0 ? {
            total: followUpStats[0].total,
            completed: followUpStats[0].completed,
            pending: followUpStats[0].pending,
            overdue: followUpStats[0].overdue,
            completionRate: followUpStats[0].total > 0 ? 
              parseFloat(((followUpStats[0].completed / followUpStats[0].total) * 100).toFixed(1)) : 0
          } : {
            total: 0,
            completed: 0,
            pending: 0,
            overdue: 0,
            completionRate: 0
          }
        }
      };
      
      // Ajouter les statistiques par équipe
      response.data.teamStats = await Promise.all(teamStats.map(async stat => {
        let teamName = 'Équipe inconnue';
        try {
          const team = await Team.findById(stat._id);
          if (team) {
            teamName = team.name;
          }
        } catch (error) {
          logger.warn(`Erreur lors de la récupération de l'équipe ${stat._id}: ${error.message}`);
        }
        
        return {
          teamId: stat._id,
          teamName: teamName,
          total: stat.total,
          completed: stat.completed,
          overdue: stat.overdue || 0,
          completionRate: stat.total > 0 ? parseFloat(((stat.completed / stat.total) * 100).toFixed(1)) : 0,
          avgCompletionTime: stat.avgCompletionTime ? parseFloat(stat.avgCompletionTime.toFixed(1)) : null
        };
      }));
      
      // Ajouter les statistiques temporelles
      response.data.timeStats = timeStats.map(stat => {
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const monthName = monthNames[stat._id.month - 1];
        
        return {
          year: stat._id.year,
          month: stat._id.month,
          monthName: monthName,
          label: `${monthName} ${stat._id.year}`,
          count: stat.count,
          completed: stat.completed,
          overdue: stat.overdue || 0,
          completionRate: stat.count > 0 ? parseFloat(((stat.completed / stat.count) * 100).toFixed(1)) : 0
        };
      });
      
      logger.info(`Statistiques des inspections récupérées avec succès`);
      
      res.json(response);
    } catch (error) {
      logger.error(`Erreur lors de la récupération des statistiques des inspections: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la récupération des statistiques des inspections',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};
