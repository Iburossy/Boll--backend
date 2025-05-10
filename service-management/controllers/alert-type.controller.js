const AlertType = require('../models/alert-type.model');
const Service = require('../models/service.model');
const ApiError = require('../utils/api-error');
const ApiResponse = require('../utils/api-response');
const catchAsync = require('../utils/catch-async');

/**
 * Créer un nouveau type d'alerte
 */
const createAlertType = catchAsync(async (req, res) => {
  console.log('[ALERT TYPE CONTROLLER] createAlertType - Requête reçue');
  console.log('[ALERT TYPE CONTROLLER] createAlertType - Body:', req.body);
  
  const { name, description, serviceId, icon, requiredFields } = req.body;
  
  try {
    // Vérifier si le service existe
    const service = await Service.findById(serviceId);
    console.log(`[ALERT TYPE CONTROLLER] createAlertType - Service existant: ${service ? 'Oui' : 'Non'}`);
    
    if (!service) {
      console.log(`[ALERT TYPE CONTROLLER] createAlertType - Service non trouvé avec l'ID: ${serviceId}`);
      throw new ApiError(404, 'Service non trouvé');
    }
    
    // Vérifier si le type d'alerte existe déjà pour ce service
    const existingAlertType = await AlertType.findOne({ name, serviceId });
    console.log(`[ALERT TYPE CONTROLLER] createAlertType - Type d'alerte existant: ${existingAlertType ? 'Oui' : 'Non'}`);
    
    if (existingAlertType) {
      console.log(`[ALERT TYPE CONTROLLER] createAlertType - Type d'alerte déjà existant: ${name} pour le service ${serviceId}`);
      throw new ApiError(400, 'Ce type d\'alerte existe déjà pour ce service');
    }
    
    // Créer un nouveau type d'alerte
    console.log(`[ALERT TYPE CONTROLLER] createAlertType - Création du type d'alerte en cours...`);
    const newAlertType = await AlertType.create({
      name,
      description,
      serviceId,
      icon,
      requiredFields
    });
    console.log(`[ALERT TYPE CONTROLLER] createAlertType - Type d'alerte créé avec l'ID: ${newAlertType._id}`);
    
    return res.status(201).json(new ApiResponse(201, newAlertType, 'Type d\'alerte créé avec succès'));
  } catch (error) {
    console.error(`[ALERT TYPE CONTROLLER] createAlertType - ERREUR:`, error);
    throw error;
  }
});

/**
 * Récupérer tous les types d'alertes
 */
const getAllAlertTypes = catchAsync(async (req, res) => {
  console.log('[ALERT TYPE CONTROLLER] getAllAlertTypes - Requête reçue');
  
  try {
    // Filtres optionnels
    const filter = {};
    if (req.query.serviceId) {
      filter.serviceId = req.query.serviceId;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    console.log(`[ALERT TYPE CONTROLLER] getAllAlertTypes - Filtres: ${JSON.stringify(filter)}`);
    
    // Récupérer les types d'alertes
    const alertTypes = await AlertType.find(filter).populate('serviceId', 'name icon color');
    console.log(`[ALERT TYPE CONTROLLER] getAllAlertTypes - ${alertTypes.length} types d'alertes récupérés`);
    
    return res.json(new ApiResponse(200, alertTypes, 'Types d\'alertes récupérés avec succès'));
  } catch (error) {
    console.error(`[ALERT TYPE CONTROLLER] getAllAlertTypes - ERREUR:`, error);
    throw error;
  }
});

/**
 * Récupérer un type d'alerte par son ID
 */
const getAlertTypeById = catchAsync(async (req, res) => {
  console.log('[ALERT TYPE CONTROLLER] getAlertTypeById - Requête reçue');
  console.log(`[ALERT TYPE CONTROLLER] getAlertTypeById - ID: ${req.params.alertTypeId}`);
  
  try {
    const alertType = await AlertType.findById(req.params.alertTypeId).populate('serviceId', 'name icon color');
    
    if (!alertType) {
      console.log(`[ALERT TYPE CONTROLLER] getAlertTypeById - Type d'alerte non trouvé avec l'ID: ${req.params.alertTypeId}`);
      throw new ApiError(404, 'Type d\'alerte non trouvé');
    }
    
    console.log(`[ALERT TYPE CONTROLLER] getAlertTypeById - Type d'alerte trouvé: ${alertType.name}`);
    return res.json(new ApiResponse(200, alertType, 'Type d\'alerte récupéré avec succès'));
  } catch (error) {
    console.error(`[ALERT TYPE CONTROLLER] getAlertTypeById - ERREUR:`, error);
    throw error;
  }
});

/**
 * Mettre à jour un type d'alerte
 */
const updateAlertType = catchAsync(async (req, res) => {
  console.log('[ALERT TYPE CONTROLLER] updateAlertType - Requête reçue');
  console.log(`[ALERT TYPE CONTROLLER] updateAlertType - ID: ${req.params.alertTypeId}`);
  console.log('[ALERT TYPE CONTROLLER] updateAlertType - Body:', req.body);
  
  try {
    const { name, description, serviceId, icon, requiredFields, isActive } = req.body;
    
    // Vérifier si le type d'alerte existe
    const alertType = await AlertType.findById(req.params.alertTypeId);
    
    if (!alertType) {
      console.log(`[ALERT TYPE CONTROLLER] updateAlertType - Type d'alerte non trouvé avec l'ID: ${req.params.alertTypeId}`);
      throw new ApiError(404, 'Type d\'alerte non trouvé');
    }
    
    // Si le service est modifié, vérifier s'il existe
    if (serviceId && serviceId !== alertType.serviceId.toString()) {
      const service = await Service.findById(serviceId);
      
      if (!service) {
        console.log(`[ALERT TYPE CONTROLLER] updateAlertType - Service non trouvé avec l'ID: ${serviceId}`);
        throw new ApiError(404, 'Service non trouvé');
      }
    }
    
    // Mettre à jour le type d'alerte
    console.log(`[ALERT TYPE CONTROLLER] updateAlertType - Mise à jour du type d'alerte en cours...`);
    const updatedAlertType = await AlertType.findByIdAndUpdate(
      req.params.alertTypeId,
      {
        name,
        description,
        serviceId,
        icon,
        requiredFields,
        isActive
      },
      { new: true, runValidators: true }
    ).populate('serviceId', 'name icon color');
    
    console.log(`[ALERT TYPE CONTROLLER] updateAlertType - Type d'alerte mis à jour avec succès: ${updatedAlertType.name}`);
    return res.json(new ApiResponse(200, updatedAlertType, 'Type d\'alerte mis à jour avec succès'));
  } catch (error) {
    console.error(`[ALERT TYPE CONTROLLER] updateAlertType - ERREUR:`, error);
    throw error;
  }
});

/**
 * Supprimer un type d'alerte
 */
const deleteAlertType = catchAsync(async (req, res) => {
  console.log('[ALERT TYPE CONTROLLER] deleteAlertType - Requête reçue');
  console.log(`[ALERT TYPE CONTROLLER] deleteAlertType - ID: ${req.params.alertTypeId}`);
  
  try {
    // Vérifier si le type d'alerte existe
    const alertType = await AlertType.findById(req.params.alertTypeId);
    
    if (!alertType) {
      console.log(`[ALERT TYPE CONTROLLER] deleteAlertType - Type d'alerte non trouvé avec l'ID: ${req.params.alertTypeId}`);
      throw new ApiError(404, 'Type d\'alerte non trouvé');
    }
    
    // Supprimer le type d'alerte
    console.log(`[ALERT TYPE CONTROLLER] deleteAlertType - Suppression du type d'alerte en cours...`);
    await AlertType.findByIdAndDelete(req.params.alertTypeId);
    
    console.log(`[ALERT TYPE CONTROLLER] deleteAlertType - Type d'alerte supprimé avec succès`);
    return res.json(new ApiResponse(200, null, 'Type d\'alerte supprimé avec succès'));
  } catch (error) {
    console.error(`[ALERT TYPE CONTROLLER] deleteAlertType - ERREUR:`, error);
    throw error;
  }
});

module.exports = {
  createAlertType,
  getAllAlertTypes,
  getAlertTypeById,
  updateAlertType,
  deleteAlertType
};
