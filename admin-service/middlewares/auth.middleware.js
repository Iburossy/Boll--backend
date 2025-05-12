const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Middleware pour protéger les routes nécessitant une authentification
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Vérifier si le token est présent dans les en-têtes
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Vérifier si le token existe
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Vous n'êtes pas autorisé à accéder à cette ressource"
      });
    }
    
    try {
      // Vérifier le token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Vérifier si l'administrateur existe
      const admin = await Admin.findById(decoded.id);
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "L'utilisateur associé à ce token n'existe plus"
        });
      }
      
      // Vérifier si l'administrateur est actif
      if (!admin.isActive) {
        return res.status(401).json({
          success: false,
          message: "Ce compte a été désactivé"
        });
      }
      
      // Ajouter l'administrateur à la requête
      req.admin = {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      };
      
      next();
    } catch (error) {
      logger.error(`Erreur d'authentification: ${error.message}`);
      return res.status(401).json({
        success: false,
        message: "Token invalide ou expiré"
      });
    }
  } catch (error) {
    logger.error(`Erreur dans le middleware d'authentification: ${error.message}`);
    next(error);
  }
};

/**
 * Middleware pour restreindre l'accès en fonction du rôle
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: "Vous n'avez pas les droits nécessaires pour effectuer cette action"
      });
    }
    next();
  };
};

/**
 * Middleware pour vérifier si l'utilisateur est un superadmin
 */
exports.isSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: "Cette action nécessite des privilèges de superadmin"
    });
  }
  next();
};

/**
 * Middleware pour vérifier si l'utilisateur est un admin ou un superadmin
 */
exports.isAdmin = (req, res, next) => {
  if (!req.admin || (req.admin.role !== 'admin' && req.admin.role !== 'superadmin')) {
    return res.status(403).json({
      success: false,
      message: "Cette action nécessite des privilèges d'administrateur"
    });
  }
  next();
};
