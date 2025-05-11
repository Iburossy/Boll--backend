const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('../config/env');
const Alert = require('../models/alert');
const Team = require('../models/team');
const Inspection = require('../models/inspection');
const Zone = require('../models/zone');

/**
 * Contrôleur pour la gestion des alertes d'hygiène
 */

/**
 * Récupérer toutes les alertes d'hygiène
 * @route GET /alerts
 * @access Privé
 */
exports.getHygieneAlerts = async (req, res, next) => {
  try {
    // Récupérer les paramètres de filtrage et pagination
    const { status, priority, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    // Construire le filtre pour la requête MongoDB
    const filter = { category: 'hygiene' };
    
    if (status) {
      // Vérifier que le statut est valide
      const validStatuses = ['new', 'assigned', 'in_progress', 'resolved', 'closed'];
      if (validStatuses.includes(status)) {
        filter.status = status;
      } else {
        logger.warn(`Statut invalide: ${status}`);
      }
    }
    
    if (priority) {
      // Vérifier que la priorité est valide
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (validPriorities.includes(priority)) {
        filter.priority = priority;
      } else {
        logger.warn(`Priorité invalide: ${priority}`);
      }
    }
    
    // Filtrage par date
    if (startDate || endDate) {
      filter.createdAt = {};
      
      if (startDate) {
        try {
          filter.createdAt.$gte = new Date(startDate);
        } catch (error) {
          logger.warn(`Format de date de début invalide: ${startDate}`);
        }
      }
      
      if (endDate) {
        try {
          filter.createdAt.$lte = new Date(endDate);
        } catch (error) {
          logger.warn(`Format de date de fin invalide: ${endDate}`);
        }
      }
    }
    
    try {
      // Calculer le nombre total d'alertes correspondant au filtre
      const total = await Alert.countDocuments(filter);
      
      // Calculer le nombre de pages et les informations de pagination
      const limitNum = parseInt(limit) || 10;
      const pageNum = parseInt(page) || 1;
      const totalPages = Math.ceil(total / limitNum);
      const skip = (pageNum - 1) * limitNum;
      
      // Récupérer les alertes avec pagination
      const alerts = await Alert.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);
      
      // Normaliser les données des alertes avant de les renvoyer
      const normalizedAlerts = alerts.map(alert => alert.normalize());
      
      logger.info(`${normalizedAlerts.length} alertes récupérées avec succès (page ${pageNum}/${totalPages})`);
      
      res.json({
        success: true,
        data: normalizedAlerts,
        pagination: {
          total,
          totalPages,
          currentPage: pageNum,
          limit: limitNum
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des alertes: ${error.message}`);
      res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la récupération des alertes',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les détails d'une alerte
 * @route GET /alerts/:alertId
 * @access Privé
 */
exports.getAlertDetails = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    
    if (!alertId || !mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json({ 
        success: false,
        error: 'ID d\'alerte invalide ou manquant' 
      });
    }
    
    try {
      // Récupérer l'alerte depuis notre base de données locale
      const alert = await Alert.findById(alertId);
      
      if (!alert) {
        return res.status(404).json({ 
          success: false,
          error: 'Alerte non trouvée' 
        });
      }
      
      // Normaliser les données de l'alerte avant de les renvoyer
      const normalizedAlert = alert.normalize();
      
      logger.info(`Détails de l'alerte ${alertId} récupérés avec succès`);
      
      res.json({
        success: true,
        data: normalizedAlert
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des détails de l'alerte ${alertId}: ${error.message}`);
      res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la récupération des détails de l\'alerte',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour le statut d'une alerte
 * @route PUT /alerts/:alertId/status
 * @access Privé
 */
exports.updateAlertStatus = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { status, comment } = req.body;
    
    // Vérifier que le statut est valide
    const validStatuses = ['new', 'assigned', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    
    try {
      // Récupérer l'alerte à mettre à jour
      const alert = await Alert.findById(alertId);
      
      if (!alert) {
        return res.status(404).json({ error: 'Alerte non trouvée' });
      }
      
      // Vérifier si l'alerte appartient à la catégorie hygiène
      if (alert.category !== 'hygiene') {
        return res.status(403).json({ error: 'Cette alerte n\'appartient pas au service d\'hygiène' });
      }
      
      // Mettre à jour le statut
      alert.status = status;
      alert.updatedAt = new Date();
      
      // Ajouter un commentaire si fourni
      if (comment) {
        alert.comments.push({
          author: req.user.name || req.user.id,
          text: comment,
          createdAt: new Date()
        });
      }
      
      // Sauvegarder les modifications
      await alert.save();
      
      // Si l'alerte est résolue ou fermée, mettre à jour l'inspection associée
      if (status === 'resolved' || status === 'closed') {
        const inspection = await Inspection.findOne({ alertId: alert._id });
        
        if (inspection && inspection.status !== 'completed') {
          inspection.status = 'completed';
          inspection.completionDate = new Date();
          await inspection.save();
        }
      }
      
      res.json({
        success: true,
        data: alert.normalize()
      });
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour du statut de l'alerte ${alertId}: ${error.message}`);
      res.status(error.response?.status || 500).json({ error: 'Erreur lors de la mise à jour du statut de l\'alerte' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Assigner une alerte à une équipe
 * @route POST /alerts/:alertId/assign
 * @access Privé (Superviseur)
 */
exports.assignAlertToTeam = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { teamId, scheduledDate } = req.body;
    
    if (!teamId) {
      return res.status(400).json({ error: 'L\'ID de l\'équipe est requis' });
    }
    
    if (!scheduledDate) {
      return res.status(400).json({ error: 'La date d\'inspection planifiée est requise' });
    }
    
    // Vérifier si l'équipe existe
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Équipe non trouvée' });
    }
    
    // Vérifier si l'équipe est disponible
    if (!team.isAvailable()) {
      return res.status(400).json({ error: 'L\'équipe a atteint sa capacité maximale d\'inspections actives' });
    }
    
    // Vérifier si l'alerte existe
    const alert = await Alert.findById(alertId);
    
    if (!alert) {
      return res.status(404).json({ error: 'Alerte non trouvée' });
    }
    
    // Vérifier si l'alerte appartient à la catégorie hygiène
    if (alert.category !== 'hygiene') {
      return res.status(403).json({ error: 'Cette alerte n\'appartient pas au service d\'hygiène' });
    }
    
    // Vérifier si une inspection existe déjà pour cette alerte
    const existingInspection = await Inspection.findOne({ alertId });
    
    if (existingInspection) {
      return res.status(400).json({ error: 'Une inspection est déjà associée à cette alerte' });
    }
    
    // Créer une nouvelle inspection
    const inspection = new Inspection({
      alertId,
      inspectorId: req.user.id,
      teamId,
      scheduledDate: new Date(scheduledDate),
      status: 'scheduled'
    });
    
    await inspection.save();
    
    // Incrémenter le compteur d'inspections actives de l'équipe
    team.activeInspections += 1;
    await team.save();
    
    // Mettre à jour le statut de l'alerte
    try {
      // Mettre à jour le statut directement dans notre base de données locale
      alert.status = 'in_progress';
      alert.assignedTeam = teamId;
      alert.updatedAt = new Date();
      
      // Ajouter un commentaire sur l'assignation
      alert.comments.push({
        author: req.user.name || req.user.id,
        text: `Alerte assignée à l'équipe ${team.name} pour inspection le ${new Date(scheduledDate).toLocaleDateString()}`,
        createdAt: new Date()
      });
      
      await alert.save();
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour du statut de l'alerte ${alertId}: ${error.message}`);
      // On continue malgré l'erreur car l'inspection a été créée
    }
    
    // Envoyer une notification à l'équipe
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
    
    res.status(201).json({
      success: true,
      data: {
        inspection,
        team: {
          id: team._id,
          name: team.name,
          specialization: team.specialization
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ajouter un feedback à une alerte
 * @route POST /alerts/:alertId/feedback
 * @access Privé
 */
exports.addFeedback = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Le message est requis' });
    }
    
    try {
      // Récupérer l'alerte depuis la base de données locale
      const alert = await Alert.findById(alertId);
      
      if (!alert) {
        return res.status(404).json({ error: 'Alerte non trouvée' });
      }
      
      // Vérifier si l'alerte appartient à la catégorie hygiène
      if (alert.category !== 'hygiene') {
        return res.status(403).json({ error: 'Cette alerte n\'appartient pas au service d\'hygiène' });
      }
      
      // Ajouter le commentaire à l'alerte
      alert.comments.push({
        author: req.user.name || req.user.id,
        text: message,
        createdAt: new Date()
      });
      
      // Sauvegarder les modifications
      await alert.save();
      
      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      logger.error(`Erreur lors de l'ajout du feedback à l'alerte ${alertId}: ${error.message}`);
      res.status(500).json({ error: 'Erreur lors de l\'ajout du feedback à l\'alerte' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les statistiques des alertes
 * @route GET /alerts/statistics
 * @access Privé
 */
exports.getAlertStatistics = async (req, res, next) => {
  try {
    try {
      // Utiliser la méthode statique du modèle pour obtenir les statistiques de base
      const summary = await Alert.getStatistics('hygiene');
      
      // Compter les alertes par priorité
      const alertsByPriority = await Alert.aggregate([
        { $match: { category: 'hygiene' } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]);
      
      // Compter les alertes par équipe assignée
      const alertsByTeam = await Alert.aggregate([
        { $match: { category: 'hygiene', assignedTeam: { $exists: true, $ne: null } } },
        { $group: { _id: '$assignedTeam', count: { $sum: 1 } } }
      ]);
      
      // Compter les alertes par mois (pour les 6 derniers mois)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const alertsByMonth = await Alert.aggregate([
        { 
          $match: { 
            category: 'hygiene',
            createdAt: { $gte: sixMonthsAgo } 
          } 
        },
        {
          $group: {
            _id: { 
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      // Formater les résultats pour la priorité
      const formattedAlertsByPriority = {};
      alertsByPriority.forEach(item => {
        formattedAlertsByPriority[item._id] = item.count;
      });
      
      // Enrichir les données d'équipe avec les noms
      const enrichedAlertsByTeam = await Promise.all(alertsByTeam.map(async item => {
        const team = await Team.findById(item._id);
        return {
          teamId: item._id,
          teamName: team ? team.name : 'Inconnu',
          count: item.count
        };
      }));
      
      // Formater les données par mois
      const formattedAlertsByMonth = alertsByMonth.map(item => ({
        year: item._id.year,
        month: item._id.month,
        count: item.count
      }));
      
      logger.info('Statistiques d\'alertes récupérées avec succès');
      
      res.json({
        success: true,
        data: {
          summary,
          byPriority: formattedAlertsByPriority,
          byTeam: enrichedAlertsByTeam,
          byMonth: formattedAlertsByMonth
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des statistiques d'alertes: ${error.message}`);
      res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la récupération des statistiques d\'alertes',
        message: error.message 
      });
    }
  } catch (error) {
    next(error);
  }
};
