const Zone = require('../models/zone');
const Team = require('../models/team');
const Inspection = require('../models/inspection');
const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');
const geoUtils = require('../utils/geoUtils');

/**
 * Contrôleur pour la gestion des zones à risque d'hygiène
 */

/**
 * Créer une nouvelle zone à risque
 * @route POST /zones
 * @access Privé (Superviseur)
 */
exports.createZone = async (req, res, next) => {
  try {
    const { name, description, riskLevel, boundary, responsibleTeam } = req.body;
    
    // Vérifier si une zone avec le même nom existe déjà
    const existingZone = await Zone.findOne({ name });
    if (existingZone) {
      return res.status(400).json({ error: 'Une zone avec ce nom existe déjà' });
    }
    
    // Vérifier si l'équipe responsable existe
    if (responsibleTeam) {
      const team = await Team.findById(responsibleTeam);
      if (!team) {
        return res.status(404).json({ error: 'Équipe responsable non trouvée' });
      }
    }
    
    // Créer la zone
    const zone = new Zone({
      name,
      description,
      riskLevel,
      boundary,
      responsibleTeam
    });
    
    await zone.save();
    
    // Si une équipe est assignée, mettre à jour ses zones assignées
    if (responsibleTeam) {
      await Team.findByIdAndUpdate(responsibleTeam, {
        $addToSet: { assignedZones: zone._id }
      });
    }
    
    res.status(201).json({
      success: true,
      data: zone
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer toutes les zones avec filtrage et pagination
 * @route GET /zones
 * @access Privé
 */
exports.getZones = async (req, res, next) => {
  try {
    const { riskLevel, responsibleTeam, page = 1, limit = 10 } = req.query;
    
    // Construire le filtre
    const filter = {};
    
    if (riskLevel) {
      filter.riskLevel = riskLevel;
    }
    
    if (responsibleTeam) {
      filter.responsibleTeam = responsibleTeam;
    }
    
    // Calculer le nombre total de zones correspondant au filtre
    const total = await Zone.countDocuments(filter);
    
    // Récupérer les zones avec pagination
    const zones = await Zone.find(filter)
      .sort({ riskLevel: -1, alertCount: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: zones.length,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      },
      data: zones
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les hotspots (zones à forte densité d'alertes)
 * @route GET /zones/hotspots
 * @access Privé
 */
exports.getHotspots = async (req, res, next) => {
  try {
    const { radius = 1, minAlerts = 5 } = req.query;
    
    // Récupérer les alertes d'hygiène via le service d'alertes
    let alertsData = [];
    try {
      const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts`, {
        params: {
          category: 'hygiene',
          limit: 1000
        },
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      
      alertsData = response.data.data || [];
    } catch (error) {
      logger.error(`Erreur lors de la récupération des alertes: ${error.message}`);
      alertsData = [];
    }
    
    // Extraire les coordonnées des alertes
    const alertPoints = alertsData
      .filter(alert => alert.location && alert.location.coordinates)
      .map(alert => alert.location.coordinates);
    
    // Trouver les hotspots
    const hotspots = geoUtils.findHotspots(alertPoints, parseFloat(radius), parseInt(minAlerts));
    
    // Pour chaque hotspot, vérifier s'il est dans une zone existante
    const hotspotsWithZones = await Promise.all(hotspots.map(async hotspot => {
      const zones = await Zone.find({
        'boundary.type': 'Polygon'
      });
      
      const containingZones = zones.filter(zone => 
        geoUtils.isPointInPolygon(hotspot.center, zone.boundary.coordinates[0])
      );
      
      return {
        ...hotspot,
        zones: containingZones.map(zone => ({
          id: zone._id,
          name: zone.name,
          riskLevel: zone.riskLevel
        }))
      };
    }));
    
    res.json({
      success: true,
      count: hotspotsWithZones.length,
      data: hotspotsWithZones
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les détails d'une zone
 * @route GET /zones/:zoneId
 * @access Privé
 */
exports.getZoneDetails = async (req, res, next) => {
  try {
    const zone = await Zone.findById(req.params.zoneId);
    
    if (!zone) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }
    
    // Récupérer l'équipe responsable si elle existe
    let responsibleTeamData = null;
    if (zone.responsibleTeam) {
      const team = await Team.findById(zone.responsibleTeam);
      if (team) {
        responsibleTeamData = {
          id: team._id,
          name: team.name,
          supervisorId: team.supervisorId,
          memberCount: team.members.length,
          specialization: team.specialization
        };
      }
    }
    
    // Calculer la superficie approximative
    const area = zone.calculateArea();
    
    // Vérifier si la zone nécessite une inspection
    const needsInspection = zone.needsInspection();
    
    res.json({
      success: true,
      data: {
        ...zone.toObject(),
        responsibleTeam: responsibleTeamData,
        area,
        needsInspection
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour une zone
 * @route PUT /zones/:zoneId
 * @access Privé (Superviseur)
 */
exports.updateZone = async (req, res, next) => {
  try {
    const { name, description, riskLevel, boundary, responsibleTeam } = req.body;
    
    // Vérifier si la zone existe
    const zone = await Zone.findById(req.params.zoneId);
    
    if (!zone) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }
    
    // Vérifier si le nom est déjà utilisé par une autre zone
    if (name && name !== zone.name) {
      const existingZone = await Zone.findOne({ name });
      if (existingZone) {
        return res.status(400).json({ error: 'Une zone avec ce nom existe déjà' });
      }
    }
    
    // Vérifier si l'équipe responsable existe
    if (responsibleTeam && responsibleTeam !== zone.responsibleTeam) {
      const team = await Team.findById(responsibleTeam);
      if (!team) {
        return res.status(404).json({ error: 'Équipe responsable non trouvée' });
      }
      
      // Mettre à jour l'ancienne équipe si elle existe
      if (zone.responsibleTeam) {
        await Team.findByIdAndUpdate(zone.responsibleTeam, {
          $pull: { assignedZones: zone._id }
        });
      }
      
      // Mettre à jour la nouvelle équipe
      await Team.findByIdAndUpdate(responsibleTeam, {
        $addToSet: { assignedZones: zone._id }
      });
    }
    
    // Mettre à jour la zone
    zone.name = name || zone.name;
    zone.description = description || zone.description;
    zone.riskLevel = riskLevel || zone.riskLevel;
    
    if (boundary) {
      zone.boundary = boundary;
    }
    
    zone.responsibleTeam = responsibleTeam || zone.responsibleTeam;
    
    await zone.save();
    
    res.json({
      success: true,
      data: zone
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assigner une zone à une équipe
 * @route POST /zones/:zoneId/assign
 * @access Privé (Superviseur)
 */
exports.assignZoneToTeam = async (req, res, next) => {
  try {
    const { teamId } = req.body;
    
    if (!teamId) {
      return res.status(400).json({ error: 'ID de l\'équipe requis' });
    }
    
    // Vérifier si la zone existe
    const zone = await Zone.findById(req.params.zoneId);
    
    if (!zone) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }
    
    // Vérifier si l'équipe existe
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Équipe non trouvée' });
    }
    
    // Mettre à jour l'ancienne équipe si elle existe
    if (zone.responsibleTeam) {
      await Team.findByIdAndUpdate(zone.responsibleTeam, {
        $pull: { assignedZones: zone._id }
      });
    }
    
    // Mettre à jour la zone
    zone.responsibleTeam = teamId;
    await zone.save();
    
    // Mettre à jour l'équipe
    await Team.findByIdAndUpdate(teamId, {
      $addToSet: { assignedZones: zone._id }
    });
    
    res.json({
      success: true,
      data: {
        zoneId: zone._id,
        zoneName: zone.name,
        teamId: team._id,
        teamName: team.name
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les alertes dans une zone
 * @route GET /zones/:zoneId/alerts
 * @access Privé
 */
exports.getZoneAlerts = async (req, res, next) => {
  try {
    // Vérifier si la zone existe
    const zone = await Zone.findById(req.params.zoneId);
    
    if (!zone) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }
    
    // Récupérer les alertes via le service d'alertes
    try {
      // Convertir les coordonnées du polygone en format compatible avec l'API d'alertes
      const boundaryCoordinates = zone.boundary.coordinates[0];
      
      const response = await axios.get(`${config.ALERT_SERVICE_URL}/alerts/in-area`, {
        params: {
          category: 'hygiene',
          polygon: JSON.stringify(boundaryCoordinates)
        },
        headers: {
          'Authorization': req.headers.authorization
        }
      });
      
      res.json({
        success: true,
        count: response.data.count,
        data: response.data.data
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des alertes dans la zone ${zone._id}: ${error.message}`);
      res.status(500).json({ error: 'Erreur lors de la récupération des alertes' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les inspections dans une zone
 * @route GET /zones/:zoneId/inspections
 * @access Privé
 */
exports.getZoneInspections = async (req, res, next) => {
  try {
    // Vérifier si la zone existe
    const zone = await Zone.findById(req.params.zoneId);
    
    if (!zone) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }
    
    // Récupérer les inspections dans la zone
    const inspections = await Inspection.find({
      'location.type': 'Point',
      'location.coordinates': {
        $geoWithin: {
          $geometry: zone.boundary
        }
      }
    }).sort({ scheduledDate: -1 });
    
    res.json({
      success: true,
      count: inspections.length,
      data: inspections
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les statistiques des zones
 * @route GET /zones/statistics
 * @access Privé
 */
exports.getZoneStatistics = async (req, res, next) => {
  try {
    // Statistiques par niveau de risque
    const riskLevelStats = await Zone.aggregate([
      { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Zones avec le plus d'alertes
    const topAlertZones = await Zone.find()
      .sort({ alertCount: -1 })
      .limit(5);
    
    // Statistiques par équipe responsable
    const teamStats = await Zone.aggregate([
      { $match: { responsibleTeam: { $exists: true, $ne: null } } },
      { $group: { _id: '$responsibleTeam', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Zones nécessitant une inspection
    const zonesNeedingInspection = await Zone.find().lean();
    const needInspection = zonesNeedingInspection.filter(zone => {
      return !zone.lastInspection || 
        ((new Date() - new Date(zone.lastInspection)) / (1000 * 60 * 60 * 24) > 30);
    });
    
    res.json({
      success: true,
      data: {
        total: await Zone.countDocuments(),
        riskLevelStats: riskLevelStats.map(stat => ({
          level: stat._id,
          count: stat.count
        })),
        topAlertZones: topAlertZones.map(zone => ({
          id: zone._id,
          name: zone.name,
          riskLevel: zone.riskLevel,
          alertCount: zone.alertCount
        })),
        teamStats: await Promise.all(teamStats.map(async stat => {
          const team = await Team.findById(stat._id);
          return {
            teamId: stat._id,
            teamName: team ? team.name : 'Équipe inconnue',
            zoneCount: stat.count
          };
        })),
        zonesNeedingInspection: needInspection.length,
        zonesWithoutTeam: await Zone.countDocuments({ responsibleTeam: { $exists: false } })
      }
    });
  } catch (error) {
    next(error);
  }
};
