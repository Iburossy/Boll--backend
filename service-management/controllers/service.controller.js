const Service = require('../models/service.model');
const ApiError = require('../utils/api-error');
const ApiResponse = require('../utils/api-response');
const catchAsync = require('../utils/catch-async');

/**
 * Créer un nouveau service
 */
const createService = catchAsync(async (req, res) => {
  console.log('[SERVICE CONTROLLER] createService - Requête reçue');
  console.log('[SERVICE CONTROLLER] createService - Body:', req.body);
  
  const { 
    name, 
    description, 
    icon, 
    color, 
    adminId,
    contactInfo,
    jurisdiction,
    responseTime,
    supportedAlertTypes,
    priority,
    operatingHours,
    languages
  } = req.body;
  
  try {
    // Vérifier si le service existe déjà
    const existingService = await Service.findOne({ name });
    console.log(`[SERVICE CONTROLLER] createService - Service existant: ${existingService ? 'Oui' : 'Non'}`);
    
    if (existingService) {
      console.log(`[SERVICE CONTROLLER] createService - Service déjà existant: ${name}`);
      throw new ApiError(400, 'Ce service existe déjà');
    }
    
    // Créer un nouveau service avec tous les champs disponibles
    console.log(`[SERVICE CONTROLLER] createService - Création du service en cours...`);
    const newService = await Service.create({
      name,
      description,
      icon,
      color,
      adminId,
      // Nouveaux champs
      contactInfo,
      jurisdiction,
      responseTime,
      supportedAlertTypes,
      priority,
      operatingHours,
      languages,
      // Les statistiques sont initialisées par défaut
    });
    console.log(`[SERVICE CONTROLLER] createService - Service créé avec l'ID: ${newService._id}`);
    
    return res.status(201).json(new ApiResponse(201, newService, 'Service créé avec succès'));
  } catch (error) {
    console.error(`[SERVICE CONTROLLER] createService - ERREUR:`, error);
    throw error;
  }
});

/**
 * Récupérer tous les services
 */
const getAllServices = catchAsync(async (req, res) => {
  console.log('[SERVICE CONTROLLER] getAllServices - Requête reçue');
  
  try {
    // Filtres optionnels
    const filter = {};
    if (req.query.isActive) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    console.log(`[SERVICE CONTROLLER] getAllServices - Filtres: ${JSON.stringify(filter)}`);
    
    // Récupérer les services
    const services = await Service.find(filter);
    console.log(`[SERVICE CONTROLLER] getAllServices - ${services.length} services récupérés`);
    
    return res.json(new ApiResponse(200, services, 'Services récupérés avec succès'));
  } catch (error) {
    console.error(`[SERVICE CONTROLLER] getAllServices - ERREUR:`, error);
    throw error;
  }
});

/**
 * Récupérer un service par son ID
 */
const getServiceById = catchAsync(async (req, res) => {
  console.log('[SERVICE CONTROLLER] getServiceById - Requête reçue');
  console.log(`[SERVICE CONTROLLER] getServiceById - ID: ${req.params.serviceId}`);
  
  try {
    const service = await Service.findById(req.params.serviceId).populate('alertTypes');
    
    if (!service) {
      console.log(`[SERVICE CONTROLLER] getServiceById - Service non trouvé avec l'ID: ${req.params.serviceId}`);
      throw new ApiError(404, 'Service non trouvé');
    }
    
    console.log(`[SERVICE CONTROLLER] getServiceById - Service trouvé: ${service.name}`);
    return res.json(new ApiResponse(200, service, 'Service récupéré avec succès'));
  } catch (error) {
    console.error(`[SERVICE CONTROLLER] getServiceById - ERREUR:`, error);
    throw error;
  }
});

/**
 * Mettre à jour un service
 */
const updateService = catchAsync(async (req, res) => {
  console.log('[SERVICE CONTROLLER] updateService - Requête reçue');
  console.log(`[SERVICE CONTROLLER] updateService - ID: ${req.params.serviceId}`);
  console.log('[SERVICE CONTROLLER] updateService - Body:', req.body);
  
  try {
    const { 
      name, 
      description, 
      icon, 
      color, 
      adminId, 
      isActive,
      contactInfo,
      jurisdiction,
      responseTime,
      supportedAlertTypes,
      priority,
      operatingHours,
      languages,
      statistics
    } = req.body;
    
    // Vérifier si le service existe
    const service = await Service.findById(req.params.serviceId);
    
    if (!service) {
      console.log(`[SERVICE CONTROLLER] updateService - Service non trouvé avec l'ID: ${req.params.serviceId}`);
      throw new ApiError(404, 'Service non trouvé');
    }
    
    // Vérifier si le nouveau nom existe déjà (si le nom est modifié)
    if (name && name !== service.name) {
      const existingService = await Service.findOne({ name });
      
      if (existingService) {
        console.log(`[SERVICE CONTROLLER] updateService - Nom de service déjà utilisé: ${name}`);
        throw new ApiError(400, 'Ce nom de service est déjà utilisé');
      }
    }
    
    // Préparer l'objet de mise à jour avec tous les champs disponibles
    const updateData = {};
    
    // Champs de base
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (adminId !== undefined) updateData.adminId = adminId;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Nouveaux champs
    if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
    if (jurisdiction !== undefined) updateData.jurisdiction = jurisdiction;
    if (responseTime !== undefined) updateData.responseTime = responseTime;
    if (supportedAlertTypes !== undefined) updateData.supportedAlertTypes = supportedAlertTypes;
    if (priority !== undefined) updateData.priority = priority;
    if (operatingHours !== undefined) updateData.operatingHours = operatingHours;
    if (languages !== undefined) updateData.languages = languages;
    if (statistics !== undefined) updateData.statistics = statistics;
    
    // Mettre à jour le service
    console.log(`[SERVICE CONTROLLER] updateService - Mise à jour du service en cours...`);
    const updatedService = await Service.findByIdAndUpdate(
      req.params.serviceId,
      updateData,
      { new: true, runValidators: true }
    );
    
    console.log(`[SERVICE CONTROLLER] updateService - Service mis à jour avec succès: ${updatedService.name}`);
    return res.json(new ApiResponse(200, updatedService, 'Service mis à jour avec succès'));
  } catch (error) {
    console.error(`[SERVICE CONTROLLER] updateService - ERREUR:`, error);
    throw error;
  }
});

/**
 * Supprimer un service
 */
const deleteService = catchAsync(async (req, res) => {
  console.log('[SERVICE CONTROLLER] deleteService - Requête reçue');
  console.log(`[SERVICE CONTROLLER] deleteService - ID: ${req.params.serviceId}`);
  
  try {
    // Vérifier si le service existe
    const service = await Service.findById(req.params.serviceId);
    
    if (!service) {
      console.log(`[SERVICE CONTROLLER] deleteService - Service non trouvé avec l'ID: ${req.params.serviceId}`);
      throw new ApiError(404, 'Service non trouvé');
    }
    
    // Supprimer le service
    console.log(`[SERVICE CONTROLLER] deleteService - Suppression du service en cours...`);
    await Service.findByIdAndDelete(req.params.serviceId);
    
    console.log(`[SERVICE CONTROLLER] deleteService - Service supprimé avec succès`);
    return res.json(new ApiResponse(200, null, 'Service supprimé avec succès'));
  } catch (error) {
    console.error(`[SERVICE CONTROLLER] deleteService - ERREUR:`, error);
    throw error;
  }
});

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService
};
