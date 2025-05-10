const Inspection = require('../models/inspection');
const Team = require('../models/team');
const axios = require('axios');
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
    
    // Vérifier si l'alerte existe via le service d'alertes
    try {
      await axios.get(`${config.ALERT_SERVICE_URL}/alerts/${alertId}`, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
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
    
    // Mettre à jour le statut de l'alerte via le service d'alertes
    try {
      await axios.put(`${config.ALERT_SERVICE_URL}/alerts/${alertId}/status`, {
        status: 'processing'
      }, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour du statut de l'alerte ${alertId}: ${error.message}`);
      // On continue malgré l'erreur car l'inspection a été créée
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
        // On continue malgré l'erreur car l'inspection a été créée
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
    const { status, teamId, inspectorId, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    // Construire le filtre
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (teamId) {
      filter.teamId = teamId;
    }
    
    if (inspectorId) {
      filter.inspectorId = inspectorId;
    }
    
    // Filtre par date
    if (startDate || endDate) {
      filter.scheduledDate = {};
      
      if (startDate) {
        filter.scheduledDate.$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter.scheduledDate.$lte = new Date(endDate);
      }
    }
    
    // Calculer le nombre total d'inspections correspondant au filtre
    const total = await Inspection.countDocuments(filter);
    
    // Récupérer les inspections avec pagination
    const inspections = await Inspection.find(filter)
      .sort({ scheduledDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: inspections.length,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      },
      data: inspections
    });
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
    const inspection = await Inspection.findById(req.params.inspectionId);
    
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection non trouvée' });
    }
    
    res.json({
      success: true,
      data: inspection
    });
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
    const { teamId, scheduledDate, status, findings, violationLevel, recommendations, followUpRequired, followUpDate, location } = req.body;
    
    // Vérifier si l'inspection existe
    let inspection = await Inspection.findById(req.params.inspectionId);
    
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection non trouvée' });
    }
    
    // Vérifier si l'équipe existe si un nouveau teamId est fourni
    if (teamId && teamId !== inspection.teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ error: 'Équipe non trouvée' });
      }
      
      // Vérifier si l'équipe est disponible
      if (!team.isAvailable()) {
        return res.status(400).json({ error: 'L\'équipe a atteint sa capacité maximale d\'inspections actives' });
      }
      
      // Mettre à jour les compteurs d'inspections des équipes
      if (inspection.teamId) {
        const oldTeam = await Team.findById(inspection.teamId);
        if (oldTeam) {
          oldTeam.activeInspections -= 1;
          await oldTeam.save();
        }
      }
      
      team.activeInspections += 1;
      await team.save();
    }
    
    // Mettre à jour l'inspection
    inspection.teamId = teamId || inspection.teamId;
    inspection.scheduledDate = scheduledDate || inspection.scheduledDate;
    inspection.status = status || inspection.status;
    inspection.findings = findings || inspection.findings;
    inspection.violationLevel = violationLevel || inspection.violationLevel;
    inspection.recommendations = recommendations || inspection.recommendations;
    inspection.followUpRequired = followUpRequired !== undefined ? followUpRequired : inspection.followUpRequired;
    inspection.followUpDate = followUpDate || inspection.followUpDate;
    
    if (location) {
      inspection.location = location;
    }
    
    await inspection.save();
    
    res.json({
      success: true,
      data: inspection
    });
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
    const { findings, violationLevel, recommendations, followUpRequired, followUpDate } = req.body;
    
    // Vérifier si l'inspection existe
    const inspection = await Inspection.findById(req.params.inspectionId);
    
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection non trouvée' });
    }
    
    // Vérifier si l'inspection peut être marquée comme terminée
    if (inspection.status === 'completed' || inspection.status === 'cancelled') {
      return res.status(400).json({ error: `L'inspection est déjà ${inspection.status}` });
    }
    
    // Mettre à jour l'inspection
    inspection.status = 'completed';
    inspection.completionDate = new Date();
    inspection.findings = findings || inspection.findings;
    inspection.violationLevel = violationLevel || inspection.violationLevel;
    inspection.recommendations = recommendations || inspection.recommendations;
    inspection.followUpRequired = followUpRequired !== undefined ? followUpRequired : inspection.followUpRequired;
    inspection.followUpDate = followUpDate || inspection.followUpDate;
    
    await inspection.save();
    
    // Mettre à jour le compteur d'inspections de l'équipe
    if (inspection.teamId) {
      const team = await Team.findById(inspection.teamId);
      if (team) {
        team.activeInspections -= 1;
        team.completedInspections += 1;
        await team.save();
      }
    }
    
    // Mettre à jour le statut de l'alerte en fonction du niveau de violation
    let alertStatus = 'resolved';
    if (inspection.violationLevel === 'severe' || inspection.violationLevel === 'critical') {
      alertStatus = 'processing'; // Nécessite plus d'actions
    }
    
    // Mettre à jour le statut de l'alerte via le service d'alertes
    try {
      await axios.put(`${config.ALERT_SERVICE_URL}/alerts/${inspection.alertId}/status`, {
        status: alertStatus
      }, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      
      // Ajouter un feedback à l'alerte
      await axios.post(`${config.ALERT_SERVICE_URL}/alerts/${inspection.alertId}/feedback`, {
        message: `Inspection terminée. Niveau de violation: ${inspection.violationLevel}. ${inspection.recommendations || ''}`,
        fromService: true
      }, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour de l'alerte ${inspection.alertId}: ${error.message}`);
      // On continue malgré l'erreur car l'inspection a été marquée comme terminée
    }
    
    res.json({
      success: true,
      data: inspection
    });
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
    // Vérifier si l'inspection existe
    const inspection = await Inspection.findById(req.params.inspectionId);
    
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection non trouvée' });
    }
    
    // Vérifier si des fichiers ont été uploadés
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucune photo n\'a été fournie' });
    }
    
    // Ajouter les photos à l'inspection
    const photos = req.files.map(file => ({
      url: `/uploads/inspections/${file.filename}`,
      caption: req.body.caption || '',
      timestamp: new Date()
    }));
    
    inspection.photos = [...(inspection.photos || []), ...photos];
    
    await inspection.save();
    
    res.json({
      success: true,
      data: {
        photos: inspection.photos
      }
    });
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
    const { followUpDate, notes } = req.body;
    
    if (!followUpDate) {
      return res.status(400).json({ error: 'La date de suivi est requise' });
    }
    
    // Vérifier si l'inspection existe
    const inspection = await Inspection.findById(req.params.inspectionId);
    
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection non trouvée' });
    }
    
    // Mettre à jour l'inspection
    inspection.followUpRequired = true;
    inspection.followUpDate = new Date(followUpDate);
    
    if (notes) {
      inspection.recommendations = inspection.recommendations 
        ? `${inspection.recommendations}\n\nNotes de suivi: ${notes}` 
        : `Notes de suivi: ${notes}`;
    }
    
    await inspection.save();
    
    res.json({
      success: true,
      data: inspection
    });
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
    // Statistiques globales
    const totalInspections = await Inspection.countDocuments();
    const completedInspections = await Inspection.countDocuments({ status: 'completed' });
    const scheduledInspections = await Inspection.countDocuments({ status: 'scheduled' });
    const inProgressInspections = await Inspection.countDocuments({ status: 'in-progress' });
    const cancelledInspections = await Inspection.countDocuments({ status: 'cancelled' });
    
    // Statistiques par niveau de violation
    const violationStats = await Inspection.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$violationLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Statistiques par équipe
    const teamStats = await Inspection.aggregate([
      { $match: { teamId: { $exists: true, $ne: null } } },
      { $group: { 
        _id: '$teamId', 
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
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
    ]);
    
    // Statistiques temporelles (par mois)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    
    const timeStats = await Inspection.aggregate([
      { $match: { scheduledDate: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { 
          year: { $year: '$scheduledDate' },
          month: { $month: '$scheduledDate' }
        },
        count: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        summary: {
          total: totalInspections,
          completed: completedInspections,
          scheduled: scheduledInspections,
          inProgress: inProgressInspections,
          cancelled: cancelledInspections,
          completionRate: totalInspections > 0 ? (completedInspections / totalInspections) * 100 : 0
        },
        violationStats: violationStats.map(stat => ({
          level: stat._id,
          count: stat.count
        })),
        teamStats: await Promise.all(teamStats.map(async stat => {
          const team = await Team.findById(stat._id);
          return {
            teamId: stat._id,
            teamName: team ? team.name : 'Équipe inconnue',
            total: stat.total,
            completed: stat.completed,
            completionRate: stat.total > 0 ? (stat.completed / stat.total) * 100 : 0,
            avgCompletionTime: stat.avgCompletionTime ? parseFloat(stat.avgCompletionTime.toFixed(1)) : null
          };
        })),
        timeStats: timeStats.map(stat => ({
          year: stat._id.year,
          month: stat._id.month,
          count: stat.count,
          completed: stat.completed
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};
