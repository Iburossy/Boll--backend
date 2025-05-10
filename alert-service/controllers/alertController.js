// backend/alert-service/controllers/alertController.js

exports.getPublicAlerts = (req, res) => {
  res.json({ message: "Liste des alertes publiques (mock)" });
};

exports.getHotspots = (req, res) => {
  res.json({ message: "Hotspots (mock)" });
};

const Alert = require('../models/Alert');
const path = require('path');

exports.createAlert = async (req, res) => {
  try {
    // Extraction des champs du body (JSON ou form-data)
    const {
      title,
      serviceName,
      description,
      category,
      subCategory,
      latitude,
      longitude,
      address,
      isAnonymous
    } = req.body;

    // Gestion de l'utilisateur (anonyme ou authentifié)
    let userId = null;
    if (!isAnonymous && req.user) {
      userId = req.user.id || req.user._id;
    }

    // Traitement des médias uploadés
    let media = [];
    if (req.files && req.files.length > 0) {
      media = req.files.map(file => {
        // Déduire le type à partir du mimetype
        let type = 'image';
        if (file.mimetype.startsWith('video/')) type = 'video';
        if (file.mimetype.startsWith('audio/')) type = 'audio';
        return {
          type,
          url: `/uploads/${file.filename}`
        };
      });
    }

    // Création de l'alerte
    const alert = new Alert({
      title,
      serviceName,
      description,
      category,
      subCategory,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      address,
      media,
      userId,
      isAnonymous: !!isAnonymous
    });

    await alert.save();

    // Réponse structurée (inclut statusLabel grâce au virtuel)
    res.status(201).json(alert.toJSON());
  } catch (err) {
    console.error('Erreur création alerte:', err);
    res.status(500).json({ error: "Erreur lors de la création de l'alerte" });
  }
};


exports.getUserAlerts = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }
    // Recherche des alertes liées à cet utilisateur (hors anonymes d'autres users)
    const alerts = await Alert.find({ userId: userId });
    // Formatage automatique grâce au virtuel statusLabel
    res.json(alerts.map(alert => alert.toJSON()));
  } catch (err) {
    console.error('Erreur récupération alertes utilisateur:', err);
    res.status(500).json({ error: "Erreur lors de la récupération des alertes utilisateur" });
  }
};

exports.getAlertById = (req, res) => {
  res.json({ message: "Détail alerte (mock)" });
};

exports.updateAlert = (req, res) => {
  res.json({ message: "Alerte mise à jour (mock)" });
};

exports.deleteAlert = (req, res) => {
  res.json({ message: "Alerte supprimée (mock)" });
};

exports.upvoteAlert = (req, res) => {
  res.json({ message: "Alerte upvotée (mock)" });
};

exports.addFeedback = (req, res) => {
  res.json({ message: "Feedback citoyen ajouté (mock)" });
};

exports.getServiceAlerts = (req, res) => {
  res.json({ message: "Alertes pour le service (mock)" });
};

exports.updateAlertStatus = (req, res) => {
  res.json({ message: "Statut d'alerte mis à jour (mock)" });
};

exports.assignAlert = (req, res) => {
  res.json({ message: "Alerte assignée (mock)" });
};

exports.addServiceFeedback = (req, res) => {
  res.json({ message: "Feedback service ajouté (mock)" });
};
