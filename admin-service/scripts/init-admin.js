/**
 * Script d'initialisation pour créer un administrateur par défaut
 * Exécuter avec: node scripts/init-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Vérifier si le dossier logs existe, sinon le créer
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Configuration de la connexion MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bolle-admin';

// Définition du schéma Admin (simplifié pour ce script)
const AdminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
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
  refreshToken: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Création du modèle Admin
const Admin = mongoose.model('Admin', AdminSchema);

// Fonction pour créer l'administrateur par défaut
async function createDefaultAdmin() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connecté à MongoDB');

    // Vérifier si un superadmin existe déjà
    const existingAdmin = await Admin.findOne({ role: 'superadmin' });
    if (existingAdmin) {
      console.log('Un superadmin existe déjà dans la base de données');
      console.log(`Username: ${existingAdmin.username}, Email: ${existingAdmin.email}`);
      await mongoose.connection.close();
      return;
    }

    // Hacher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Passer@1', salt);

    // Créer le superadmin
    const superAdmin = new Admin({
      username: 'superadmin',
      email: 'admin@bolle.sn',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Sauvegarder dans la base de données
    await superAdmin.save();
    console.log('Superadmin créé avec succès');
    console.log(`Username: ${superAdmin.username}, Email: ${superAdmin.email}`);
    console.log('Mot de passe: Passer@1');

    // Fermer la connexion
    await mongoose.connection.close();
    console.log('Connexion à MongoDB fermée');
  } catch (error) {
    console.error('Erreur lors de la création du superadmin:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Exécuter la fonction
createDefaultAdmin();
