/**
 * Script pour créer un super administrateur pour le service d'hygiène
 * Usage: node scripts/createSuperAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/database');

// Modèle ServiceUser
const ServiceUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
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
  role: {
    type: String,
    enum: ['admin', 'supervisor', 'inspector', 'technician'],
    default: 'inspector'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Méthode pour hacher le mot de passe avant de sauvegarder
ServiceUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const ServiceUser = mongoose.model('ServiceUser', ServiceUserSchema);

// Configuration de l'administrateur
const superAdmin = {
  name: 'Super Admin Hygiene',
  email: 'superadmin@hygiene.bolle.sn',
  password: 'SuperSecurePassword123!',
  role: 'admin',
  isActive: true
};

// Fonction pour créer le super administrateur
async function createSuperAdmin() {
  try {
    // Connexion à la base de données
    await connectDB();
    
    // Vérifier si un admin existe déjà
    const existingAdmin = await ServiceUser.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('Un administrateur existe déjà dans la base de données:');
      console.log(`Nom: ${existingAdmin.name}`);
      console.log(`Email: ${existingAdmin.email}`);
      console.log(`Rôle: ${existingAdmin.role}`);
      console.log('\nUtilisez cet administrateur pour vous connecter ou créez-en un nouveau via l\'API.');
    } else {
      // Créer le super administrateur
      const admin = await ServiceUser.create(superAdmin);
      
      console.log('Super administrateur créé avec succès:');
      console.log(`Nom: ${admin.name}`);
      console.log(`Email: ${admin.email}`);
      console.log(`Rôle: ${admin.role}`);
      console.log('\nUtilisez ces informations pour vous connecter à l\'API.');
      console.log('IMPORTANT: Changez le mot de passe après la première connexion!');
    }
    
    // Déconnexion de la base de données
    await mongoose.connection.close();
    
    console.log('\nConnexion à la base de données fermée.');
  } catch (error) {
    console.error('Erreur lors de la création du super administrateur:', error);
    process.exit(1);
  }
}

// Exécuter la fonction
createSuperAdmin();
