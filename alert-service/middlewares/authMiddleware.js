// Middleware d'authentification JWT sécurisé
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'changeme-secret';

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token JWT manquant' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token JWT invalide' });
    }
    req.user = decoded;
    next();
  });
};

exports.verifyServiceAccess = (req, res, next) => {
  // Nécessite un token valide + rôle service
  exports.verifyToken(req, res, function() {
    if (!req.user || req.user.role !== 'service') {
      return res.status(403).json({ error: 'Accès réservé aux services' });
    }
    next();
  });
};
