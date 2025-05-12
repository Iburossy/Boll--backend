const mongoose = require('mongoose');

/**
 * Modèle pour les services partenaires
 * Stocke les informations sur chaque service intégré à la plateforme
 */
const ServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du service est requis'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: [true, 'La description du service est requise'],
    trim: true
  },
  logo: {
    type: String,
    default: 'default-service-logo.png'
  },
  apiUrl: {
    type: String,
    required: [true, "L'URL de l'API du service est requise"],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: false
  },
  lastPingStatus: {
    code: {
      type: Number,
      default: null
    },
    message: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: null
    }
  },
  category: {
    type: String,
    enum: ['public', 'private', 'ngo'],
    default: 'public'
  },
  contactEmail: {
    type: String,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Veuillez fournir une adresse email valide'
    ]
  },
  contactPhone: {
    type: String
  },
  authType: {
    type: String,
    enum: ['jwt', 'oauth2', 'apikey', 'none'],
    default: 'jwt'
  },
  authConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Middleware pour mettre à jour le champ updatedAt avant la sauvegarde
ServiceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode pour vérifier la disponibilité d'un service
ServiceSchema.methods.checkAvailability = async function() {
  const axios = require('axios');
  const logger = require('../utils/logger');
  
  try {
    // Ping l'URL de santé du service
    const healthEndpoint = `${this.apiUrl}/health`;
    const response = await axios.get(healthEndpoint, { timeout: 5000 });
    
    // Mise à jour du statut de disponibilité
    this.isAvailable = response.status === 200;
    this.lastPingStatus = {
      code: response.status,
      message: response.status === 200 ? 'Service disponible' : 'Service indisponible',
      timestamp: new Date()
    };
    
    await this.save();
    return this.isAvailable;
  } catch (error) {
    // En cas d'erreur, le service est considéré comme indisponible
    logger.error(`Erreur lors de la vérification de disponibilité du service ${this.name}: ${error.message}`);
    
    this.isAvailable = false;
    this.lastPingStatus = {
      code: error.response ? error.response.status : 500,
      message: error.message,
      timestamp: new Date()
    };
    
    await this.save();
    return false;
  }
};

// Méthode pour soft delete
ServiceSchema.methods.softDelete = async function() {
  this.deletedAt = new Date();
  this.isActive = false;
  return await this.save();
};

// Méthode statique pour récupérer uniquement les services non supprimés
ServiceSchema.statics.findActive = function() {
  return this.find({ deletedAt: null });
};

// Méthode statique pour récupérer uniquement les services actifs et disponibles
ServiceSchema.statics.findActiveAndAvailable = function() {
  return this.find({ 
    deletedAt: null,
    isActive: true,
    isAvailable: true
  });
};

module.exports = mongoose.model('Service', ServiceSchema);
