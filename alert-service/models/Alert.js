const mongoose = require('mongoose');
const Schema = mongoose.Schema;
require('mongoose-geojson-schema');

const AlertSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  serviceName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['commerce', 'hygiene', 'securite', 'urbanisme', 'transport', 'autre']
  },
  subCategory: {
    type: String,
    required: false
  },
  location: {
    type: mongoose.Schema.Types.Point,
    required: true,
    index: '2dsphere'
  },
  address: {
    type: String,
    required: false
  },
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'audio'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    thumbnailUrl: {
      type: String,
      required: false
    }
  }],
  userId: {
    type: String,
    required: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'received', 'processing', 'resolved', 'rejected'],
    default: 'pending'
  },
  assignedTo: {
    serviceType: {
      type: String,
      enum: ['police', 'hygiene', 'douane', 'urbanisme', 'autre'],
      required: false
    },
    serviceId: {
      type: String,
      required: false
    }
  },
  feedback: [{
    message: {
      type: String,
      required: true
    },
    fromService: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  upvotes: {
    type: Number,
    default: 0
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'verified', 'rejected'],
    default: 'unverified'
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
AlertSchema.index({ location: '2dsphere' });

// Index pour la recherche par catégorie et statut
AlertSchema.index({ category: 1, status: 1 });

// Middleware pour mettre à jour la date de modification
AlertSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Champ virtuel pour statusLabel (mapping pour le frontend)
AlertSchema.virtual('statusLabel').get(function() {
  switch (this.status) {
    case 'resolved': return 'Résolue';
    case 'rejected': return 'Rejetée';
    case 'pending':
    case 'received':
    case 'processing':
    default:
      return 'En cours';
  }
});

// Pour inclure les virtuels dans toJSON
AlertSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Alert', AlertSchema);
