const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Routes pour la gestion des équipes
 */

// Récupérer toutes les équipes
router.get('/', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamController.getTeams);

// Obtenir les statistiques des équipes
router.get('/stats', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamController.getTeamStats);

// Récupérer une équipe par son ID
router.get('/:id', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamController.getTeamById);

// Créer une nouvelle équipe
router.post('/', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamController.createTeam);

// Mettre à jour une équipe
router.put('/:id', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamController.updateTeam);

// Supprimer une équipe
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamController.deleteTeam);

// Ajouter un membre à une équipe
router.post('/:id/members', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamController.addTeamMember);

// Retirer un membre d'une équipe
router.delete('/:id/members/:userId', authMiddleware.verifyToken, authMiddleware.isHygieneService, teamController.removeTeamMember);

module.exports = router;
