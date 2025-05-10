const Inspection = require('../models/inspection');
const Zone = require('../models/zone');
const Team = require('../models/team');
const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Contrôleur pour le tableau de bord du service d'hygiène
 */

/**
 * Récupérer le résumé global du tableau de bord
 * @route GET /dashboard/summary
 * @access Privé
 */
exports.getSummary = async (req, res, next) => {
  try {
    // Récupérer les statistiques des alertes
    let alertStats = {
      total: 0,
      pending: 0,
      processing: 0,
      resolved: 0,
      rejected: 0
    };
    
    // En mode développement, simuler les données d'alertes si le service n'est pas disponible
    if (process.env.NODE_ENV === 'development') {
      try {
        const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts/statistics`, {
          params: { category: 'hygiene' },
          headers: { 'Authorization': req.headers.authorization }
        });
        
        if (response.data && response.data.success) {
          alertStats = response.data.data.summary || alertStats;
        }
      } catch (error) {
        logger.warn(`Service d'alertes non disponible, utilisation de données simulées: ${error.message}`);
        // Simuler des données d'alertes pour le développement
        alertStats = {
          total: 15,
          pending: 5,
          processing: 4,
          resolved: 5,
          rejected: 1
        };
      }
    } else {
      // En production, essayer de récupérer les vraies données
      try {
        const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts/statistics`, {
          params: { category: 'hygiene' },
          headers: { 'Authorization': req.headers.authorization }
        });
        
        if (response.data && response.data.success) {
          alertStats = response.data.data.summary || alertStats;
        }
      } catch (error) {
        logger.error(`Erreur lors de la récupération des statistiques d'alertes: ${error.message}`);
      }
    }
    
    // Statistiques des inspections
    const inspectionStats = {
      total: await Inspection.countDocuments(),
      scheduled: await Inspection.countDocuments({ status: 'scheduled' }),
      inProgress: await Inspection.countDocuments({ status: 'in-progress' }),
      completed: await Inspection.countDocuments({ status: 'completed' }),
      cancelled: await Inspection.countDocuments({ status: 'cancelled' }),
      overdueCount: await Inspection.countDocuments({
        status: { $in: ['scheduled', 'in-progress'] },
        scheduledDate: { $lt: new Date() }
      })
    };
    
    // Calculer le taux de complétion
    inspectionStats.completionRate = inspectionStats.total > 0 
      ? (inspectionStats.completed / inspectionStats.total) * 100 
      : 0;
    
    // Statistiques des zones
    const zoneStats = {
      total: await Zone.countDocuments(),
      critical: await Zone.countDocuments({ riskLevel: 'critical' }),
      high: await Zone.countDocuments({ riskLevel: 'high' }),
      medium: await Zone.countDocuments({ riskLevel: 'medium' }),
      low: await Zone.countDocuments({ riskLevel: 'low' }),
      withoutTeam: await Zone.countDocuments({ responsibleTeam: { $exists: false } })
    };
    
    // Statistiques des équipes
    const teamStats = {
      total: await Team.countDocuments(),
      activeTeams: await Team.countDocuments({ activeInspections: { $gt: 0 } }),
      totalMembers: 0
    };
    
    // Calculer le nombre total de membres
    const teams = await Team.find();
    teamStats.totalMembers = teams.reduce((total, team) => total + team.members.length, 0);
    
    // Récupérer les inspections à venir pour aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayInspections = await Inspection.countDocuments({
      scheduledDate: { $gte: today, $lt: tomorrow },
      status: { $in: ['scheduled', 'in-progress'] }
    });
    
    // Récupérer les zones nécessitant une inspection
    const zonesNeedingInspection = await Zone.find().lean();
    const needInspection = zonesNeedingInspection.filter(zone => {
      return !zone.lastInspection || 
        ((new Date() - new Date(zone.lastInspection)) / (1000 * 60 * 60 * 24) > 30);
    });
    
    res.json({
      success: true,
      data: {
        alerts: alertStats,
        inspections: inspectionStats,
        zones: zoneStats,
        teams: teamStats,
        today: {
          date: today.toISOString().split('T')[0],
          inspections: todayInspections,
          zonesNeedingInspection: needInspection.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les statistiques des alertes
 * @route GET /dashboard/alerts
 * @access Privé
 */
exports.getAlertStats = async (req, res, next) => {
  try {
    // Récupérer les statistiques des alertes via le service d'alertes
    try {
      const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts/statistics`, {
        params: { category: 'hygiene' },
        headers: { 'Authorization': req.headers.authorization }
      });
      
      if (response.data && response.data.success) {
        return res.json({
          success: true,
          data: response.data.data
        });
      }
      
      throw new Error('Données non disponibles');
    } catch (error) {
      logger.error(`Erreur lors de la récupération des statistiques d'alertes: ${error.message}`);
      
      // Retourner une réponse par défaut en cas d'erreur
      res.json({
        success: false,
        error: 'Impossible de récupérer les statistiques d\'alertes',
        data: {
          summary: {
            total: 0,
            pending: 0,
            processing: 0,
            resolved: 0,
            rejected: 0
          },
          byCategory: [],
          byMonth: []
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les statistiques des inspections
 * @route GET /dashboard/inspections
 * @access Privé
 */
exports.getInspectionStats = async (req, res, next) => {
  try {
    // Statistiques globales
    const summary = {
      total: await Inspection.countDocuments(),
      scheduled: await Inspection.countDocuments({ status: 'scheduled' }),
      inProgress: await Inspection.countDocuments({ status: 'in-progress' }),
      completed: await Inspection.countDocuments({ status: 'completed' }),
      cancelled: await Inspection.countDocuments({ status: 'cancelled' }),
      overdue: await Inspection.countDocuments({
        status: { $in: ['scheduled', 'in-progress'] },
        scheduledDate: { $lt: new Date() }
      })
    };
    
    // Calculer le taux de complétion
    summary.completionRate = summary.total > 0 
      ? (summary.completed / summary.total) * 100 
      : 0;
    
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
    
    const monthlyStats = await Inspection.aggregate([
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
    
    // Inspections à venir
    const upcoming = await Inspection.find({
      status: { $in: ['scheduled', 'in-progress'] },
      scheduledDate: { $gte: new Date() }
    })
    .sort({ scheduledDate: 1 })
    .limit(5);
    
    // Inspections en retard
    const overdue = await Inspection.find({
      status: { $in: ['scheduled', 'in-progress'] },
      scheduledDate: { $lt: new Date() }
    })
    .sort({ scheduledDate: 1 })
    .limit(5);
    
    res.json({
      success: true,
      data: {
        summary,
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
        monthlyStats: monthlyStats.map(stat => ({
          year: stat._id.year,
          month: stat._id.month,
          count: stat.count,
          completed: stat.completed
        })),
        upcoming: upcoming.map(inspection => ({
          id: inspection._id,
          scheduledDate: inspection.scheduledDate,
          status: inspection.status,
          teamId: inspection.teamId,
          alertId: inspection.alertId
        })),
        overdue: overdue.map(inspection => ({
          id: inspection._id,
          scheduledDate: inspection.scheduledDate,
          status: inspection.status,
          teamId: inspection.teamId,
          alertId: inspection.alertId,
          daysOverdue: Math.ceil((new Date() - new Date(inspection.scheduledDate)) / (1000 * 60 * 60 * 24))
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les performances des équipes
 * @route GET /dashboard/teams
 * @access Privé (Superviseur)
 */
exports.getTeamPerformance = async (req, res, next) => {
  try {
    // Récupérer toutes les équipes
    const teams = await Team.find();
    
    // Pour chaque équipe, récupérer les statistiques d'inspection
    const teamPerformance = await Promise.all(teams.map(async team => {
      // Inspections totales
      const totalInspections = await Inspection.countDocuments({ teamId: team._id });
      
      // Inspections complétées
      const completedInspections = await Inspection.countDocuments({ 
        teamId: team._id,
        status: 'completed'
      });
      
      // Inspections en retard
      const overdueInspections = await Inspection.countDocuments({
        teamId: team._id,
        status: { $in: ['scheduled', 'in-progress'] },
        scheduledDate: { $lt: new Date() }
      });
      
      // Temps moyen de complétion
      const completionTimeData = await Inspection.aggregate([
        { 
          $match: { 
            teamId: team._id.toString(),
            status: 'completed',
            completionDate: { $exists: true, $ne: null }
          } 
        },
        { 
          $project: { 
            completionTime: { 
              $divide: [
                { $subtract: ['$completionDate', '$scheduledDate'] },
                86400000 // Convertir en jours
              ]
            }
          } 
        },
        { 
          $group: { 
            _id: null,
            avgCompletionTime: { $avg: '$completionTime' }
          } 
        }
      ]);
      
      const avgCompletionTime = completionTimeData.length > 0 
        ? parseFloat(completionTimeData[0].avgCompletionTime.toFixed(1))
        : null;
      
      // Niveaux de violation
      const violationStats = await Inspection.aggregate([
        { $match: { teamId: team._id.toString(), status: 'completed' } },
        { $group: { _id: '$violationLevel', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      // Zones assignées
      const assignedZones = await Zone.find({ responsibleTeam: team._id });
      
      return {
        id: team._id,
        name: team.name,
        specialization: team.specialization,
        memberCount: team.members.length,
        activeInspections: team.activeInspections,
        completedInspections: team.completedInspections,
        stats: {
          totalInspections,
          completedInspections,
          overdueInspections,
          completionRate: totalInspections > 0 ? (completedInspections / totalInspections) * 100 : 0,
          avgCompletionTime,
          violationStats: violationStats.map(stat => ({
            level: stat._id,
            count: stat.count
          }))
        },
        zones: assignedZones.map(zone => ({
          id: zone._id,
          name: zone.name,
          riskLevel: zone.riskLevel
        }))
      };
    }));
    
    res.json({
      success: true,
      count: teamPerformance.length,
      data: teamPerformance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer la carte de chaleur des alertes
 * @route GET /dashboard/heatmap
 * @access Privé
 */
exports.getAlertHeatmap = async (req, res, next) => {
  try {
    // Récupérer les alertes via le service d'alertes
    try {
      const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts/heatmap`, {
        params: { category: 'hygiene' },
        headers: { 'Authorization': req.headers.authorization }
      });
      
      if (response.data && response.data.success) {
        return res.json({
          success: true,
          data: response.data.data
        });
      }
      
      throw new Error('Données non disponibles');
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la carte de chaleur: ${error.message}`);
      
      // Retourner une réponse par défaut en cas d'erreur
      res.json({
        success: false,
        error: 'Impossible de récupérer la carte de chaleur',
        data: []
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les alertes récentes
 * @route GET /dashboard/recent-alerts
 * @access Privé
 */
exports.getRecentAlerts = async (req, res, next) => {
  try {
    // En mode développement, simuler les données d'alertes si le service n'est pas disponible
    if (process.env.NODE_ENV === 'development') {
      try {
        const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts`, {
          params: { 
            category: 'hygiene',
            limit: 5,
            sort: '-createdAt'
          },
          headers: { 'Authorization': req.headers.authorization }
        });
        
        if (response.data && response.data.success) {
          return res.json({
            success: true,
            data: response.data.data
          });
        }
        
        throw new Error('Données non disponibles');
      } catch (error) {
        logger.warn(`Service d'alertes non disponible, utilisation de données simulées: ${error.message}`);
        
        // Simuler des données d'alertes pour le développement
        const mockAlerts = [
          {
            _id: '60d21b4667d0d8992e610c85',
            title: 'Déchets sur la voie publique',
            description: 'Accumulation de déchets près du marché de Médina',
            category: 'hygiene',
            location: {
              type: 'Point',
              coordinates: [14.6937, -17.4386]
            },
            status: 'pending',
            priority: 'high',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 heures avant
            reportedBy: 'Citoyen anonyme'
          },
          {
            _id: '60d21b4667d0d8992e610c86',
            title: 'Eau stagnante',
            description: 'Eau stagnante depuis plusieurs jours, risque sanitaire',
            category: 'hygiene',
            location: {
              type: 'Point',
              coordinates: [14.7037, -17.4286]
            },
            status: 'processing',
            priority: 'medium',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 jour avant
            reportedBy: 'Mamadou Diallo'
          },
          {
            _id: '60d21b4667d0d8992e610c87',
            title: 'Problème dégout',
            description: 'Dégout bouché causant des odeurs nauséabondes',
            category: 'hygiene',
            location: {
              type: 'Point',
              coordinates: [14.7137, -17.4186]
            },
            status: 'pending',
            priority: 'high',
            createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes avant
            reportedBy: 'Fatou Sow'
          }
        ];
        
        return res.json({
          success: true,
          data: mockAlerts
        });
      }
    } else {
      // En production, essayer de récupérer les vraies données
      try {
        const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts`, {
          params: { 
            category: 'hygiene',
            limit: 5,
            sort: '-createdAt'
          },
          headers: { 'Authorization': req.headers.authorization }
        });
        
        if (response.data && response.data.success) {
          return res.json({
            success: true,
            data: response.data.data
          });
        }
        
        throw new Error('Données non disponibles');
      } catch (error) {
        logger.error(`Erreur lors de la récupération des alertes récentes: ${error.message}`);
        
        // Retourner une réponse par défaut en cas d'erreur
        return res.json({
          success: false,
          error: 'Impossible de récupérer les alertes récentes',
          data: []
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les inspections à venir
 * @route GET /dashboard/upcoming-inspections
 * @access Privé
 */
exports.getUpcomingInspections = async (req, res, next) => {
  try {
    // Récupérer les inspections à venir
    const inspections = await Inspection.find({
      status: { $in: ['scheduled', 'in-progress'] },
      scheduledDate: { $gte: new Date() }
    })
    .sort({ scheduledDate: 1 })
    .limit(5);
    
    // Enrichir les données avec les informations des équipes
    const enrichedInspections = await Promise.all(inspections.map(async inspection => {
      let teamData = null;
      
      if (inspection.teamId) {
        const team = await Team.findById(inspection.teamId);
        if (team) {
          teamData = {
            id: team._id,
            name: team.name,
            specialization: team.specialization
          };
        }
      }
      
      return {
        id: inspection._id,
        alertId: inspection.alertId,
        scheduledDate: inspection.scheduledDate,
        status: inspection.status,
        team: teamData,
        location: inspection.location
      };
    }));
    
    res.json({
      success: true,
      count: enrichedInspections.length,
      data: enrichedInspections
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les zones à risque élevé
 * @route GET /dashboard/high-risk-zones
 * @access Privé
 */
exports.getHighRiskZones = async (req, res, next) => {
  try {
    // Récupérer les zones à risque élevé ou critique
    const zones = await Zone.find({
      riskLevel: { $in: ['high', 'critical'] }
    })
    .sort({ riskLevel: -1, alertCount: -1 })
    .limit(5);
    
    // Enrichir les données avec les informations des équipes responsables
    const enrichedZones = await Promise.all(zones.map(async zone => {
      let teamData = null;
      
      if (zone.responsibleTeam) {
        const team = await Team.findById(zone.responsibleTeam);
        if (team) {
          teamData = {
            id: team._id,
            name: team.name,
            specialization: team.specialization
          };
        }
      }
      
      return {
        id: zone._id,
        name: zone.name,
        riskLevel: zone.riskLevel,
        alertCount: zone.alertCount,
        lastInspection: zone.lastInspection,
        needsInspection: !zone.lastInspection || 
          ((new Date() - new Date(zone.lastInspection)) / (1000 * 60 * 60 * 24) > 30),
        responsibleTeam: teamData,
        boundary: zone.boundary
      };
    }));
    
    res.json({
      success: true,
      count: enrichedZones.length,
      data: enrichedZones
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les statistiques par période
 * @route GET /dashboard/stats/:period
 * @access Privé
 */
exports.getStatsByPeriod = async (req, res, next) => {
  try {
    const { period } = req.params;
    let startDate, endDate;
    const now = new Date();
    
    // Déterminer la période
    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const dayOfWeek = now.getDay(); // 0 = dimanche, 1 = lundi, etc.
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuster pour commencer le lundi
        startDate = new Date(now.getFullYear(), now.getMonth(), diff);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 0);
        break;
      default:
        return res.status(400).json({ error: 'Période invalide. Utilisez day, week, month ou year.' });
    }
    
    // Statistiques des inspections pour la période
    const inspectionStats = {
      total: await Inspection.countDocuments({
        scheduledDate: { $gte: startDate, $lte: endDate }
      }),
      completed: await Inspection.countDocuments({
        status: 'completed',
        completionDate: { $gte: startDate, $lte: endDate }
      }),
      scheduled: await Inspection.countDocuments({
        status: 'scheduled',
        scheduledDate: { $gte: startDate, $lte: endDate }
      })
    };
    
    // Statistiques des alertes pour la période
    let alertStats = {
      total: 0,
      resolved: 0
    };
    
    try {
      const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts/statistics`, {
        params: { 
          category: 'hygiene',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        headers: { 'Authorization': req.headers.authorization }
      });
      
      if (response.data && response.data.success) {
        alertStats = response.data.data.period || alertStats;
      }
    } catch (error) {
      logger.error(`Erreur lors de la récupération des statistiques d'alertes pour la période: ${error.message}`);
    }
    
    res.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        inspections: inspectionStats,
        alerts: alertStats
      }
    });
  } catch (error) {
    next(error);
  }
};
