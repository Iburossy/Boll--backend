const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Middleware de validation des données entrantes
 */

/**
 * Valide les données de création/mise à jour d'une inspection
 */
exports.validateInspection = (req, res, next) => {
  const schema = Joi.object({
    alertId: Joi.string().required().messages({
      'string.empty': 'L\'ID de l\'alerte est requis',
      'any.required': 'L\'ID de l\'alerte est requis'
    }),
    teamId: Joi.string().allow(null, ''),
    scheduledDate: Joi.date().required().messages({
      'date.base': 'La date d\'inspection doit être une date valide',
      'any.required': 'La date d\'inspection est requise'
    }),
    status: Joi.string().valid('scheduled', 'in-progress', 'completed', 'cancelled'),
    findings: Joi.string().allow(null, ''),
    violationLevel: Joi.string().valid('none', 'minor', 'moderate', 'severe', 'critical'),
    recommendations: Joi.string().allow(null, ''),
    followUpRequired: Joi.boolean(),
    followUpDate: Joi.date().allow(null),
    location: Joi.object({
      type: Joi.string().default('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).allow(null)
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`Validation échouée: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }
  
  next();
};

/**
 * Valide les données de création/mise à jour d'une zone à risque
 */
exports.validateZone = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required().messages({
      'string.empty': 'Le nom de la zone est requis',
      'any.required': 'Le nom de la zone est requis'
    }),
    description: Joi.string().allow(null, ''),
    riskLevel: Joi.string().valid('low', 'medium', 'high', 'critical').required().messages({
      'any.only': 'Le niveau de risque doit être low, medium, high ou critical',
      'any.required': 'Le niveau de risque est requis'
    }),
    boundary: Joi.object({
      type: Joi.string().valid('Polygon').default('Polygon'),
      coordinates: Joi.array().items(
        Joi.array().items(
          Joi.array().items(Joi.number()).length(2)
        ).min(4) // Au moins 4 points pour fermer un polygone
      ).required()
    }).required().messages({
      'any.required': 'Les limites géographiques sont requises'
    }),
    alertCount: Joi.number().integer().min(0).default(0),
    tags: Joi.array().items(Joi.string()),
    responsibleTeam: Joi.string().allow(null, '')
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`Validation échouée: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }
  
  next();
};

/**
 * Valide les données de création/mise à jour d'une équipe
 */
exports.validateTeam = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required().messages({
      'string.empty': 'Le nom de l\'équipe est requis',
      'any.required': 'Le nom de l\'équipe est requis'
    }),
    supervisorId: Joi.string().required().messages({
      'string.empty': 'L\'ID du superviseur est requis',
      'any.required': 'L\'ID du superviseur est requis'
    }),
    members: Joi.array().items(
      Joi.object({
        userId: Joi.string().required(),
        role: Joi.string().valid('inspector', 'technician', 'support').default('inspector')
      })
    ),
    specialization: Joi.string().valid('food', 'water', 'waste', 'general', 'industrial').default('general'),
    assignedZones: Joi.array().items(Joi.string())
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`Validation échouée: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }
  
  next();
};
