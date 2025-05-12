const Service = require('../models/service.model');
const ServiceStats = require('../models/stats.model');
const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Contrôleur pour la gestion des statistiques des services
 */

/**
 * @desc    Obtenir les statistiques globales de tous les services
 * @route   GET /stats/global
 * @access  Privé (admin, superadmin)
 */
exports.getGlobalStats = async (req, res, next) => {
  try {
    // Récupérer tous les services actifs
    const services = await Service.find({ deletedAt: null });
    
    // Récupérer toutes les statistiques
    const stats = await ServiceStats.find().populate('serviceId', 'name isActive isAvailable');
    
    // Calculer les statistiques globales
    const globalStats = {
      services: {
        total: services.length,
        active: services.filter(s => s.isActive).length,
        available: services.filter(s => s.isAvailable).length,
        unavailable: services.filter(s => !s.isAvailable).length
      },
      alerts: {
        total: stats.reduce((sum, stat) => sum + stat.alertsCount.total, 0),
        pending: stats.reduce((sum, stat) => sum + stat.alertsCount.pending, 0),
        inProgress: stats.reduce((sum, stat) => sum + stat.alertsCount.inProgress, 0),
        resolved: stats.reduce((sum, stat) => sum + stat.alertsCount.resolved, 0),
        rejected: stats.reduce((sum, stat) => sum + stat.alertsCount.rejected, 0)
      },
      serviceDistribution: stats.map(stat => ({
        serviceId: stat.serviceId._id,
        serviceName: stat.serviceId.name,
        isActive: stat.serviceId.isActive,
        isAvailable: stat.serviceId.isAvailable,
        alertsCount: stat.alertsCount.total,
        percentage: stats.reduce((sum, s) => sum + s.alertsCount.total, 0) > 0 
          ? (stat.alertsCount.total / stats.reduce((sum, s) => sum + s.alertsCount.total, 0) * 100).toFixed(2)
          : 0
      }))
    };
    
    res.status(200).json({
      success: true,
      data: globalStats
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques globales: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Obtenir les statistiques d'un service spécifique
 * @route   GET /stats/services/:id
 * @access  Privé (admin, superadmin)
 */
exports.getServiceStats = async (req, res, next) => {
  try {
    // Vérifier si le service existe
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }
    
    // Récupérer les statistiques du service
    const stats = await ServiceStats.findOne({ serviceId: req.params.id });
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: "Statistiques non trouvées pour ce service"
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        service: {
          id: service._id,
          name: service.name,
          isActive: service.isActive,
          isAvailable: service.isAvailable,
          lastPingStatus: service.lastPingStatus
        },
        stats: {
          alertsCount: stats.alertsCount,
          lastActivity: stats.lastActivity,
          dailyStats: stats.dailyStats,
          monthlyStats: stats.monthlyStats
        }
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques du service: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Mettre à jour les statistiques d'un service
 * @route   PUT /stats/services/:id
 * @access  Privé (admin, superadmin)
 */
exports.updateServiceStats = async (req, res, next) => {
  try {
    const { alertsCount } = req.body;
    
    // Vérifier si le service existe
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }
    
    // Récupérer les statistiques du service
    let stats = await ServiceStats.findOne({ serviceId: req.params.id });
    if (!stats) {
      // Créer des statistiques si elles n'existent pas
      stats = await ServiceStats.create({
        serviceId: service._id,
        alertsCount: alertsCount || {
          total: 0,
          pending: 0,
          inProgress: 0,
          resolved: 0,
          rejected: 0
        },
        lastActivity: {
          timestamp: new Date(),
          type: 'service_config_updated',
          details: {
            message: 'Statistiques initialisées'
          }
        }
      });
    } else {
      // Mettre à jour les statistiques existantes
      if (alertsCount) {
        await stats.updateAlertStats(alertsCount);
      }
    }
    
    res.status(200).json({
      success: true,
      message: "Statistiques mises à jour avec succès",
      data: stats
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour des statistiques: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Ajouter une statistique journalière
 * @route   POST /stats/services/:id/daily
 * @access  Privé (admin, superadmin)
 */
exports.addDailyStat = async (req, res, next) => {
  try {
    const { date, alertsReceived, alertsResolved } = req.body;
    
    // Vérifier si le service existe
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }
    
    // Récupérer les statistiques du service
    let stats = await ServiceStats.findOne({ serviceId: req.params.id });
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: "Statistiques non trouvées pour ce service"
      });
    }
    
    // Ajouter la statistique journalière
    await stats.addDailyStat(
      date || new Date(),
      alertsReceived || 0,
      alertsResolved || 0
    );
    
    res.status(200).json({
      success: true,
      message: "Statistique journalière ajoutée avec succès",
      data: stats.dailyStats
    });
  } catch (error) {
    logger.error(`Erreur lors de l'ajout de statistique journalière: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Ajouter une statistique mensuelle
 * @route   POST /stats/services/:id/monthly
 * @access  Privé (admin, superadmin)
 */
exports.addMonthlyStat = async (req, res, next) => {
  try {
    const { year, month, alertsReceived, alertsResolved, responseTimeAvg } = req.body;
    
    // Vérifier les paramètres requis
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "L'année et le mois sont requis"
      });
    }
    
    // Vérifier si le service existe
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }
    
    // Récupérer les statistiques du service
    let stats = await ServiceStats.findOne({ serviceId: req.params.id });
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: "Statistiques non trouvées pour ce service"
      });
    }
    
    // Ajouter la statistique mensuelle
    await stats.addMonthlyStat(
      parseInt(year),
      parseInt(month),
      alertsReceived || 0,
      alertsResolved || 0,
      responseTimeAvg || 0
    );
    
    res.status(200).json({
      success: true,
      message: "Statistique mensuelle ajoutée avec succès",
      data: stats.monthlyStats
    });
  } catch (error) {
    logger.error(`Erreur lors de l'ajout de statistique mensuelle: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Récupérer les statistiques de tous les services
 * @route   GET /stats/services
 * @access  Privé (admin, superadmin)
 */
exports.getAllServicesStats = async (req, res, next) => {
  try {
    // Récupérer toutes les statistiques avec les informations des services
    const stats = await ServiceStats.find()
      .populate('serviceId', 'name isActive isAvailable lastPingStatus')
      .sort({ 'alertsCount.total': -1 });
    
    // Formater les données
    const formattedStats = stats.map(stat => ({
      serviceId: stat.serviceId._id,
      serviceName: stat.serviceId.name,
      isActive: stat.serviceId.isActive,
      isAvailable: stat.serviceId.isAvailable,
      lastPingStatus: stat.serviceId.lastPingStatus,
      alertsCount: stat.alertsCount,
      lastActivity: stat.lastActivity
    }));
    
    res.status(200).json({
      success: true,
      count: formattedStats.length,
      data: formattedStats
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques de tous les services: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Récupérer les statistiques par période (jour, semaine, mois, année)
 * @route   GET /stats/period/:period
 * @access  Privé (admin, superadmin)
 */
exports.getStatsByPeriod = async (req, res, next) => {
  try {
    const { period } = req.params;
    const validPeriods = ['day', 'week', 'month', 'year'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Période invalide. Utilisez 'day', 'week', 'month' ou 'year'"
      });
    }
    
    // Calculer la date de début en fonction de la période
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
    
    // Récupérer les statistiques pour la période spécifiée
    const stats = await ServiceStats.find();
    
    // Filtrer les statistiques journalières pour la période spécifiée
    const filteredStats = stats.map(stat => {
      const filteredDailyStats = stat.dailyStats.filter(
        daily => new Date(daily.date) >= startDate
      );
      
      return {
        serviceId: stat.serviceId,
        dailyStats: filteredDailyStats,
        totalAlertsReceived: filteredDailyStats.reduce((sum, daily) => sum + daily.alertsReceived, 0),
        totalAlertsResolved: filteredDailyStats.reduce((sum, daily) => sum + daily.alertsResolved, 0)
      };
    });
    
    // Récupérer les informations des services
    const services = await Service.find({ _id: { $in: stats.map(s => s.serviceId) } });
    
    // Combiner les données
    const result = filteredStats.map(stat => {
      const service = services.find(s => s._id.toString() === stat.serviceId.toString());
      return {
        serviceId: stat.serviceId,
        serviceName: service ? service.name : 'Service inconnu',
        isActive: service ? service.isActive : false,
        isAvailable: service ? service.isAvailable : false,
        totalAlertsReceived: stat.totalAlertsReceived,
        totalAlertsResolved: stat.totalAlertsResolved,
        dailyStats: stat.dailyStats
      };
    });
    
    res.status(200).json({
      success: true,
      period,
      startDate,
      endDate: new Date(),
      data: result
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques par période: ${error.message}`);
    next(error);
  }
};
