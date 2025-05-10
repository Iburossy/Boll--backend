const logger = require('../utils/logger');
const ServiceUser = require('../models/serviceUser');

/**
 * Middleware pour vérifier les rôles dans le service d'hygiène
 */

/**
 * Vérifie si l'utilisateur est un administrateur du service d'hygiène
 */
exports.isAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    // Vérifier d'abord si l'utilisateur est du service d'hygiène
    if (req.user.role !== 'service' || req.user.serviceType !== 'hygiene') {
      logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route réservée aux administrateurs`);
      return res.status(403).json({ error: 'Accès réservé aux administrateurs du service d\'hygiène' });
    }
    
    // Vérifier si l'utilisateur est un administrateur
    const user = await ServiceUser.findById(req.user.id);
    
    if (!user || user.role !== 'admin') {
      logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route réservée aux administrateurs`);
      return res.status(403).json({ error: 'Accès réservé aux administrateurs du service d\'hygiène' });
    }
    
    next();
  } catch (error) {
    logger.error(`Erreur lors de la vérification du rôle admin: ${error.message}`);
    return res.status(500).json({ error: 'Erreur lors de la vérification des autorisations' });
  }
};

/**
 * Vérifie si l'utilisateur est un superviseur du service d'hygiène
 */
exports.isSupervisor = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    // Vérifier d'abord si l'utilisateur est du service d'hygiène
    if (req.user.role !== 'service' || req.user.serviceType !== 'hygiene') {
      logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route réservée aux superviseurs`);
      return res.status(403).json({ error: 'Accès réservé aux superviseurs du service d\'hygiène' });
    }
    
    // Vérifier si l'utilisateur est un superviseur ou un administrateur
    const user = await ServiceUser.findById(req.user.id);
    
    if (!user || (user.role !== 'supervisor' && user.role !== 'admin')) {
      logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route réservée aux superviseurs`);
      return res.status(403).json({ error: 'Accès réservé aux superviseurs du service d\'hygiène' });
    }
    
    next();
  } catch (error) {
    logger.error(`Erreur lors de la vérification du rôle superviseur: ${error.message}`);
    return res.status(500).json({ error: 'Erreur lors de la vérification des autorisations' });
  }
};

/**
 * Vérifie si l'utilisateur est un inspecteur du service d'hygiène
 */
exports.isInspector = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    // Vérifier d'abord si l'utilisateur est du service d'hygiène
    if (req.user.role !== 'service' || req.user.serviceType !== 'hygiene') {
      logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route réservée aux inspecteurs`);
      return res.status(403).json({ error: 'Accès réservé aux inspecteurs du service d\'hygiène' });
    }
    
    // Vérifier si l'utilisateur est un inspecteur
    const user = await ServiceUser.findById(req.user.id);
    
    if (!user || user.role !== 'inspector') {
      logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route réservée aux inspecteurs`);
      return res.status(403).json({ error: 'Accès réservé aux inspecteurs du service d\'hygiène' });
    }
    
    next();
  } catch (error) {
    logger.error(`Erreur lors de la vérification du rôle inspecteur: ${error.message}`);
    return res.status(500).json({ error: 'Erreur lors de la vérification des autorisations' });
  }
};

/**
 * Vérifie si l'utilisateur est un technicien du service d'hygiène
 */
exports.isTechnician = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  try {
    // Vérifier d'abord si l'utilisateur est du service d'hygiène
    if (req.user.role !== 'service' || req.user.serviceType !== 'hygiene') {
      logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route réservée aux techniciens`);
      return res.status(403).json({ error: 'Accès réservé aux techniciens du service d\'hygiène' });
    }
    
    // Vérifier si l'utilisateur est un technicien
    const user = await ServiceUser.findById(req.user.id);
    
    if (!user || user.role !== 'technician') {
      logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route réservée aux techniciens`);
      return res.status(403).json({ error: 'Accès réservé aux techniciens du service d\'hygiène' });
    }
    
    next();
  } catch (error) {
    logger.error(`Erreur lors de la vérification du rôle technicien: ${error.message}`);
    return res.status(500).json({ error: 'Erreur lors de la vérification des autorisations' });
  }
};

/**
 * Vérifie si l'utilisateur est un membre du service d'hygiène (tout rôle confondu)
 */
exports.isHygieneService = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  // Vérifier si l'utilisateur est un agent du service d'hygiène (tout rôle confondu)
  if (req.user.role !== 'service' || req.user.serviceType !== 'hygiene') {
    logger.warn(`Accès non autorisé: ${req.user.id} a tenté d'accéder à une route du service d'hygiène`);
    return res.status(403).json({ error: 'Accès réservé au service d\'hygiène' });
  }
  
  next();
};
