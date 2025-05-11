const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schéma pour les alertes d'hygiène
 */
const AlertSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Le titre est obligatoire'],
    trim: true,
    minlength: [3, 'Le titre doit contenir au moins 3 caractères'],
    maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères']
  },
  description: {
    type: String,
    required: [true, 'La description est obligatoire'],
    minlength: [10, 'La description doit contenir au moins 10 caractères']
  },
  status: {
    type: String,
    enum: ['new', 'assigned', 'in_progress', 'resolved', 'closed'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: [true, 'Les coordonnées sont obligatoires'],
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && 
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Les coordonnées doivent être au format [longitude, latitude] et dans les limites valides'
      }
    },
    address: {
      type: String,
      trim: true
    }
  },
  assignedTo: {
    type: String,
    ref: 'User',
    required: false
  },
  assignedTeam: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: false
  },
  createdBy: {
    type: String,
    required: [true, 'L\'identifiant du créateur est obligatoire']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  comments: [{
    author: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  category: {
    type: String,
    default: 'hygiene'
  },
  zoneUpdated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexer les coordonnées pour les requêtes géospatiales
AlertSchema.index({ 'location.coordinates': '2dsphere' });

// Indexer par statut et date de création pour les requêtes fréquentes
AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ category: 1, status: 1 });
AlertSchema.index({ assignedTeam: 1 });

// Méthode pour normaliser les données d'une alerte avant de les renvoyer
AlertSchema.methods.normalize = function() {
  const alert = this.toObject();
  
  // Assurer la compatibilité avec le frontend en ajoutant un champ 'id' si nécessaire
  if (!alert.id && alert._id) {
    alert.id = alert._id.toString();
  }
  
  // S'assurer que les champs critiques existent
  if (!alert.location) {
    alert.location = { type: 'Point', coordinates: [0, 0] };
  }
  
  if (!alert.comments) {
    alert.comments = [];
  }
  
  if (!alert.attachments) {
    alert.attachments = [];
  }
  
  return alert;
};

// Méthode statique pour rechercher les alertes dans une zone géographique
AlertSchema.statics.findInArea = async function(polygon, category = 'hygiene') {
  return this.find({
    category,
    'location.coordinates': {
      $geoWithin: {
        $geometry: {
          type: 'Polygon',
          coordinates: [polygon]
        }
      }
    }
  });
};

// Méthode statique pour obtenir les statistiques des alertes
AlertSchema.statics.getStatistics = async function(category = 'hygiene') {
  const total = await this.countDocuments({ category });
  
  const byStatus = await this.aggregate([
    { $match: { category } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  const formattedByStatus = {};
  byStatus.forEach(item => {
    formattedByStatus[item._id] = item.count;
  });
  
  return {
    total,
    pending: formattedByStatus['new'] || 0,
    processing: (formattedByStatus['assigned'] || 0) + (formattedByStatus['in_progress'] || 0),
    resolved: formattedByStatus['resolved'] || 0,
    rejected: formattedByStatus['closed'] || 0
  };
};

module.exports = mongoose.model('Alert', AlertSchema);
