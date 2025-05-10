const mongoose = require('mongoose');
const Schema = mongoose.Schema;
require('mongoose-geojson-schema');

/**
 * Modèle pour les inspections d'hygiène
 */
const InspectionSchema = new Schema({
  alertId: {
    type: String,
    required: true,
    ref: 'Alert'
  },
  inspectorId: {
    type: String,
    required: true,
    ref: 'User'
  },
  teamId: {
    type: String,
    ref: 'Team'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  completionDate: {
    type: Date
  },
  findings: {
    type: String
  },
  violationLevel: {
    type: String,
    enum: ['none', 'minor', 'moderate', 'severe', 'critical'],
    default: 'none'
  },
  recommendations: {
    type: String
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  photos: [{
    url: String,
    caption: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [Number]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour la recherche géospatiale
InspectionSchema.index({ location: '2dsphere' });

// Index pour la recherche par alerte
InspectionSchema.index({ alertId: 1 });

// Index pour la recherche par inspecteur
InspectionSchema.index({ inspectorId: 1 });

// Index pour la recherche par statut
InspectionSchema.index({ status: 1 });

// Middleware pour mettre à jour la date de modification
InspectionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode pour vérifier si une inspection est en retard
InspectionSchema.methods.isOverdue = function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  
  return new Date() > this.scheduledDate;
};

// Méthode pour vérifier si un suivi est nécessaire
InspectionSchema.methods.needsFollowUp = function() {
  if (!this.followUpRequired) {
    return false;
  }
  
  // Si la date de suivi est définie et est dans le passé
  if (this.followUpDate) {
    return new Date() >= this.followUpDate;
  }
  
  return false;
};

// Méthode pour obtenir la durée entre la planification et la complétion
InspectionSchema.methods.getResolutionTime = function() {
  if (!this.completionDate) {
    return null;
  }
  
  return (this.completionDate - this.scheduledDate) / (1000 * 60 * 60 * 24); // en jours
};

module.exports = mongoose.model('Inspection', InspectionSchema);
