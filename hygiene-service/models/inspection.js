const mongoose = require('mongoose');
const Schema = mongoose.Schema;
require('mongoose-geojson-schema');

/**
 * Modèle pour les inspections d'hygiène
 */
const InspectionSchema = new Schema({
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'L\'ID de l\'alerte est obligatoire'],
    ref: 'Alert',
    validate: {
      validator: function(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: props => `${props.value} n'est pas un ID d'alerte valide`
    }
  },
  inspectorId: {
    type: String,
    required: [true, 'L\'ID de l\'inspecteur est obligatoire'],
    ref: 'User'
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    validate: {
      validator: function(v) {
        return v === null || v === undefined || mongoose.Types.ObjectId.isValid(v);
      },
      message: props => `${props.value} n'est pas un ID d'équipe valide`
    }
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  scheduledDate: {
    type: Date,
    required: [true, 'La date planifiée est obligatoire'],
    validate: {
      validator: function(v) {
        // La date doit être valide
        return !isNaN(new Date(v).getTime());
      },
      message: props => `${props.value} n'est pas une date valide`
    }
  },
  completionDate: {
    type: Date
  },
  findings: {
    type: String
  },
  violationLevel: {
    type: String,
    enum: {
      values: ['none', 'minor', 'moderate', 'severe', 'critical'],
      message: '{VALUE} n\'est pas un niveau de violation valide'
    },
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

// Méthode pour normaliser les données d'une inspection avant de les renvoyer
InspectionSchema.methods.normalize = function() {
  const inspection = this.toObject();
  
  // Assurer la compatibilité avec le frontend en ajoutant un champ 'id' si nécessaire
  if (!inspection.id && inspection._id) {
    inspection.id = inspection._id.toString();
  }
  
  // Convertir les dates en chaînes ISO pour la compatibilité avec le frontend
  if (inspection.scheduledDate) {
    inspection.scheduledDateISO = inspection.scheduledDate.toISOString();
  }
  
  if (inspection.completionDate) {
    inspection.completionDateISO = inspection.completionDate.toISOString();
  }
  
  if (inspection.followUpDate) {
    inspection.followUpDateISO = inspection.followUpDate.toISOString();
  }
  
  // Ajouter des propriétés calculées utiles
  inspection.isOverdue = this.isOverdue();
  inspection.needsFollowUp = this.needsFollowUp();
  
  if (this.status === 'completed' && this.completionDate) {
    inspection.resolutionTime = this.getResolutionTime();
  }
  
  return inspection;
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

// Méthode statique pour obtenir les statistiques des inspections
InspectionSchema.statics.getStatistics = async function() {
  const total = await this.countDocuments();
  
  const byStatus = await this.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  const byViolationLevel = await this.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: '$violationLevel', count: { $sum: 1 } } }
  ]);
  
  // Calculer le nombre d'inspections en retard
  const now = new Date();
  const overdue = await this.countDocuments({
    status: { $in: ['scheduled', 'in-progress'] },
    scheduledDate: { $lt: now }
  });
  
  // Calculer le taux de complétion
  const formattedByStatus = {};
  byStatus.forEach(item => {
    formattedByStatus[item._id] = item.count;
  });
  
  const formattedByViolationLevel = {};
  byViolationLevel.forEach(item => {
    formattedByViolationLevel[item._id] = item.count;
  });
  
  const completionRate = total > 0 ? ((formattedByStatus['completed'] || 0) / total) * 100 : 0;
  
  return {
    total,
    scheduled: formattedByStatus['scheduled'] || 0,
    inProgress: formattedByStatus['in-progress'] || 0,
    completed: formattedByStatus['completed'] || 0,
    cancelled: formattedByStatus['cancelled'] || 0,
    overdue,
    completionRate,
    byViolationLevel: formattedByViolationLevel
  };
};

// Méthode statique pour trouver les inspections à venir
InspectionSchema.statics.findUpcoming = async function(limit = 5) {
  const now = new Date();
  return this.find({
    status: { $in: ['scheduled', 'in-progress'] },
    scheduledDate: { $gte: now }
  })
  .sort({ scheduledDate: 1 })
  .limit(limit);
};

// Méthode statique pour trouver les inspections en retard
InspectionSchema.statics.findOverdue = async function(limit = 5) {
  const now = new Date();
  return this.find({
    status: { $in: ['scheduled', 'in-progress'] },
    scheduledDate: { $lt: now }
  })
  .sort({ scheduledDate: 1 })
  .limit(limit);
};

module.exports = mongoose.model('Inspection', InspectionSchema);
