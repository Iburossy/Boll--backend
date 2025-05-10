const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');
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
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    // Construire les paramètres de requête pour le service d'alertes
    const params = {
      category: 'hygiene',
      page,
      limit,
      sort: '-createdAt'
    };
    
    if (status) {
      params.status = status;
    }
    
    if (startDate) {
      params.startDate = startDate;
    }
    
    if (endDate) {
      params.endDate = endDate;
    }
    
    // Appeler le service d'alertes
    try {
      const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts`, {
        params,
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      
      // Enrichir les alertes avec des informations supplémentaires du service d'hygiène
      const enrichedAlerts = await Promise.all(response.data.data.map(async alert => {
        // Vérifier si l'alerte a une inspection associée
        const inspection = await Inspection.findOne({ alertId: alert._id });
        
        // Vérifier si l'alerte est dans une zone à risque
        let zones = [];
        if (alert.location && alert.location.coordinates) {
          const zonesContainingAlert = await Zone.find({
            'boundary.type': 'Polygon'
          });
          
          zones = zonesContainingAlert
            .filter(zone => {
              // Utiliser une fonction simplifiée pour vérifier si le point est dans le polygone
              const point = alert.location.coordinates;
              const polygon = zone.boundary.coordinates[0];
              
              // Algorithme du point-in-polygon
              let inside = false;
              for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i][0], yi = polygon[i][1];
                const xj = polygon[j][0], yj = polygon[j][1];
                
                const intersect = ((yi > point[1]) !== (yj > point[1])) &&
                  (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
                
                if (intersect) inside = !inside;
              }
              
              return inside;
            })
            .map(zone => ({
              id: zone._id,
              name: zone.name,
              riskLevel: zone.riskLevel
            }));
        }
        
        return {
          ...alert,
          inspection: inspection ? {
            id: inspection._id,
            status: inspection.status,
            scheduledDate: inspection.scheduledDate,
            completionDate: inspection.completionDate
          } : null,
          zones
        };
      }));
      
      res.json({
        success: true,
        count: response.data.count,
        total: response.data.total,
        pagination: response.data.pagination,
        data: enrichedAlerts
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des alertes: ${error.message}`);
      res.status(500).json({ error: 'Erreur lors de la récupération des alertes' });
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
    
    // Appeler le service d'alertes
    try {
      const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts/${alertId}`, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      
      const alert = response.data.data;
      
      // Vérifier si l'alerte appartient à la catégorie hygiène
      if (alert.category !== 'hygiene') {
        return res.status(403).json({ error: 'Cette alerte n\'appartient pas au service d\'hygiène' });
      }
      
      // Récupérer l'inspection associée
      const inspection = await Inspection.findOne({ alertId });
      
      // Vérifier si l'alerte est dans une zone à risque
      let zones = [];
      if (alert.location && alert.location.coordinates) {
        const zonesContainingAlert = await Zone.find({
          'boundary.type': 'Polygon'
        });
        
        zones = zonesContainingAlert
          .filter(zone => {
            // Utiliser une fonction simplifiée pour vérifier si le point est dans le polygone
            const point = alert.location.coordinates;
            const polygon = zone.boundary.coordinates[0];
            
            // Algorithme du point-in-polygon
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
              const xi = polygon[i][0], yi = polygon[i][1];
              const xj = polygon[j][0], yj = polygon[j][1];
              
              const intersect = ((yi > point[1]) !== (yj > point[1])) &&
                (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
              
              if (intersect) inside = !inside;
            }
            
            return inside;
          })
          .map(zone => ({
            id: zone._id,
            name: zone.name,
            riskLevel: zone.riskLevel
          }));
      }
      
      // Si l'alerte est dans une zone, mettre à jour le compteur d'alertes de la zone
      if (zones.length > 0 && !alert.zoneUpdated) {
        for (const zone of zones) {
          await Zone.findByIdAndUpdate(zone.id, {
            $inc: { alertCount: 1 }
          });
        }
        
        // Marquer l'alerte comme mise à jour pour éviter les doublons
        try {
          await axios.put(`${config.ALERT_SERVICE_URL}/alerts/${alertId}/metadata`, {
            zoneUpdated: true
          }, {
            headers: {
              'Authorization': req.headers.authorization
            }
          });
        } catch (error) {
          logger.error(`Erreur lors de la mise à jour des métadonnées de l'alerte: ${error.message}`);
        }
      }
      
      res.json({
        success: true,
        data: {
          ...alert,
          inspection: inspection ? {
            id: inspection._id,
            status: inspection.status,
            scheduledDate: inspection.scheduledDate,
            completionDate: inspection.completionDate,
            findings: inspection.findings,
            violationLevel: inspection.violationLevel,
            recommendations: inspection.recommendations
          } : null,
          zones
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération de l'alerte ${alertId}: ${error.message}`);
      res.status(error.response?.status || 500).json({ error: 'Erreur lors de la récupération de l\'alerte' });
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
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Le statut est requis' });
    }
    
    // Vérifier si le statut est valide
    const validStatuses = ['pending', 'received', 'processing', 'resolved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    
    // Appeler le service d'alertes
    try {
      const response = await axios.put(`${config.ALERT_SERVICE_URL}/alerts/${alertId}/status`, {
        status
      }, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      
      // Si le statut est "resolved" ou "rejected", mettre à jour l'inspection associée
      if (status === 'resolved' || status === 'rejected') {
        const inspection = await Inspection.findOne({ alertId });
        
        if (inspection && inspection.status !== 'completed' && inspection.status !== 'cancelled') {
          inspection.status = status === 'resolved' ? 'completed' : 'cancelled';
          inspection.completionDate = new Date();
          
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
        }
      }
      
      res.json({
        success: true,
        data: response.data.data
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
    
    // Appeler le service d'alertes
    try {
      const response = await axios.post(`${config.ALERT_SERVICE_URL}/alerts/${alertId}/feedback`, {
        message,
        fromService: true
      }, {
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      
      res.json({
        success: true,
        data: response.data.data
      });
    } catch (error) {
      logger.error(`Erreur lors de l'ajout du feedback à l'alerte ${alertId}: ${error.message}`);
      res.status(error.response?.status || 500).json({ error: 'Erreur lors de l\'ajout du feedback à l\'alerte' });
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
    // Appeler le service d'alertes
    try {
      const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts/statistics`, {
        params: { category: 'hygiene' },
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      
      res.json({
        success: true,
        data: response.data.data
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des statistiques d'alertes: ${error.message}`);
      res.status(error.response?.status || 500).json({ error: 'Erreur lors de la récupération des statistiques d\'alertes' });
    }
  } catch (error) {
    next(error);
  }
};
