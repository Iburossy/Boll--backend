const Alert = require('../models/alert.model');
const AvailableService = require('../models/available-service.model');
const axios = require('axios');

/**
 * Service pour la gestion des alertes créées par les citoyens
 */
class AlertService {
  /**
   * Crée une nouvelle alerte
   * @param {Object} alertData - Les données de l'alerte
   * @param {string} citizenId - L'ID du citoyen (null si anonyme)
   * @returns {Promise<Object>} L'alerte créée
   */
  async createAlert(alertData, citizenId = null) {
    try {
      // Vérifier si le service existe et est actif
      const service = await AvailableService.findById(alertData.serviceId);
      if (!service || !service.isActive) {
        throw new Error('Service non trouvé ou inactif');
      }

      // Créer la nouvelle alerte
      const alert = new Alert({
        citizenId: alertData.isAnonymous ? null : citizenId,
        service: service._id,
        category: alertData.category,
        description: alertData.description,
        location: {
          type: 'Point',
          coordinates: alertData.coordinates, // [longitude, latitude]
          address: alertData.address
        },
        proofs: alertData.proofs,
        isAnonymous: alertData.isAnonymous,
        status: 'pending',
        statusHistory: [{
          status: 'pending',
          comment: 'Alerte créée',
          updatedAt: new Date()
        }]
      });

      // Sauvegarder l'alerte
      await alert.save();

      // Transmettre l'alerte au service concerné
      await this.forwardAlertToService(alert, service);

      return alert;
    } catch (error) {
      console.error('Erreur lors de la création de l\'alerte:', error);
      throw error;
    }
  }

  /**
   * Transmet une alerte au service concerné
   * @param {Object} alert - L'alerte à transmettre
   * @param {Object} service - Le service concerné
   * @returns {Promise<Object>} Résultat de la transmission
   */
  async forwardAlertToService(alert, service) {
    try {
      // Préparer les données à envoyer au service
      const alertData = {
        alertId: alert._id,
        category: alert.category,
        description: alert.description,
        location: alert.location,
        proofs: alert.proofs,
        isAnonymous: alert.isAnonymous,
        citizenId: alert.citizenId,
        createdAt: alert.createdAt
      };

      // Envoyer l'alerte au service via son API
      const endpoint = `${service.apiUrl}/alerts`;
      const response = await axios.post(endpoint, alertData, {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': process.env.SERVICE_API_KEY // Clé d'API pour l'authentification entre services
        },
        timeout: 10000 // 10 secondes
      });

      // Mettre à jour l'alerte avec l'ID de référence du service
      if (response.data && response.data.serviceReferenceId) {
        alert.serviceReferenceId = response.data.serviceReferenceId;
        await alert.save();
      }

      return response.data;
    } catch (error) {
      console.error(`Erreur lors de la transmission de l'alerte au service ${service.name}:`, error);
      
      // Même en cas d'erreur, l'alerte est créée dans notre système
      // Elle pourra être retransmise ultérieurement
      
      // Ajouter un commentaire sur l'échec de transmission
      alert.addComment(
        `Échec de la transmission au service. Raison: ${error.message}`,
        'Système',
        null
      );
      
      throw error;
    }
  }

  /**
   * Récupère les alertes d'un citoyen
   * @param {string} citizenId - L'ID du citoyen
   * @returns {Promise<Array>} Liste des alertes du citoyen
   */
  async getAlertsByCitizen(citizenId) {
    try {
      return await Alert.find({ citizenId })
        .populate('service', 'name icon color')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error(`Erreur lors de la récupération des alertes du citoyen ${citizenId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère une alerte par son ID
   * @param {string} alertId - L'ID de l'alerte
   * @param {string} citizenId - L'ID du citoyen (pour vérification)
   * @returns {Promise<Object>} L'alerte trouvée
   */
  async getAlertById(alertId, citizenId = null) {
    try {
      const query = { _id: alertId };
      
      // Si un citizenId est fourni, vérifier que l'alerte appartient bien à ce citoyen
      if (citizenId) {
        query.citizenId = citizenId;
      }
      
      const alert = await Alert.findOne(query)
        .populate('service', 'name icon color endpoint apiUrl')
        .populate('citizenId', 'fullName email phone');
        
      if (!alert) {
        throw new Error('Alerte non trouvée ou accès non autorisé');
      }
      
      return alert;
    } catch (error) {
      console.error(`Erreur lors de la récupération de l'alerte ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Ajoute un commentaire à une alerte
   * @param {string} alertId - L'ID de l'alerte
   * @param {string} text - Le texte du commentaire
   * @param {string} citizenId - L'ID du citoyen
   * @returns {Promise<Object>} L'alerte mise à jour
   */
  async addComment(alertId, text, citizenId) {
    try {
      const alert = await this.getAlertById(alertId, citizenId);
      
      await alert.addComment(text, 'Citoyen', citizenId);
      
      // Transmettre le commentaire au service concerné
      try {
        const service = await AvailableService.findById(alert.service);
        
        const endpoint = `${service.apiUrl}/alerts/${alert.serviceReferenceId || alert._id}/comments`;
        await axios.post(endpoint, {
          text,
          authorType: 'citizen',
          citizenId
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': process.env.SERVICE_API_KEY
          }
        });
      } catch (error) {
        console.error(`Erreur lors de la transmission du commentaire au service:`, error);
        // Ne pas bloquer l'ajout du commentaire dans notre système
      }
      
      return alert;
    } catch (error) {
      console.error(`Erreur lors de l'ajout du commentaire à l'alerte ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les alertes à proximité d'une localisation
   * @param {Array} coordinates - Coordonnées [longitude, latitude]
   * @param {number} maxDistance - Distance maximale en mètres
   * @returns {Promise<Array>} Liste des alertes à proximité
   */
  async getAlertsNearby(coordinates, maxDistance = 5000) {
    try {
      return await Alert.find({
        'location.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates
            },
            $maxDistance: maxDistance
          }
        },
        // Ne pas inclure les alertes anonymes dans les recherches de proximité
        isAnonymous: false
      })
      .populate('service', 'name icon color')
      .sort({ createdAt: -1 })
      .limit(50); // Limiter le nombre de résultats
    } catch (error) {
      console.error('Erreur lors de la recherche d\'alertes à proximité:', error);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une alerte (généralement appelé par le webhook du service)
   * @param {string} alertId - L'ID de l'alerte
   * @param {string} status - Le nouveau statut
   * @param {string} comment - Commentaire sur le changement de statut
   * @param {string} updatedBy - Qui a mis à jour le statut
   * @returns {Promise<Object>} L'alerte mise à jour
   */
  async updateAlertStatus(alertId, status, comment, updatedBy) {
    try {
      const alert = await Alert.findById(alertId);
      
      if (!alert) {
        throw new Error('Alerte non trouvée');
      }
      
      await alert.changeStatus(status, comment, updatedBy);
      
      return alert;
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du statut de l'alerte ${alertId}:`, error);
      throw error;
    }
  }
}

module.exports = new AlertService();
