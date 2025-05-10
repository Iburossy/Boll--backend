const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Modèle pour les utilisateurs du service d'hygiène
 */
const ServiceUserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez fournir une adresse email valide']
  },
  phoneNumber: {
    type: String,
    match: [/^\+?[0-9]{8,15}$/, 'Veuillez fournir un numéro de téléphone valide']
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['inspector', 'technician', 'supervisor', 'admin'],
    default: 'inspector'
  },
  teamId: {
    type: String,
    ref: 'Team'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdBy: {
    type: String,
    ref: 'ServiceUser'
  },
  lastLogin: {
    type: Date
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

// Index pour la recherche par email
ServiceUserSchema.index({ email: 1 });

// Index pour la recherche par rôle
ServiceUserSchema.index({ role: 1 });

// Index pour la recherche par équipe
ServiceUserSchema.index({ teamId: 1 });

// Middleware pour mettre à jour la date de modification
ServiceUserSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  // Hasher le mot de passe s'il a été modifié
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  next();
});

// Méthode pour vérifier si le mot de passe est correct
ServiceUserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Méthode pour générer un token JWT
ServiceUserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      name: this.name,
      email: this.email,
      role: 'service', // Rôle général pour l'API Gateway
      serviceType: 'hygiene', // Type de service pour l'API Gateway
      serviceRole: this.role // Rôle spécifique au service d'hygiène
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRATION
    }
  );
};

// Méthode pour générer un token de réinitialisation de mot de passe
ServiceUserSchema.methods.getResetPasswordToken = function() {
  // Générer un token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hasher le token et l'enregistrer dans la base de données
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Définir la date d'expiration (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

// Méthode pour vérifier si l'utilisateur est un administrateur
ServiceUserSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

// Méthode pour vérifier si l'utilisateur est un superviseur
ServiceUserSchema.methods.isSupervisor = function() {
  return this.role === 'supervisor' || this.role === 'admin';
};

// Méthode pour vérifier si l'utilisateur est un inspecteur
ServiceUserSchema.methods.isInspector = function() {
  return this.role === 'inspector';
};

// Méthode pour vérifier si l'utilisateur est un technicien
ServiceUserSchema.methods.isTechnician = function() {
  return this.role === 'technician';
};

module.exports = mongoose.model('ServiceUser', ServiceUserSchema);
