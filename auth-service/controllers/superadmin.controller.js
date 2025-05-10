const User = require('../models/user.model');
const { ApiError } = require('../utils/ApiError');
const { ApiResponse } = require('../utils/ApiResponse');
const catchAsync = require('../utils/catchAsync');

/**
 * Récupérer tous les utilisateurs
 */
const getAllUsers = catchAsync(async (req, res) => {
  console.log('[SUPERADMIN CONTROLLER] getAllUsers - Requête reçue');
  console.log('[SUPERADMIN CONTROLLER] Headers:', req.headers);
  console.log('[SUPERADMIN CONTROLLER] User:', req.user);
  
  try {
    const users = await User.find({}).select('-password');
    console.log(`[SUPERADMIN CONTROLLER] ${users.length} utilisateurs trouvés`);
    
    return res.json(new ApiResponse(200, users, 'Utilisateurs récupérés avec succès'));
  } catch (error) {
    console.error('[SUPERADMIN CONTROLLER] Erreur lors de la récupération des utilisateurs:', error);
    throw error;
  }
});

/**
 * Récupérer les utilisateurs par rôle
 */
const getUsersByRole = catchAsync(async (req, res) => {
  const { role } = req.params;
  
  if (!['citizen', 'agent', 'admin'].includes(role)) {
    throw new ApiError(400, 'Rôle invalide');
  }
  
  const users = await User.find({ role }).select('-password');
  
  return res.json(new ApiResponse(200, users, `Utilisateurs avec le rôle ${role} récupérés avec succès`));
});

/**
 * Créer un administrateur
 */
const createAdmin = catchAsync(async (req, res) => {
  console.log('[SUPERADMIN CONTROLLER] createAdmin - Requête reçue');
  console.log('[SUPERADMIN CONTROLLER] createAdmin - Body:', req.body);
  
  const { fullName, email, phone, password, service, region } = req.body;
  console.log(`[SUPERADMIN CONTROLLER] createAdmin - Tentative de création d'un admin avec l'email: ${email}`);
  
  try {
    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    console.log(`[SUPERADMIN CONTROLLER] createAdmin - Email existant: ${existingUser ? 'Oui' : 'Non'}`);
    
    if (existingUser) {
      console.log(`[SUPERADMIN CONTROLLER] createAdmin - Email déjà utilisé: ${email}`);
      throw new ApiError(400, 'Cet email est déjà utilisé');
    }
    
    // Créer un nouvel administrateur
    console.log(`[SUPERADMIN CONTROLLER] createAdmin - Création de l'administrateur en cours...`);
    const newAdmin = await User.create({
      fullName,
      email,
      phone,
      password,
      role: 'admin',
      service,
      region,
      isVerified: true // Les admins sont vérifiés par défaut
    });
    console.log(`[SUPERADMIN CONTROLLER] createAdmin - Administrateur créé avec l'ID: ${newAdmin._id}`);
    
    // Supprimer le mot de passe de la réponse
    const adminWithoutPassword = await User.findById(newAdmin._id).select('-password');
    
    console.log(`[SUPERADMIN CONTROLLER] createAdmin - Succès pour l'email: ${email}`);
    return res.status(201).json(new ApiResponse(201, adminWithoutPassword, 'Administrateur créé avec succès'));
  } catch (error) {
    console.error(`[SUPERADMIN CONTROLLER] createAdmin - ERREUR:`, error);
    throw error;
  }
});

/**
 * Créer un agent
 */
const createAgent = catchAsync(async (req, res) => {
  console.log('[SUPERADMIN CONTROLLER] createAgent - Requête reçue');
  console.log('[SUPERADMIN CONTROLLER] createAgent - Body:', req.body);
  
  const { fullName, email, phone, password, service, region } = req.body;
  console.log(`[SUPERADMIN CONTROLLER] createAgent - Tentative de création d'un agent avec l'email: ${email}`);
  console.log(`[SUPERADMIN CONTROLLER] createAgent - Service: ${service}, Région: ${region}`);
  
  try {
    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    console.log(`[SUPERADMIN CONTROLLER] createAgent - Email existant: ${existingUser ? 'Oui' : 'Non'}`);
    
    if (existingUser) {
      console.log(`[SUPERADMIN CONTROLLER] createAgent - Email déjà utilisé: ${email}`);
      throw new ApiError(400, 'Cet email est déjà utilisé');
    }
    
    // Créer un nouvel agent
    console.log(`[SUPERADMIN CONTROLLER] createAgent - Création de l'agent en cours...`);
    console.log(`[SUPERADMIN CONTROLLER] createAgent - Données: `, {
      fullName,
      email,
      phone,
      // Ne pas logger le mot de passe
      role: 'agent',
      service,
      region,
      isVerified: true
    });
    
    const newAgent = await User.create({
      fullName,
      email,
      phone,
      password,
      role: 'agent',
      service,
      region,
      isVerified: true // Les agents sont vérifiés par défaut
    });
    console.log(`[SUPERADMIN CONTROLLER] createAgent - Agent créé avec l'ID: ${newAgent._id}`);
    
    // Supprimer le mot de passe de la réponse
    const agentWithoutPassword = await User.findById(newAgent._id).select('-password');
    
    console.log(`[SUPERADMIN CONTROLLER] createAgent - Succès pour l'email: ${email}`);
    return res.status(201).json(new ApiResponse(201, agentWithoutPassword, 'Agent créé avec succès'));
  } catch (error) {
    console.error(`[SUPERADMIN CONTROLLER] createAgent - ERREUR:`, error);
    throw error;
  }
});

/**
 * Mettre à jour un utilisateur
 */
const updateUser = catchAsync(async (req, res) => {
  console.log('[SUPERADMIN CONTROLLER] updateUser - Requête reçue');
  console.log('[SUPERADMIN CONTROLLER] updateUser - Params:', req.params);
  console.log('[SUPERADMIN CONTROLLER] updateUser - Body:', req.body);
  
  const { userId } = req.params;
  const updateData = req.body;
  
  try {
    // Empêcher la mise à jour du rôle superadmin
    if (updateData.role === 'superadmin') {
      console.log(`[SUPERADMIN CONTROLLER] updateUser - Tentative d'attribution du rôle superadmin non autorisée`);
      throw new ApiError(403, 'Vous ne pouvez pas attribuer le rôle superadmin');
    }
    
    // Vérifier si l'utilisateur existe
    console.log(`[SUPERADMIN CONTROLLER] updateUser - Recherche de l'utilisateur avec l'ID: ${userId}`);
    const user = await User.findById(userId);
    console.log(`[SUPERADMIN CONTROLLER] updateUser - Utilisateur trouvé: ${user ? 'Oui' : 'Non'}`);
    
    if (!user) {
      console.log(`[SUPERADMIN CONTROLLER] updateUser - Utilisateur non trouvé avec l'ID: ${userId}`);
      throw new ApiError(404, 'Utilisateur non trouvé');
    }
    
    // Empêcher la modification d'un superadmin
    if (user.role === 'superadmin') {
      console.log(`[SUPERADMIN CONTROLLER] updateUser - Tentative de modification d'un superadmin non autorisée`);
      throw new ApiError(403, 'Vous ne pouvez pas modifier un superadmin');
    }
    
    // Mettre à jour l'utilisateur
    console.log(`[SUPERADMIN CONTROLLER] updateUser - Mise à jour de l'utilisateur en cours...`);
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    console.log(`[SUPERADMIN CONTROLLER] updateUser - Utilisateur mis à jour avec succès: ${updatedUser._id}`);
    
    return res.json(new ApiResponse(200, updatedUser, 'Utilisateur mis à jour avec succès'));
  } catch (error) {
    console.error(`[SUPERADMIN CONTROLLER] updateUser - ERREUR:`, error);
    throw error;
  }
});

/**
 * Désactiver un utilisateur
 */
const disableUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  
  // Vérifier si l'utilisateur existe
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Utilisateur non trouvé');
  }
  
  // Empêcher la désactivation d'un superadmin
  if (user.role === 'superadmin') {
    throw new ApiError(403, 'Vous ne pouvez pas désactiver un superadmin');
  }
  
  // Désactiver l'utilisateur (nous ajouterons un champ isActive au modèle utilisateur)
  user.isActive = false;
  await user.save();
  
  return res.json(new ApiResponse(200, null, 'Utilisateur désactivé avec succès'));
});

/**
 * Approuver la vérification d'identité d'un utilisateur
 */
const approveIdentityVerification = catchAsync(async (req, res) => {
  const { userId } = req.params;
  
  // Vérifier si l'utilisateur existe
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Utilisateur non trouvé');
  }
  
  // Vérifier si l'utilisateur a téléchargé un document d'identité
  if (!user.idDocument || !user.idDocument.url) {
    throw new ApiError(400, 'L\'utilisateur n\'a pas téléchargé de document d\'identité');
  }
  
  // Approuver la vérification d'identité
  user.idDocument.verified = true;
  await user.save();
  
  return res.json(new ApiResponse(200, null, 'Vérification d\'identité approuvée avec succès'));
});

/**
 * Rejeter la vérification d'identité d'un utilisateur
 */
const rejectIdentityVerification = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  
  // Vérifier si l'utilisateur existe
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Utilisateur non trouvé');
  }
  
  // Vérifier si l'utilisateur a téléchargé un document d'identité
  if (!user.idDocument || !user.idDocument.url) {
    throw new ApiError(400, 'L\'utilisateur n\'a pas téléchargé de document d\'identité');
  }
  
  // Rejeter la vérification d'identité
  user.idDocument.verified = false;
  user.idDocument.rejectionReason = reason;
  await user.save();
  
  return res.json(new ApiResponse(200, null, 'Vérification d\'identité rejetée avec succès'));
});

module.exports = {
  getAllUsers,
  getUsersByRole,
  createAdmin,
  createAgent,
  updateUser,
  disableUser,
  approveIdentityVerification,
  rejectIdentityVerification
};
