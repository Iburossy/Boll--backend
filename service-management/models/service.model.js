const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  // Champs de base
  name: {
    type: String,
    required: [true, 'Le nom du service est requis'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'La description du service est requise']
  },
  icon: {
    type: String,  // URL ou nom de l'icône
    default: 'default_service.png'
  },
  color: {
    type: String,  // Code couleur hexadécimal
    default: '#3498db'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'administrateur du service est requis']
  },
  
  // Informations de contact
  contactInfo: {
    phone: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    }
  },
  
  // Zones géographiques couvertes
  jurisdiction: {
    type: [String],
    default: ['National']
  },
  
  // Délai de réponse estimé (en heures)
  responseTime: {
    type: Number,
    default: 48
  },
  
  // Types d'alertes que ce service peut traiter
  supportedAlertTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AlertType'
  }],
  
  // Niveau de priorité pour l'affichage
  priority: {
    type: Number,
    default: 10
  },
  
  // Heures d'ouverture
  operatingHours: {
    weekdays: {
      type: String,
      default: '8h-17h'
    },
    weekend: {
      type: String,
      default: 'Fermé'
    },
    holidays: {
      type: String,
      default: 'Fermé'
    }
  },
  
  // Langues prises en charge
  languages: {
    type: [String],
    default: ['Français', 'Wolof']
  },
  
  // Statistiques de base
  statistics: {
    totalAlerts: { 
      type: Number, 
      default: 0 
    },
    resolvedAlerts: { 
      type: Number, 
      default: 0 
    },
    averageResponseTime: { 
      type: Number, 
      default: 0 
    }
  },
  
  // Horodatage
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Middleware pre-save pour mettre à jour le champ updatedAt
serviceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtuals
serviceSchema.virtual('alertTypes', {
  ref: 'AlertType',
  localField: '_id',
  foreignField: 'serviceId',
  justOne: false
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
