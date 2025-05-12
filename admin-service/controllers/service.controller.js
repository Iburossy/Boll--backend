const Service = require('../models/service.model');
const ServiceStats = require('../models/stats.model');
const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Contrôleur pour la gestion des services partenaires
 */

/**
 * @desc    Enregistrer un service existant
 * @route   POST /services
 * @access  Privé (admin, superadmin)
 */
exports.registerService = async (req, res, next) => {
  try {
    const { name, description, logo, apiUrl, category, contactEmail, contactPhone, authType, authConfig } = req.body;

    // Vérifier si le service est déjà enregistré
    const serviceExists = await Service.findOne({ name });
    if (serviceExists) {
      return res.status(400).json({
        success: false,
        message: "Ce service est déjà enregistré dans le système"
      });
    }

    // Vérifier si l'URL de l'API est valide
    try {
      // Tester la connexion au service
      const healthEndpoint = `${apiUrl}/health`;
      await axios.get(healthEndpoint, { timeout: 5000 });
    } catch (error) {
      logger.warn(`L'URL du service ${name} n'est pas accessible: ${error.message}`);
      // On continue malgré l'erreur, le service sera marqué comme indisponible
    }

    // Enregistrer le service existant
    const service = await Service.create({
      name,
      description,
      logo,
      apiUrl,
      category: category || 'public',
      contactEmail,
      contactPhone,
      authType: authType || 'jwt',
      authConfig: authConfig || {}
    });

    // Créer les statistiques initiales pour ce service
    const stats = await ServiceStats.create({
      serviceId: service._id,
      alertsCount: {
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
          message: 'Service enregistré'
        }
      }
    });

    // Vérifier la disponibilité du service
    await service.checkAvailability();

    res.status(201).json({
      success: true,
      message: "Service enregistré avec succès",
      data: service
    });
  } catch (error) {
    logger.error(`Erreur lors de l'enregistrement du service: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Obtenir tous les services
 * @route   GET /services
 * @access  Privé (admin, superadmin)
 */
exports.getAllServices = async (req, res, next) => {
  try {
    // Paramètres de pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Filtres
    const filter = {};
    if (req.query.isActive === 'true') filter.isActive = true;
    if (req.query.isActive === 'false') filter.isActive = false;
    if (req.query.isAvailable === 'true') filter.isAvailable = true;
    if (req.query.isAvailable === 'false') filter.isAvailable = false;
    if (req.query.category) filter.category = req.query.category;
    
    // Par défaut, exclure les services supprimés
    if (req.query.includeDeleted !== 'true') {
      filter.deletedAt = null;
    }

    // Exécuter la requête
    const total = await Service.countDocuments(filter);
    const services = await Service.find(filter)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    // Informations de pagination
    const pagination = {};
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: services.length,
      pagination,
      totalPages: Math.ceil(total / limit),
      data: services
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des services: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Obtenir un service par son ID
 * @route   GET /services/:id
 * @access  Privé (admin, superadmin)
 */
exports.getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération du service: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Mettre à jour un service
 * @route   PUT /services/:id
 * @access  Privé (admin, superadmin)
 */
exports.updateService = async (req, res, next) => {
  try {
    const { name, description, logo, apiUrl, isActive, category, contactEmail, contactPhone, authType, authConfig } = req.body;

    // Vérifier si le service existe
    let service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }

    // Vérifier si le nom est déjà utilisé par un autre service
    if (name && name !== service.name) {
      const nameExists = await Service.findOne({ _id: { $ne: req.params.id }, name });
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: "Un service avec ce nom existe déjà"
        });
      }
    }

    // Mettre à jour le service
    service = await Service.findByIdAndUpdate(
      req.params.id,
      {
        name: name || undefined,
        description: description || undefined,
        logo: logo || undefined,
        apiUrl: apiUrl || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        category: category || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        authType: authType || undefined,
        authConfig: authConfig || undefined,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    // Si l'URL de l'API a changé, vérifier la disponibilité
    if (apiUrl && apiUrl !== service.apiUrl) {
      await service.checkAvailability();
    }

    // Enregistrer l'activité dans les statistiques
    const stats = await ServiceStats.findOne({ serviceId: service._id });
    if (stats) {
      await stats.recordActivity('service_config_updated', {
        message: 'Configuration du service mise à jour',
        updatedFields: Object.keys(req.body)
      });
    }

    res.status(200).json({
      success: true,
      message: "Service mis à jour avec succès",
      data: service
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du service: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Supprimer un service (soft delete)
 * @route   DELETE /services/:id
 * @access  Privé (superadmin)
 */
exports.deleteService = async (req, res, next) => {
  try {
    // Vérifier si le service existe
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }

    // Soft delete
    await service.softDelete();

    // Enregistrer l'activité dans les statistiques
    const stats = await ServiceStats.findOne({ serviceId: service._id });
    if (stats) {
      await stats.recordActivity('service_config_updated', {
        message: 'Service supprimé (soft delete)'
      });
    }

    res.status(200).json({
      success: true,
      message: "Service supprimé avec succès"
    });
  } catch (error) {
    logger.error(`Erreur lors de la suppression du service: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Vérifier la disponibilité d'un service
 * @route   POST /services/:id/check-availability
 * @access  Privé (admin, superadmin)
 */
exports.checkServiceAvailability = async (req, res, next) => {
  try {
    // Vérifier si le service existe
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }

    // Vérifier la disponibilité
    const isAvailable = await service.checkAvailability();

    // Enregistrer l'activité dans les statistiques
    const stats = await ServiceStats.findOne({ serviceId: service._id });
    if (stats) {
      await stats.recordActivity('service_ping', {
        message: isAvailable ? 'Service disponible' : 'Service indisponible',
        pingStatus: service.lastPingStatus
      });
    }

    res.status(200).json({
      success: true,
      data: {
        isAvailable,
        lastPingStatus: service.lastPingStatus
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la vérification de disponibilité: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Activer ou désactiver un service
 * @route   PATCH /services/:id/toggle-active
 * @access  Privé (admin, superadmin)
 */
exports.toggleServiceActive = async (req, res, next) => {
  try {
    // Vérifier si le service existe
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service non trouvé"
      });
    }

    // Inverser l'état actif
    service.isActive = !service.isActive;
    await service.save();

    // Enregistrer l'activité dans les statistiques
    const stats = await ServiceStats.findOne({ serviceId: service._id });
    if (stats) {
      await stats.recordActivity('service_config_updated', {
        message: service.isActive ? 'Service activé' : 'Service désactivé'
      });
    }

    res.status(200).json({
      success: true,
      message: service.isActive ? "Service activé avec succès" : "Service désactivé avec succès",
      data: {
        isActive: service.isActive
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de l'activation/désactivation du service: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Obtenir les services actifs et disponibles (pour les citoyens)
 * @route   GET /services/public
 * @access  Public
 */
exports.getPublicServices = async (req, res, next) => {
  try {
    const services = await Service.find({
      isActive: true,
      isAvailable: true,
      deletedAt: null
    }).select('name description logo category');

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des services publics: ${error.message}`);
    next(error);
  }
};
