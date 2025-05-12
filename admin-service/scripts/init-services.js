/**
 * Script d'initialisation pour enregistrer les services existants
 * Exécuter avec: node scripts/init-services.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Vérifier si le dossier logs existe, sinon le créer
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Configuration de la connexion MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bolle-admin';

// Définition du schéma Service (simplifié pour ce script)
const ServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  logo: {
    type: String,
    default: 'default-service-logo.png'
  },
  apiUrl: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: false
  },
  lastPingStatus: {
    code: {
      type: Number,
      default: null
    },
    message: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: null
    }
  },
  category: {
    type: String,
    enum: ['public', 'private', 'ngo'],
    default: 'public'
  },
  contactEmail: String,
  contactPhone: String,
  authType: {
    type: String,
    enum: ['jwt', 'oauth2', 'apikey', 'none'],
    default: 'jwt'
  },
  authConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  }
});

// Définition du schéma ServiceStats (simplifié pour ce script)
const ServiceStatsSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  alertsCount: {
    total: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    },
    inProgress: {
      type: Number,
      default: 0
    },
    resolved: {
      type: Number,
      default: 0
    },
    rejected: {
      type: Number,
      default: 0
    }
  },
  lastActivity: {
    timestamp: {
      type: Date,
      default: null
    },
    type: {
      type: String,
      enum: ['alert_created', 'alert_updated', 'service_ping', 'service_config_updated'],
      default: null
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  dailyStats: [{
    date: {
      type: Date,
      required: true
    },
    alertsReceived: {
      type: Number,
      default: 0
    },
    alertsResolved: {
      type: Number,
      default: 0
    }
  }],
  monthlyStats: [{
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true
    },
    alertsReceived: {
      type: Number,
      default: 0
    },
    alertsResolved: {
      type: Number,
      default: 0
    },
    responseTimeAvg: {
      type: Number,
      default: 0
    }
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Méthode pour vérifier la disponibilité d'un service
ServiceSchema.methods.checkAvailability = async function() {
  try {
    // Ping l'URL de santé du service
    const healthEndpoint = `${this.apiUrl}/health`;
    const response = await axios.get(healthEndpoint, { timeout: 5000 });
    
    // Mise à jour du statut de disponibilité
    this.isAvailable = response.status === 200;
    this.lastPingStatus = {
      code: response.status,
      message: response.status === 200 ? 'Service disponible' : 'Service indisponible',
      timestamp: new Date()
    };
    
    await this.save();
    return this.isAvailable;
  } catch (error) {
    // En cas d'erreur, le service est considéré comme indisponible
    console.error(`Erreur lors de la vérification de disponibilité du service ${this.name}: ${error.message}`);
    
    this.isAvailable = false;
    this.lastPingStatus = {
      code: error.response ? error.response.status : 500,
      message: error.message,
      timestamp: new Date()
    };
    
    await this.save();
    return false;
  }
};

// Création des modèles
const Service = mongoose.model('Service', ServiceSchema);
const ServiceStats = mongoose.model('ServiceStats', ServiceStatsSchema);

// Liste des services existants à enregistrer
const existingServices = [
  {
    name: "Service d'Hygiène",
    description: "Service responsable de la gestion des alertes liées à l'hygiène publique",
    apiUrl: "http://localhost:3008",
    category: "public",
    contactEmail: "hygiene@bolle.sn",
    contactPhone: "221700000000",
    authType: "jwt",
    isActive: true
  }
  // Ajoutez d'autres services ici au besoin
];

// Fonction pour enregistrer les services existants
async function registerExistingServices() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connecté à MongoDB');

    // Enregistrer chaque service
    for (const serviceData of existingServices) {
      // Vérifier si le service existe déjà
      const existingService = await Service.findOne({ name: serviceData.name });
      
      if (existingService) {
        console.log(`Le service "${serviceData.name}" est déjà enregistré`);
        
        // Mettre à jour les informations si nécessaire
        Object.assign(existingService, serviceData);
        await existingService.save();
        console.log(`Informations du service "${serviceData.name}" mises à jour`);
        
        // Vérifier la disponibilité
        await existingService.checkAvailability();
        console.log(`Disponibilité du service "${serviceData.name}" vérifiée: ${existingService.isAvailable ? 'Disponible' : 'Indisponible'}`);
        
        continue;
      }
      
      // Créer un nouveau service
      const service = new Service(serviceData);
      await service.save();
      console.log(`Service "${service.name}" enregistré avec succès`);
      
      // Vérifier la disponibilité
      await service.checkAvailability();
      console.log(`Disponibilité du service "${service.name}" vérifiée: ${service.isAvailable ? 'Disponible' : 'Indisponible'}`);
      
      // Créer les statistiques initiales
      const stats = new ServiceStats({
        serviceId: service._id,
        alertsCount: {
          total: 0,
          pending: 0,
          inProgress: 0,
          resolved: 0,
          rejected: 0
        },
        lastActivity: {
          timestamp: new Date(),
          type: 'service_config_updated',
          details: {
            message: 'Service enregistré'
          }
        }
      });
      
      await stats.save();
      console.log(`Statistiques initiales créées pour le service "${service.name}"`);
    }

    // Fermer la connexion
    await mongoose.connection.close();
    console.log('Connexion à MongoDB fermée');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des services:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Exécuter la fonction
registerExistingServices();
