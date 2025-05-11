const mongoose = require('mongoose');
const config = require('../config/env');
const Alert = require('../models/alert');
const logger = require('../utils/logger');

// Connexion à la base de données
mongoose.connect(config.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  logger.info('Connecté à la base de données MongoDB');
  seedAlerts();
})
.catch(err => {
  logger.error(`Erreur de connexion à la base de données: ${err.message}`);
  process.exit(1);
});

// Fonction pour générer des coordonnées aléatoires dans Paris
function getRandomParisCoordinates() {
  // Coordonnées approximatives de Paris
  const minLat = 48.815573;
  const maxLat = 48.902145;
  const minLng = 2.225749;
  const maxLng = 2.469920;
  
  return [
    minLng + Math.random() * (maxLng - minLng),
    minLat + Math.random() * (maxLat - minLat)
  ];
}

// Fonction pour créer des alertes de test
async function seedAlerts() {
  try {
    // Vérifier si des alertes existent déjà
    const count = await Alert.countDocuments();
    
    if (count > 0) {
      logger.info(`${count} alertes existent déjà dans la base de données. Suppression...`);
      await Alert.deleteMany({});
    }
    
    // Créer des alertes de test
    const alerts = [
      {
        title: 'Problème d\'hygiène dans restaurant',
        description: 'Signalement de conditions d\'hygiène insuffisantes dans la cuisine d\'un restaurant.',
        status: 'new',
        priority: 'high',
        location: {
          type: 'Point',
          coordinates: getRandomParisCoordinates(),
          address: '15 Rue de la Paix, 75002 Paris'
        },
        createdBy: 'system',
        category: 'hygiene',
        comments: [
          {
            author: 'system',
            text: 'Alerte créée automatiquement suite à un signalement client',
            createdAt: new Date()
          }
        ]
      },
      {
        title: 'Présence de nuisibles dans supermarché',
        description: 'Des souris ont été aperçues dans le rayon fruits et légumes.',
        status: 'assigned',
        priority: 'critical',
        location: {
          type: 'Point',
          coordinates: getRandomParisCoordinates(),
          address: '25 Avenue des Champs-Élysées, 75008 Paris'
        },
        createdBy: 'system',
        category: 'hygiene',
        comments: [
          {
            author: 'system',
            text: 'Alerte créée suite à l\'inspection hebdomadaire',
            createdAt: new Date(Date.now() - 86400000) // 1 jour avant
          },
          {
            author: 'superviseur',
            text: 'Assignée à l\'équipe d\'intervention rapide',
            createdAt: new Date()
          }
        ]
      },
      {
        title: 'Problème de stockage alimentaire',
        description: 'Aliments périssables stockés à température ambiante dans un entrepôt.',
        status: 'in_progress',
        priority: 'medium',
        location: {
          type: 'Point',
          coordinates: getRandomParisCoordinates(),
          address: '8 Rue de Rivoli, 75004 Paris'
        },
        createdBy: 'inspector1',
        category: 'hygiene',
        comments: [
          {
            author: 'inspector1',
            text: 'Constaté lors d\'une visite de routine',
            createdAt: new Date(Date.now() - 172800000) // 2 jours avant
          },
          {
            author: 'superviseur',
            text: 'Merci de vérifier les procédures de stockage',
            createdAt: new Date(Date.now() - 86400000) // 1 jour avant
          }
        ]
      },
      {
        title: 'Contamination possible eau',
        description: 'Signalement de coloration anormale de l\'eau dans un quartier résidentiel.',
        status: 'resolved',
        priority: 'high',
        location: {
          type: 'Point',
          coordinates: getRandomParisCoordinates(),
          address: '42 Boulevard Saint-Germain, 75005 Paris'
        },
        createdBy: 'citizen',
        category: 'hygiene',
        comments: [
          {
            author: 'citizen',
            text: 'L\'eau du robinet a une couleur brunâtre depuis ce matin',
            createdAt: new Date(Date.now() - 259200000) // 3 jours avant
          },
          {
            author: 'inspector2',
            text: 'Après analyse, il s\'agit de travaux sur le réseau. L\'eau reste potable.',
            createdAt: new Date(Date.now() - 172800000) // 2 jours avant
          }
        ]
      },
      {
        title: 'Déchets médicaux mal gérés',
        description: 'Déchets médicaux non conformes aux protocoles d\'élimination dans une clinique.',
        status: 'closed',
        priority: 'critical',
        location: {
          type: 'Point',
          coordinates: getRandomParisCoordinates(),
          address: '5 Rue Monge, 75005 Paris'
        },
        createdBy: 'anonymous',
        category: 'hygiene',
        comments: [
          {
            author: 'anonymous',
            text: 'J\'ai constaté que les déchets médicaux sont mélangés aux ordures ménagères',
            createdAt: new Date(Date.now() - 604800000) // 7 jours avant
          },
          {
            author: 'inspector3',
            text: 'Inspection effectuée, des mesures correctives ont été imposées',
            createdAt: new Date(Date.now() - 518400000) // 6 jours avant
          },
          {
            author: 'supervisor',
            text: 'Suivi effectué, la situation est maintenant conforme aux normes',
            createdAt: new Date(Date.now() - 259200000) // 3 jours avant
          }
        ]
      }
    ];
    
    // Insérer les alertes dans la base de données
    await Alert.insertMany(alerts);
    
    logger.info(`${alerts.length} alertes ont été ajoutées à la base de données`);
    
    // Déconnexion de la base de données
    mongoose.disconnect();
    logger.info('Déconnecté de la base de données');
  } catch (error) {
    logger.error(`Erreur lors de la création des alertes: ${error.message}`);
    mongoose.disconnect();
    process.exit(1);
  }
}
