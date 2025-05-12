const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Modèle pour les administrateurs
 * Gère les utilisateurs ayant accès à l'interface d'administration
 */
const AdminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Le nom d'utilisateur est requis"],
    unique: true,
    trim: true,
    minlength: [3, "Le nom d'utilisateur doit contenir au moins 3 caractères"]
  },
  email: {
    type: String,
    required: [true, "L'email est requis"],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Veuillez fournir une adresse email valide'
    ]
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
    select: false // Ne pas inclure le mot de passe dans les requêtes par défaut
  },
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis']
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis']
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    select: false
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
  timestamps: true
});

// Middleware pour hacher le mot de passe avant la sauvegarde
AdminSchema.pre('save', async function(next) {
  // Mettre à jour le champ updatedAt
  this.updatedAt = Date.now();
  
  // Ne pas hacher le mot de passe s'il n'a pas été modifié
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Générer un sel
    const salt = await bcrypt.genSalt(10);
    // Hacher le mot de passe avec le sel
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
AdminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour générer un token JWT
AdminSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { sub: this._id, id: this._id, role: this.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Méthode pour générer un token de rafraîchissement
AdminSchema.methods.generateRefreshToken = function() {
  const refreshToken = jwt.sign(
    { id: this._id },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
  
  // Stocker le token de rafraîchissement dans la base de données
  this.refreshToken = refreshToken;
  return refreshToken;
};

// Méthode pour enregistrer la dernière connexion
AdminSchema.methods.recordLogin = async function() {
  this.lastLogin = new Date();
  return await this.save();
};

module.exports = mongoose.model('Admin', AdminSchema);
