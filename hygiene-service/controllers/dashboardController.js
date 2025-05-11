const Inspection = require('../models/inspection');
const Zone = require('../models/zone');
const Team = require('../models/team');
const Alert = require('../models/alert');
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
    // Récupérer les statistiques des alertes directement depuis notre modèle local
    const alertStats = {
      total: await Alert.countDocuments({ category: 'hygiene' }),
      pending: await Alert.countDocuments({ category: 'hygiene', status: 'new' }),
      processing: await Alert.countDocuments({ category: 'hygiene', status: { $in: ['assigned', 'in_progress'] } }),
      resolved: await Alert.countDocuments({ category: 'hygiene', status: 'resolved' }),
      rejected: await Alert.countDocuments({ category: 'hygiene', status: 'closed' })
    };
    
    logger.info('Statistiques d\'alertes récupérées depuis le modèle local');
    
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
    // Récupérer les statistiques des alertes directement depuis notre modèle local
    try {
      // Calculer les statistiques directement depuis notre base de données locale
      const totalAlerts = await Alert.countDocuments({ category: 'hygiene' });
      
      // Compter les alertes par statut
      const alertsByStatus = await Alert.aggregate([
        { $match: { category: 'hygiene' } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      // Compter les alertes par priorité
      const alertsByPriority = await Alert.aggregate([
        { $match: { category: 'hygiene' } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]);
      
      // Formater les résultats
      const formattedAlertsByStatus = {};
      alertsByStatus.forEach(item => {
        formattedAlertsByStatus[item._id] = item.count;
      });
      
      const formattedAlertsByPriority = {};
      alertsByPriority.forEach(item => {
        formattedAlertsByPriority[item._id] = item.count;
      });
      
      logger.info('Statistiques d\'alertes récupérées depuis le modèle local pour le tableau de bord');
      
      return res.json({
        success: true,
        data: {
          total: totalAlerts,
          byStatus: formattedAlertsByStatus,
          byPriority: formattedAlertsByPriority
        }
      });
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
    // Récupérer les alertes avec des coordonnées géographiques
    const alerts = await Alert.find({
      category: 'hygiene',
      'location.coordinates': { $exists: true, $ne: null }
    }).select('location priority status');
    
    logger.info('Données de carte de chaleur récupérées depuis le modèle local');
    
    // Formater les données pour la carte de chaleur
    const heatmapData = alerts.map(alert => ({
      lat: alert.location.coordinates[1],
      lng: alert.location.coordinates[0],
      weight: getPriorityWeight(alert.priority),
      status: alert.status
    }));
    
    return res.json({
      success: true,
      data: heatmapData
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des données de carte de chaleur: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
};

/**
 * Récupérer les alertes récentes
 * @route GET /dashboard/recent-alerts
 * @access Privé
 */
exports.getRecentAlerts = async (req, res, next) => {
  try {
    // Récupérer les alertes récentes directement depuis notre modèle local
    const recentAlerts = await Alert.find({ category: 'hygiene' })
      .sort({ createdAt: -1 })
      .limit(5);
    
    logger.info('Alertes récentes récupérées depuis le modèle local');
    
    // Si aucune alerte n'est trouvée, renvoyer un tableau vide
    if (!recentAlerts || recentAlerts.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    return res.json({
      success: true,
      data: recentAlerts
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des alertes récentes: ${error.message}`);
    
    // En cas d'erreur, renvoyer un tableau vide
    return res.json({
      success: false,
      error: error.message,
      data: []
    });
  }
};

/**
 * Récupérer la carte de chaleur des alertes
 * @route GET /dashboard/heatmap
 * @access Privé
 */
exports.getAlertHeatmap = async (req, res, next) => {
  try {
    // Récupérer les alertes avec des coordonnées géographiques
    const alerts = await Alert.find({
      category: 'hygiene',
      'location.coordinates': { $exists: true, $ne: null }
    }).select('location priority status');
    
    logger.info('Données de carte de chaleur récupérées depuis le modèle local');
    
    // Formater les données pour la carte de chaleur
    const heatmapData = alerts.map(alert => ({
      lat: alert.location.coordinates[1],
      lng: alert.location.coordinates[0],
      weight: getPriorityWeight(alert.priority),
      status: alert.status
    }));
    
    return res.json({
      success: true,
      data: heatmapData
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des données de carte de chaleur: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Fonction utilitaire pour obtenir le poids en fonction de la priorité
function getPriorityWeight(priority) {
  switch (priority) {
    case 'critical': return 10;
    case 'high': return 7;
    case 'medium': return 5;
    case 'low': return 3;
    default: return 1;
  }
}

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
    
    // Statistiques des alertes pour la période directement depuis notre modèle local
    let alertStats = {
      total: 0,
      resolved: 0
    };
    
    try {
      // Compter le nombre total d'alertes pour la période
      alertStats.total = await Alert.countDocuments({
        category: 'hygiene',
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      });
      
      // Compter le nombre d'alertes résolues pour la période
      alertStats.resolved = await Alert.countDocuments({
        category: 'hygiene',
        status: 'resolved',
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      });
      
      logger.info(`Statistiques d'alertes pour la période ${period} récupérées depuis le modèle local`);
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
