const mongoose = require('mongoose');
const Team = require('../models/team');
const logger = require('../utils/logger');

/**
 * Contrôleur pour la gestion des équipes d'hygiène
 */

/**
 * Récupérer toutes les équipes
 * @route GET /teams
 * @access Privé
 */
exports.getTeams = async (req, res, next) => {
  try {
    const { specialization, search, page = 1, limit = 10 } = req.query;
    
    // Construire le filtre pour la requête MongoDB
    const filter = {};
    
    if (specialization) {
      filter.specialization = specialization;
    }
    
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    
    // Calculer le nombre total d'équipes correspondant au filtre
    const total = await Team.countDocuments(filter);
    
    // Calculer le nombre de pages et les informations de pagination
    const limitNum = parseInt(limit) || 10;
    const pageNum = parseInt(page) || 1;
    const totalPages = Math.ceil(total / limitNum);
    const skip = (pageNum - 1) * limitNum;
    
    // Récupérer les équipes avec pagination
    const teams = await Team.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum);
    
    // Transformer les données pour le frontend
    const transformedTeams = teams.map(team => ({
      id: team._id,
      name: team.name,
      description: team.description || '',
      leaderId: team.supervisorId,
      members: team.members.map(member => member.userId),
      zone: team.assignedZones && team.assignedZones.length > 0 ? {
        id: team.assignedZones[0],
        name: 'Zone assignée' // Idéalement, on récupérerait le nom de la zone
      } : null,
      specialization: team.specialization,
      activeInspections: team.activeInspections,
      completedInspections: team.completedInspections,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    }));
    
    logger.info(`${transformedTeams.length} équipes récupérées avec succès (page ${pageNum}/${totalPages})`);
    
    res.json({
      success: true,
      data: transformedTeams,
      pagination: {
        total,
        totalPages,
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des équipes: ${error.message}`);
    next(error);
  }
};

/**
 * Récupérer une équipe par son ID
 * @route GET /teams/:id
 * @access Privé
 */
exports.getTeamById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID d\'équipe invalide'
      });
    }
    
    const team = await Team.findById(id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Équipe non trouvée'
      });
    }
    
    // Transformer les données pour le frontend
    const transformedTeam = {
      id: team._id,
      name: team.name,
      description: team.description || '',
      leaderId: team.supervisorId,
      members: team.members.map(member => member.userId),
      zone: team.assignedZones && team.assignedZones.length > 0 ? {
        id: team.assignedZones[0],
        name: 'Zone assignée' // Idéalement, on récupérerait le nom de la zone
      } : null,
      specialization: team.specialization,
      activeInspections: team.activeInspections,
      completedInspections: team.completedInspections,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    };
    
    logger.info(`Détails de l'équipe ${id} récupérés avec succès`);
    
    res.json({
      success: true,
      data: transformedTeam
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération de l'équipe ${req.params.id}: ${error.message}`);
    next(error);
  }
};

/**
 * Créer une nouvelle équipe
 * @route POST /teams
 * @access Privé (Superviseur)
 */
exports.createTeam = async (req, res, next) => {
  try {
    const { name, description, supervisorId, members = [], specialization = 'general', assignedZones = [] } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Le nom de l\'équipe est obligatoire'
      });
    }
    
    // Vérifier si une équipe avec le même nom existe déjà
    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return res.status(400).json({
        success: false,
        error: 'Une équipe avec ce nom existe déjà'
      });
    }
    
    // Créer la nouvelle équipe
    const newTeam = new Team({
      name,
      description,
      supervisorId: supervisorId || req.user.id, // Utiliser l'ID de l'utilisateur actuel comme superviseur par défaut
      members: members.map(userId => ({
        userId,
        role: 'inspector',
        joinedAt: new Date()
      })),
      specialization,
      assignedZones
    });
    
    await newTeam.save();
    
    // Transformer les données pour le frontend
    const transformedTeam = {
      id: newTeam._id,
      name: newTeam.name,
      description: newTeam.description || '',
      leaderId: newTeam.supervisorId,
      members: newTeam.members.map(member => member.userId),
      zone: newTeam.assignedZones && newTeam.assignedZones.length > 0 ? {
        id: newTeam.assignedZones[0],
        name: 'Zone assignée'
      } : null,
      specialization: newTeam.specialization,
      activeInspections: 0,
      completedInspections: 0,
      createdAt: newTeam.createdAt,
      updatedAt: newTeam.updatedAt
    };
    
    logger.info(`Nouvelle équipe créée avec succès: ${newTeam.name}`);
    
    res.status(201).json({
      success: true,
      data: transformedTeam
    });
  } catch (error) {
    logger.error(`Erreur lors de la création de l'équipe: ${error.message}`);
    next(error);
  }
};

/**
 * Mettre à jour une équipe
 * @route PUT /teams/:id
 * @access Privé (Superviseur)
 */
exports.updateTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, supervisorId, specialization, assignedZones } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID d\'équipe invalide'
      });
    }
    
    // Vérifier si l'équipe existe
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Équipe non trouvée'
      });
    }
    
    // Vérifier si le nom est déjà utilisé par une autre équipe
    if (name && name !== team.name) {
      const existingTeam = await Team.findOne({ name });
      if (existingTeam && existingTeam._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          error: 'Une équipe avec ce nom existe déjà'
        });
      }
    }
    
    // Mettre à jour les champs
    if (name) team.name = name;
    if (description !== undefined) team.description = description;
    if (supervisorId) team.supervisorId = supervisorId;
    if (specialization) team.specialization = specialization;
    if (assignedZones) team.assignedZones = assignedZones;
    
    await team.save();
    
    // Transformer les données pour le frontend
    const transformedTeam = {
      id: team._id,
      name: team.name,
      description: team.description || '',
      leaderId: team.supervisorId,
      members: team.members.map(member => member.userId),
      zone: team.assignedZones && team.assignedZones.length > 0 ? {
        id: team.assignedZones[0],
        name: 'Zone assignée'
      } : null,
      specialization: team.specialization,
      activeInspections: team.activeInspections,
      completedInspections: team.completedInspections,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    };
    
    logger.info(`Équipe ${id} mise à jour avec succès`);
    
    res.json({
      success: true,
      data: transformedTeam
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour de l'équipe ${req.params.id}: ${error.message}`);
    next(error);
  }
};

/**
 * Supprimer une équipe
 * @route DELETE /teams/:id
 * @access Privé (Superviseur)
 */
exports.deleteTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID d\'équipe invalide'
      });
    }
    
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Équipe non trouvée'
      });
    }
    
    // Vérifier si l'équipe a des inspections actives
    if (team.activeInspections > 0) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer une équipe avec des inspections actives'
      });
    }
    
    await Team.findByIdAndDelete(id);
    
    logger.info(`Équipe ${id} supprimée avec succès`);
    
    res.json({
      success: true,
      message: 'Équipe supprimée avec succès'
    });
  } catch (error) {
    logger.error(`Erreur lors de la suppression de l'équipe ${req.params.id}: ${error.message}`);
    next(error);
  }
};

/**
 * Ajouter un membre à une équipe
 * @route POST /teams/:id/members
 * @access Privé (Superviseur)
 */
exports.addTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role = 'inspector' } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID d\'équipe invalide'
      });
    }
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID d\'utilisateur obligatoire'
      });
    }
    
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Équipe non trouvée'
      });
    }
    
    // Vérifier si l'utilisateur est déjà membre de l'équipe
    const existingMember = team.members.find(member => member.userId === userId);
    if (existingMember) {
      return res.status(400).json({
        success: false,
        error: 'L\'utilisateur est déjà membre de cette équipe'
      });
    }
    
    // Ajouter le membre à l'équipe
    team.members.push({
      userId,
      role,
      joinedAt: new Date()
    });
    
    await team.save();
    
    // Transformer les données pour le frontend
    const transformedTeam = {
      id: team._id,
      name: team.name,
      description: team.description || '',
      leaderId: team.supervisorId,
      members: team.members.map(member => member.userId),
      zone: team.assignedZones && team.assignedZones.length > 0 ? {
        id: team.assignedZones[0],
        name: 'Zone assignée'
      } : null,
      specialization: team.specialization,
      activeInspections: team.activeInspections,
      completedInspections: team.completedInspections,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    };
    
    logger.info(`Membre ${userId} ajouté à l'équipe ${id} avec succès`);
    
    res.json({
      success: true,
      data: transformedTeam
    });
  } catch (error) {
    logger.error(`Erreur lors de l'ajout d'un membre à l'équipe ${req.params.id}: ${error.message}`);
    next(error);
  }
};

/**
 * Retirer un membre d'une équipe
 * @route DELETE /teams/:id/members/:userId
 * @access Privé (Superviseur)
 */
exports.removeTeamMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID d\'équipe invalide'
      });
    }
    
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Équipe non trouvée'
      });
    }
    
    // Vérifier si l'utilisateur est membre de l'équipe
    const memberIndex = team.members.findIndex(member => member.userId === userId);
    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Membre non trouvé dans cette équipe'
      });
    }
    
    // Vérifier si l'utilisateur est le superviseur de l'équipe
    if (team.supervisorId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de retirer le superviseur de l\'équipe'
      });
    }
    
    // Retirer le membre de l'équipe
    team.members.splice(memberIndex, 1);
    
    await team.save();
    
    // Transformer les données pour le frontend
    const transformedTeam = {
      id: team._id,
      name: team.name,
      description: team.description || '',
      leaderId: team.supervisorId,
      members: team.members.map(member => member.userId),
      zone: team.assignedZones && team.assignedZones.length > 0 ? {
        id: team.assignedZones[0],
        name: 'Zone assignée'
      } : null,
      specialization: team.specialization,
      activeInspections: team.activeInspections,
      completedInspections: team.completedInspections,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    };
    
    logger.info(`Membre ${userId} retiré de l'équipe ${id} avec succès`);
    
    res.json({
      success: true,
      data: transformedTeam
    });
  } catch (error) {
    logger.error(`Erreur lors du retrait d'un membre de l'équipe ${req.params.id}: ${error.message}`);
    next(error);
  }
};

/**
 * Obtenir les statistiques des équipes
 * @route GET /teams/stats
 * @access Privé
 */
exports.getTeamStats = async (req, res, next) => {
  try {
    // Nombre total d'équipes
    const totalTeams = await Team.countDocuments();
    
    // Nombre d'équipes par spécialisation
    const teamsBySpecialization = await Team.aggregate([
      { $group: { _id: '$specialization', count: { $sum: 1 } } }
    ]);
    
    const specializationStats = {};
    teamsBySpecialization.forEach(item => {
      specializationStats[item._id] = item.count;
    });
    
    // Équipe avec le plus d'inspections complétées
    const topTeam = await Team.findOne().sort({ completedInspections: -1 }).limit(1);
    
    // Nombre moyen de membres par équipe
    const teamSizes = await Team.aggregate([
      { $project: { memberCount: { $size: '$members' } } },
      { $group: { _id: null, averageSize: { $avg: '$memberCount' } } }
    ]);
    
    const averageTeamSize = teamSizes.length > 0 ? teamSizes[0].averageSize : 0;
    
    // Statistiques sur les inspections
    const inspectionStats = await Team.aggregate([
      { $group: {
        _id: null,
        totalActive: { $sum: '$activeInspections' },
        totalCompleted: { $sum: '$completedInspections' }
      }}
    ]);
    
    const stats = {
      totalTeams,
      bySpecialization: specializationStats,
      topTeam: topTeam ? {
        id: topTeam._id,
        name: topTeam.name,
        completedInspections: topTeam.completedInspections
      } : null,
      averageTeamSize,
      inspections: inspectionStats.length > 0 ? {
        active: inspectionStats[0].totalActive,
        completed: inspectionStats[0].totalCompleted,
        total: inspectionStats[0].totalActive + inspectionStats[0].totalCompleted
      } : { active: 0, completed: 0, total: 0 }
    };
    
    logger.info('Statistiques des équipes récupérées avec succès');
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques des équipes: ${error.message}`);
    next(error);
  }
};
