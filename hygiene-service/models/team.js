const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Modèle pour les équipes d'intervention du service d'hygiène
 */
const TeamSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  supervisorId: {
    type: String,
    required: true,
    ref: 'User'
  },
  members: [{
    userId: {
      type: String,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['inspector', 'technician', 'support'],
      default: 'inspector'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  specialization: {
    type: String,
    enum: ['food', 'water', 'waste', 'general', 'industrial'],
    default: 'general'
  },
  assignedZones: [{
    type: String,
    ref: 'Zone'
  }],
  activeInspections: {
    type: Number,
    default: 0
  },
  completedInspections: {
    type: Number,
    default: 0
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

// Index pour la recherche par superviseur
TeamSchema.index({ supervisorId: 1 });

// Index pour la recherche par spécialisation
TeamSchema.index({ specialization: 1 });

// Middleware pour mettre à jour la date de modification
TeamSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode pour vérifier si l'équipe est disponible (moins de 5 inspections actives)
TeamSchema.methods.isAvailable = function() {
  return this.activeInspections < 5;
};

// Méthode pour obtenir le nombre total de membres
TeamSchema.methods.getMemberCount = function() {
  return this.members.length;
};

// Méthode pour vérifier si un utilisateur est membre de l'équipe
TeamSchema.methods.isMember = function(userId) {
  return this.members.some(member => member.userId === userId);
};

// Méthode pour obtenir les membres par rôle
TeamSchema.methods.getMembersByRole = function(role) {
  return this.members.filter(member => member.role === role);
};

// Méthode pour calculer le taux de complétion des inspections
TeamSchema.methods.getCompletionRate = function() {
  if (this.activeInspections + this.completedInspections === 0) {
    return 0;
  }
  
  return (this.completedInspections / (this.activeInspections + this.completedInspections)) * 100;
};

module.exports = mongoose.model('Team', TeamSchema);
