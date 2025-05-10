const mongoose = require('mongoose');
const Schema = mongoose.Schema;
require('mongoose-geojson-schema');

/**
 * Modèle pour les zones à risque d'hygiène
 */
const ZoneSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  boundary: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon'
    },
    coordinates: {
      type: [[[Number]]],
      required: true
    }
  },
  alertCount: {
    type: Number,
    default: 0
  },
  lastInspection: {
    type: Date
  },
  responsibleTeam: {
    type: String,
    ref: 'Team'
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
ZoneSchema.index({ boundary: '2dsphere' });

// Index pour la recherche par niveau de risque
ZoneSchema.index({ riskLevel: 1 });

// Middleware pour mettre à jour la date de modification
ZoneSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode pour vérifier si une zone nécessite une inspection
ZoneSchema.methods.needsInspection = function(daysThreshold = 30) {
  if (!this.lastInspection) {
    return true;
  }
  
  const daysSinceLastInspection = (new Date() - this.lastInspection) / (1000 * 60 * 60 * 24);
  
  // Ajuster le seuil en fonction du niveau de risque
  let adjustedThreshold = daysThreshold;
  
  switch (this.riskLevel) {
    case 'critical':
      adjustedThreshold = daysThreshold / 4; // Inspection plus fréquente pour les zones critiques
      break;
    case 'high':
      adjustedThreshold = daysThreshold / 2;
      break;
    case 'medium':
      adjustedThreshold = daysThreshold;
      break;
    case 'low':
      adjustedThreshold = daysThreshold * 1.5; // Inspection moins fréquente pour les zones à faible risque
      break;
  }
  
  return daysSinceLastInspection >= adjustedThreshold;
};

// Méthode pour calculer la superficie approximative de la zone (en km²)
ZoneSchema.methods.calculateArea = function() {
  if (!this.boundary || !this.boundary.coordinates || this.boundary.coordinates.length === 0) {
    return 0;
  }
  
  // Calcul simple de l'aire d'un polygone (approximation)
  const coordinates = this.boundary.coordinates[0]; // Premier anneau du polygone
  
  if (coordinates.length < 3) {
    return 0;
  }
  
  let area = 0;
  const R = 6371; // Rayon de la Terre en km
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    
    // Formule de l'aire de Gauss (approximation)
    area += (p2[0] - p1[0]) * (p2[1] + p1[1]);
  }
  
  // Convertir en km²
  return Math.abs(area) * Math.pow(R, 2) * Math.PI / 180 / 2;
};

module.exports = mongoose.model('Zone', ZoneSchema);
