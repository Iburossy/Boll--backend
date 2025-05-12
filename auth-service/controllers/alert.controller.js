const alertService = require('../services/alert.service');
const uploadService = require('../services/upload.service');

/**
 * Contrôleur pour la gestion des alertes
 */
class AlertController {
  /**
   * Crée une nouvelle alerte
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   */
  async createAlert(req, res) {
    try {
      const { serviceId, category, description, coordinates, address, isAnonymous } = req.body;
      
      // Vérifier que les coordonnées sont fournies (obligatoires)
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Les coordonnées de localisation sont requises (format: [longitude, latitude])'
        });
      }
      
      // Vérifier que des preuves sont fournies (au moins une obligatoire)
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Au moins une preuve (photo, vidéo ou audio) est requise'
        });
      }
      
      // Traiter les fichiers téléchargés
      const proofs = [];
      for (const file of req.files) {
        const processedFile = await uploadService.processFile(file);
        proofs.push(processedFile);
      }
      
      // Créer l'alerte
      const citizenId = req.user ? req.user.sub : null;
      
      const alertData = {
        serviceId,
        category,
        description,
        coordinates,
        address,
        isAnonymous: isAnonymous === 'true' || isAnonymous === true,
        proofs
      };
      
      const alert = await alertService.createAlert(alertData, citizenId);
      
      res.status(201).json({
        success: true,
        message: 'Alerte créée avec succès',
        data: alert
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de la création de l\'alerte'
      });
    }
  }

  /**
   * Récupère les alertes d'un citoyen
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   */
  async getMyAlerts(req, res) {
    try {
      const citizenId = req.user.sub;
      
      const alerts = await alertService.getAlertsByCitizen(citizenId);
      
      res.status(200).json({
        success: true,
        data: alerts
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de la récupération des alertes'
      });
    }
  }

  /**
   * Récupère une alerte par son ID
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   */
  async getAlertById(req, res) {
    try {
      const { id } = req.params;
      const citizenId = req.user.sub;
      
      const alert = await alertService.getAlertById(id, citizenId);
      
      res.status(200).json({
        success: true,
        data: alert
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message || 'Alerte non trouvée'
      });
    }
  }

  /**
   * Ajoute un commentaire à une alerte
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   */
  async addComment(req, res) {
    try {
      const { id } = req.params;
      const { text } = req.body;
      const citizenId = req.user.sub;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          message: 'Le texte du commentaire est requis'
        });
      }
      
      const alert = await alertService.addComment(id, text, citizenId);
      
      res.status(200).json({
        success: true,
        message: 'Commentaire ajouté avec succès',
        data: alert
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de l\'ajout du commentaire'
      });
    }
  }

  /**
   * Récupère les alertes à proximité
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   */
  async getAlertsNearby(req, res) {
    try {
      const { longitude, latitude, distance } = req.query;
      
      if (!longitude || !latitude) {
        return res.status(400).json({
          success: false,
          message: 'Les coordonnées (longitude, latitude) sont requises'
        });
      }
      
      const coordinates = [parseFloat(longitude), parseFloat(latitude)];
      const maxDistance = distance ? parseInt(distance) : 5000; // 5km par défaut
      
      const alerts = await alertService.getAlertsNearby(coordinates, maxDistance);
      
      res.status(200).json({
        success: true,
        data: alerts
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de la recherche d\'alertes à proximité'
      });
    }
  }

  /**
   * Webhook pour mettre à jour le statut d'une alerte (appelé par les services)
   * @param {Object} req - La requête HTTP
   * @param {Object} res - La réponse HTTP
   */
  async updateAlertStatus(req, res) {
    try {
      const { alertId, status, comment, updatedBy } = req.body;
      
      // Vérifier l'authentification du service (via une clé API)
      const serviceApiKey = req.headers['x-service-key'];
      if (!serviceApiKey || serviceApiKey !== process.env.SERVICE_API_KEY) {
        return res.status(401).json({
          success: false,
          message: 'Authentification requise'
        });
      }
      
      if (!alertId || !status) {
        return res.status(400).json({
          success: false,
          message: 'L\'ID de l\'alerte et le statut sont requis'
        });
      }
      
      const alert = await alertService.updateAlertStatus(alertId, status, comment, updatedBy);
      
      res.status(200).json({
        success: true,
        message: 'Statut de l\'alerte mis à jour avec succès',
        data: alert
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur lors de la mise à jour du statut'
      });
    }
  }
}

module.exports = new AlertController();
