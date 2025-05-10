const ServiceUser = require('../models/serviceUser');
const Team = require('../models/team');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config/env');
const jwt = require('jsonwebtoken');

/**
 * Contrôleur pour l'authentification des agents du service d'hygiène
 */

/**
 * Inscription d'un nouvel agent (réservé aux administrateurs)
 * @route POST /auth/register
 * @access Privé (Admin)
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, phoneNumber, password, role, teamId } = req.body;
    
    // Vérifier si l'email est déjà utilisé
    const existingUser = await ServiceUser.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    
    // Vérifier si l'équipe existe si un teamId est fourni
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ error: 'Équipe non trouvée' });
      }
    }
    
    // Créer l'utilisateur
    const user = new ServiceUser({
      name,
      email,
      phoneNumber,
      password,
      role: role || 'inspector',
      teamId,
      createdBy: req.user.id
    });
    
    await user.save();
    
    // Si l'utilisateur est assigné à une équipe, mettre à jour l'équipe
    if (teamId) {
      await Team.findByIdAndUpdate(teamId, {
        $push: {
          members: {
            userId: user._id,
            role: role === 'technician' ? 'technician' : 'inspector',
            joinedAt: Date.now()
          }
        }
      });
    }
    
    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Connexion d'un agent
 * @route POST /auth/login
 * @access Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Valider les entrées
    if (!email || !password) {
      return res.status(400).json({ error: 'Veuillez fournir un email et un mot de passe' });
    }
    
    // Vérifier si l'utilisateur existe
    const user = await ServiceUser.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      return res.status(401).json({ error: 'Ce compte a été désactivé' });
    }
    
    // Vérifier si le mot de passe est correct
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    // Mettre à jour la date de dernière connexion
    user.lastLogin = Date.now();
    await user.save();
    
    // Générer le token JWT
    const token = user.getSignedJwtToken();
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer le profil de l'agent connecté
 * @route GET /auth/me
 * @access Privé
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await ServiceUser.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Récupérer les informations de l'équipe si l'utilisateur est assigné à une équipe
    let teamData = null;
    
    if (user.teamId) {
      const team = await Team.findById(user.teamId);
      if (team) {
        teamData = {
          id: team._id,
          name: team.name,
          specialization: team.specialization,
          memberCount: team.members.length
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        teamId: user.teamId,
        team: teamData,
        isActive: user.isActive,
        profileImage: user.profileImage,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour le profil de l'agent connecté
 * @route PUT /auth/me
 * @access Privé
 */
exports.updateMe = async (req, res, next) => {
  try {
    const { name, phoneNumber, profileImage } = req.body;
    
    // Créer l'objet de mise à jour
    const updateData = {};
    
    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (profileImage) updateData.profileImage = profileImage;
    
    // Mettre à jour l'utilisateur
    const user = await ServiceUser.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        teamId: user.teamId,
        isActive: user.isActive,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Changer le mot de passe de l'agent connecté
 * @route PUT /auth/change-password
 * @access Privé
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Veuillez fournir le mot de passe actuel et le nouveau mot de passe' });
    }
    
    // Vérifier si le nouveau mot de passe est assez long
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    // Récupérer l'utilisateur avec le mot de passe
    const user = await ServiceUser.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Vérifier si le mot de passe actuel est correct
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
    
    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Demander la réinitialisation du mot de passe
 * @route POST /auth/forgot-password
 * @access Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Veuillez fournir une adresse email' });
    }
    
    // Vérifier si l'utilisateur existe
    const user = await ServiceUser.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'Aucun utilisateur avec cette adresse email' });
    }
    
    // Générer le token de réinitialisation
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });
    
    // Créer l'URL de réinitialisation
    const resetUrl = `${req.protocol}://${req.get('host')}/api/hygiene/auth/reset-password/${resetToken}`;
    
    // Dans un environnement de production, envoyer un email avec l'URL de réinitialisation
    // Pour l'instant, nous retournons simplement l'URL
    
    res.json({
      success: true,
      message: 'Email de réinitialisation envoyé',
      resetUrl // À supprimer en production
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Réinitialiser le mot de passe
 * @route PUT /auth/reset-password/:resetToken
 * @access Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Veuillez fournir un nouveau mot de passe' });
    }
    
    // Vérifier si le nouveau mot de passe est assez long
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    // Hasher le token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Rechercher l'utilisateur avec le token et vérifier s'il est valide
    const user = await ServiceUser.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }
    
    // Mettre à jour le mot de passe
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    
    // Générer un nouveau token JWT
    const token = user.getSignedJwtToken();
    
    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer tous les agents (réservé aux administrateurs)
 * @route GET /auth/users
 * @access Privé (Admin)
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { role, teamId, isActive, page = 1, limit = 10 } = req.query;
    
    // Construire le filtre
    const filter = {};
    
    if (role) {
      filter.role = role;
    }
    
    if (teamId) {
      filter.teamId = teamId;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Calculer le nombre total d'utilisateurs correspondant au filtre
    const total = await ServiceUser.countDocuments(filter);
    
    // Récupérer les utilisateurs avec pagination
    const users = await ServiceUser.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: users.length,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      },
      data: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer un agent par ID (réservé aux administrateurs)
 * @route GET /auth/users/:userId
 * @access Privé (Admin)
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await ServiceUser.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Récupérer les informations de l'équipe si l'utilisateur est assigné à une équipe
    let teamData = null;
    
    if (user.teamId) {
      const team = await Team.findById(user.teamId);
      if (team) {
        teamData = {
          id: team._id,
          name: team.name,
          specialization: team.specialization
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        teamId: user.teamId,
        team: teamData,
        isActive: user.isActive,
        profileImage: user.profileImage,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        createdBy: user.createdBy
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour un agent (réservé aux administrateurs)
 * @route PUT /auth/users/:userId
 * @access Privé (Admin)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { name, phoneNumber, role, teamId, isActive } = req.body;
    
    // Créer l'objet de mise à jour
    const updateData = {};
    
    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Vérifier si l'équipe existe si un nouveau teamId est fourni
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ error: 'Équipe non trouvée' });
      }
      
      updateData.teamId = teamId;
    }
    
    // Récupérer l'utilisateur avant la mise à jour
    const oldUser = await ServiceUser.findById(req.params.userId);
    
    if (!oldUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Mettre à jour l'utilisateur
    const user = await ServiceUser.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true, runValidators: true }
    );
    
    // Si l'équipe a changé, mettre à jour les équipes
    if (teamId && teamId !== oldUser.teamId) {
      // Supprimer l'utilisateur de l'ancienne équipe
      if (oldUser.teamId) {
        await Team.findByIdAndUpdate(oldUser.teamId, {
          $pull: {
            members: { userId: oldUser._id }
          }
        });
      }
      
      // Ajouter l'utilisateur à la nouvelle équipe
      await Team.findByIdAndUpdate(teamId, {
        $push: {
          members: {
            userId: user._id,
            role: user.role === 'technician' ? 'technician' : 'inspector',
            joinedAt: Date.now()
          }
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        teamId: user.teamId,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Réinitialiser le mot de passe d'un agent (réservé aux administrateurs)
 * @route PUT /auth/users/:userId/reset-password
 * @access Privé (Admin)
 */
exports.adminResetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Veuillez fournir un nouveau mot de passe' });
    }
    
    // Vérifier si le nouveau mot de passe est assez long
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    // Récupérer l'utilisateur
    const user = await ServiceUser.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Mettre à jour le mot de passe
    user.password = password;
    await user.save();
    
    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Supprimer un agent (réservé aux administrateurs)
 * @route DELETE /auth/users/:userId
 * @access Privé (Admin)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    // Récupérer l'utilisateur
    const user = await ServiceUser.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Supprimer l'utilisateur de son équipe
    if (user.teamId) {
      await Team.findByIdAndUpdate(user.teamId, {
        $pull: {
          members: { userId: user._id }
        }
      });
    }
    
    // Supprimer l'utilisateur
    await user.remove();
    
    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    next(error);
  }
};
