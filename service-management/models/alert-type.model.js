const mongoose = require('mongoose');

const alertTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du type d\'alerte est requis'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'La description du type d\'alerte est requise']
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Le service associé est requis']
  },
  icon: {
    type: String,
    default: 'default_alert.png'
  },
  requiredFields: [{
    name: String,
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'boolean', 'select', 'file'],
      default: 'text'
    },
    isRequired: {
      type: Boolean,
      default: false
    },
    options: [String]  // Pour les champs de type 'select'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
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
alertTypeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const AlertType = mongoose.model('AlertType', alertTypeSchema);

module.exports = AlertType;
