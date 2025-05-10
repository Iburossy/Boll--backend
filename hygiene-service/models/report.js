const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Modèle pour les rapports générés par le service d'hygiène
 */
const ReportSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['inspection', 'zone', 'summary', 'incident', 'periodic'],
    required: true
  },
  generatedBy: {
    type: String,
    required: true,
    ref: 'User'
  },
  period: {
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    }
  },
  relatedInspections: [{
    type: String,
    ref: 'Inspection'
  }],
  relatedZones: [{
    type: String,
    ref: 'Zone'
  }],
  content: {
    summary: {
      type: String,
      required: true
    },
    findings: {
      type: String
    },
    recommendations: {
      type: String
    },
    statistics: {
      type: Object
    }
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  publishedAt: {
    type: Date
  }
});

// Index pour la recherche par type
ReportSchema.index({ type: 1 });

// Index pour la recherche par date de création
ReportSchema.index({ createdAt: 1 });

// Index pour la recherche par statut
ReportSchema.index({ status: 1 });

// Middleware pour mettre à jour la date de modification
ReportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Si le statut passe à 'published', mettre à jour publishedAt
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = Date.now();
  }
  
  next();
});

// Méthode pour vérifier si le rapport est publiable
ReportSchema.methods.isPublishable = function() {
  return this.content.summary && this.content.summary.length > 0;
};

// Méthode pour obtenir l'URL de téléchargement du rapport
ReportSchema.methods.getDownloadUrl = function() {
  return `/reports/download/${this._id}`;
};

// Méthode pour obtenir la durée couverte par le rapport (en jours)
ReportSchema.methods.getCoverageDuration = function() {
  if (!this.period.startDate || !this.period.endDate) {
    return null;
  }
  
  return (this.period.endDate - this.period.startDate) / (1000 * 60 * 60 * 24);
};

module.exports = mongoose.model('Report', ReportSchema);
