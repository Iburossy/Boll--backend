const { body, param, validationResult } = require('express-validator');

/**
 * Middleware pour valider les résultats de validation
 */
const validateResults = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('[VALIDATION MIDDLEWARE] Erreurs de validation:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Règles de validation pour la création d'un service
 */
const validateCreateService = [
  // Champs obligatoires
  body('name')
    .notEmpty().withMessage('Le nom du service est requis')
    .isString().withMessage('Le nom doit être une chaîne de caractères')
    .isLength({ min: 2, max: 50 }).withMessage('Le nom doit contenir entre 2 et 50 caractères'),
  
  body('description')
    .notEmpty().withMessage('La description du service est requise')
    .isString().withMessage('La description doit être une chaîne de caractères')
    .isLength({ min: 10, max: 500 }).withMessage('La description doit contenir entre 10 et 500 caractères'),
  
  body('adminId')
    .notEmpty().withMessage('L\'administrateur du service est requis')
    .isMongoId().withMessage('L\'ID d\'administrateur doit être un ID MongoDB valide'),
  
  // Champs optionnels avec validation
  body('icon')
    .optional()
    .isString().withMessage('L\'icône doit être une chaîne de caractères'),
  
  body('color')
    .optional()
    .isString().withMessage('La couleur doit être une chaîne de caractères')
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('La couleur doit être au format hexadécimal (ex: #3498db)'),
  
  // Validation des nouveaux champs
  body('contactInfo.phone')
    .optional()
    .isString().withMessage('Le numéro de téléphone doit être une chaîne de caractères'),
  
  body('contactInfo.email')
    .optional()
    .isEmail().withMessage('L\'email doit être valide'),
  
  body('contactInfo.address')
    .optional()
    .isString().withMessage('L\'adresse doit être une chaîne de caractères'),
  
  body('jurisdiction')
    .optional()
    .isArray().withMessage('La juridiction doit être un tableau de zones géographiques'),
  
  body('jurisdiction.*')
    .optional()
    .isString().withMessage('Chaque juridiction doit être une chaîne de caractères'),
  
  body('responseTime')
    .optional()
    .isInt({ min: 1 }).withMessage('Le délai de réponse doit être un nombre entier positif'),
  
  body('supportedAlertTypes')
    .optional()
    .isArray().withMessage('Les types d\'alertes doivent être un tableau'),
  
  body('supportedAlertTypes.*')
    .optional()
    .isMongoId().withMessage('Chaque type d\'alerte doit être un ID MongoDB valide'),
  
  body('priority')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('La priorité doit être un nombre entier entre 1 et 100'),
  
  body('operatingHours.weekdays')
    .optional()
    .isString().withMessage('Les heures d\'ouverture en semaine doivent être une chaîne de caractères'),
  
  body('operatingHours.weekend')
    .optional()
    .isString().withMessage('Les heures d\'ouverture le weekend doivent être une chaîne de caractères'),
  
  body('operatingHours.holidays')
    .optional()
    .isString().withMessage('Les heures d\'ouverture les jours fériés doivent être une chaîne de caractères'),
  
  body('languages')
    .optional()
    .isArray().withMessage('Les langues doivent être un tableau'),
  
  body('languages.*')
    .optional()
    .isString().withMessage('Chaque langue doit être une chaîne de caractères'),
  
  // Validation finale
  validateResults
];

/**
 * Règles de validation pour la mise à jour d'un service
 */
const validateUpdateService = [
  // Validation de l'ID du service
  param('serviceId')
    .isMongoId().withMessage('L\'ID du service doit être un ID MongoDB valide'),
  
  // Tous les champs sont optionnels pour la mise à jour, mais doivent être valides s'ils sont fournis
  body('name')
    .optional()
    .isString().withMessage('Le nom doit être une chaîne de caractères')
    .isLength({ min: 2, max: 50 }).withMessage('Le nom doit contenir entre 2 et 50 caractères'),
  
  body('description')
    .optional()
    .isString().withMessage('La description doit être une chaîne de caractères')
    .isLength({ min: 10, max: 500 }).withMessage('La description doit contenir entre 10 et 500 caractères'),
  
  body('adminId')
    .optional()
    .isMongoId().withMessage('L\'ID d\'administrateur doit être un ID MongoDB valide'),
  
  body('icon')
    .optional()
    .isString().withMessage('L\'icône doit être une chaîne de caractères'),
  
  body('color')
    .optional()
    .isString().withMessage('La couleur doit être une chaîne de caractères')
    .matches(/^#[0-9A-Fa-f]{6}$/).withMessage('La couleur doit être au format hexadécimal (ex: #3498db)'),
  
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive doit être un booléen'),
  
  // Validation des nouveaux champs (identique à la création mais tous optionnels)
  body('contactInfo.phone')
    .optional()
    .isString().withMessage('Le numéro de téléphone doit être une chaîne de caractères'),
  
  body('contactInfo.email')
    .optional()
    .isEmail().withMessage('L\'email doit être valide'),
  
  body('contactInfo.address')
    .optional()
    .isString().withMessage('L\'adresse doit être une chaîne de caractères'),
  
  body('jurisdiction')
    .optional()
    .isArray().withMessage('La juridiction doit être un tableau de zones géographiques'),
  
  body('jurisdiction.*')
    .optional()
    .isString().withMessage('Chaque juridiction doit être une chaîne de caractères'),
  
  body('responseTime')
    .optional()
    .isInt({ min: 1 }).withMessage('Le délai de réponse doit être un nombre entier positif'),
  
  body('supportedAlertTypes')
    .optional()
    .isArray().withMessage('Les types d\'alertes doivent être un tableau'),
  
  body('supportedAlertTypes.*')
    .optional()
    .isMongoId().withMessage('Chaque type d\'alerte doit être un ID MongoDB valide'),
  
  body('priority')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('La priorité doit être un nombre entier entre 1 et 100'),
  
  body('operatingHours.weekdays')
    .optional()
    .isString().withMessage('Les heures d\'ouverture en semaine doivent être une chaîne de caractères'),
  
  body('operatingHours.weekend')
    .optional()
    .isString().withMessage('Les heures d\'ouverture le weekend doivent être une chaîne de caractères'),
  
  body('operatingHours.holidays')
    .optional()
    .isString().withMessage('Les heures d\'ouverture les jours fériés doivent être une chaîne de caractères'),
  
  body('languages')
    .optional()
    .isArray().withMessage('Les langues doivent être un tableau'),
  
  body('languages.*')
    .optional()
    .isString().withMessage('Chaque langue doit être une chaîne de caractères'),
  
  body('statistics')
    .optional()
    .isObject().withMessage('Les statistiques doivent être un objet'),
  
  body('statistics.totalAlerts')
    .optional()
    .isInt({ min: 0 }).withMessage('Le nombre total d\'alertes doit être un entier positif'),
  
  body('statistics.resolvedAlerts')
    .optional()
    .isInt({ min: 0 }).withMessage('Le nombre d\'alertes résolues doit être un entier positif'),
  
  body('statistics.averageResponseTime')
    .optional()
    .isNumeric({ min: 0 }).withMessage('Le temps de réponse moyen doit être un nombre positif'),
  
  // Validation finale
  validateResults
];

module.exports = {
  validateCreateService,
  validateUpdateService
};
