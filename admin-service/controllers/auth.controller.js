const Admin = require('../models/admin.model');
const logger = require('../utils/logger');
const config = require('../config/env');
const jwt = require('jsonwebtoken');

/**
 * Contrôleur pour l'authentification des administrateurs
 */

/**
 * @desc    Inscription d'un nouvel administrateur (réservé aux superadmins)
 * @route   POST /auth/register
 * @access  Privé (superadmin)
 */
exports.register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;

    // Vérifier si l'administrateur existe déjà
    const adminExists = await Admin.findOne({ $or: [{ email }, { username }] });
    if (adminExists) {
      return res.status(400).json({
        success: false,
        message: "Un administrateur avec cet email ou nom d'utilisateur existe déjà"
      });
    }

    // Vérifier le rôle de l'utilisateur qui fait la demande
    if (req.admin && req.admin.role !== 'superadmin' && role === 'superadmin') {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à créer un compte superadmin"
      });
    }

    // Créer un nouvel administrateur
    const admin = await Admin.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: role || 'admin'
    });

    // Générer le token
    const token = admin.generateAuthToken();
    const refreshToken = admin.generateRefreshToken();
    
    // Sauvegarder le refresh token
    await admin.save();

    res.status(201).json({
      success: true,
      message: "Compte administrateur créé avec succès",
      data: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de l'inscription: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Connexion d'un administrateur
 * @route   POST /auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Vérifier si l'email et le mot de passe sont fournis
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Veuillez fournir un email et un mot de passe"
      });
    }

    // Vérifier si l'administrateur existe
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Identifiants invalides"
      });
    }

    // Vérifier si l'administrateur est actif
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Ce compte a été désactivé"
      });
    }

    // Vérifier si le mot de passe correspond
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Identifiants invalides"
      });
    }

    // Générer le token
    const token = admin.generateAuthToken();
    const refreshToken = admin.generateRefreshToken();
    
    // Enregistrer la dernière connexion et le refresh token
    admin.lastLogin = new Date();
    admin.refreshToken = refreshToken;
    await admin.save();

    res.status(200).json({
      success: true,
      message: "Connexion réussie",
      data: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la connexion: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Rafraîchir le token
 * @route   POST /auth/refresh-token
 * @access  Public
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token manquant"
      });
    }

    // Vérifier le refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Refresh token invalide ou expiré"
      });
    }

    // Trouver l'administrateur avec ce refresh token
    const admin = await Admin.findOne({ _id: decoded.id, refreshToken }).select('+refreshToken');
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Refresh token invalide"
      });
    }

    // Vérifier si l'administrateur est actif
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Ce compte a été désactivé"
      });
    }

    // Générer un nouveau token
    const token = admin.generateAuthToken();
    const newRefreshToken = admin.generateRefreshToken();
    
    // Sauvegarder le nouveau refresh token
    admin.refreshToken = newRefreshToken;
    await admin.save();

    res.status(200).json({
      success: true,
      message: "Token rafraîchi avec succès",
      data: {
        token,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    logger.error(`Erreur lors du rafraîchissement du token: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Déconnexion
 * @route   POST /auth/logout
 * @access  Privé
 */
exports.logout = async (req, res, next) => {
  try {
    // Récupérer l'ID de l'administrateur depuis le token
    const adminId = req.admin.id;

    // Trouver l'administrateur et effacer son refresh token
    await Admin.findByIdAndUpdate(adminId, { refreshToken: null });

    res.status(200).json({
      success: true,
      message: "Déconnexion réussie"
    });
  } catch (error) {
    logger.error(`Erreur lors de la déconnexion: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Obtenir le profil de l'administrateur connecté
 * @route   GET /auth/me
 * @access  Privé
 */
exports.getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);

    res.status(200).json({
      success: true,
      data: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération du profil: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Mettre à jour le profil de l'administrateur connecté
 * @route   PUT /auth/me
 * @access  Privé
 */
exports.updateMe = async (req, res, next) => {
  try {
    const { firstName, lastName, email, username } = req.body;

    // Vérifier si l'email ou le nom d'utilisateur existe déjà
    if (email || username) {
      const existingAdmin = await Admin.findOne({
        $and: [
          { _id: { $ne: req.admin.id } },
          { $or: [
            { email: email || '' },
            { username: username || '' }
          ]}
        ]
      });

      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: "Cet email ou nom d'utilisateur est déjà utilisé"
        });
      }
    }

    // Mettre à jour le profil
    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.admin.id,
      {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: email || undefined,
        username: username || undefined
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Profil mis à jour avec succès",
      data: {
        id: updatedAdmin._id,
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        firstName: updatedAdmin.firstName,
        lastName: updatedAdmin.lastName,
        role: updatedAdmin.role
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du profil: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Changer le mot de passe
 * @route   PUT /auth/change-password
 * @access  Privé
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Vérifier si les mots de passe sont fournis
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Veuillez fournir le mot de passe actuel et le nouveau mot de passe"
      });
    }

    // Vérifier si le nouveau mot de passe est assez long
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Le nouveau mot de passe doit contenir au moins 6 caractères"
      });
    }

    // Trouver l'administrateur avec son mot de passe
    const admin = await Admin.findById(req.admin.id).select('+password');

    // Vérifier si le mot de passe actuel est correct
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Le mot de passe actuel est incorrect"
      });
    }

    // Mettre à jour le mot de passe
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      success: true,
      message: "Mot de passe changé avec succès"
    });
  } catch (error) {
    logger.error(`Erreur lors du changement de mot de passe: ${error.message}`);
    next(error);
  }
};
