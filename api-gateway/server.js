require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('./middlewares/auth.middleware');
const gatewayMiddleware = require('./middlewares/gateway.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de base (sécurité, CORS, logging)
app.use(helmet()); // Sécurité
app.use(cors()); // Gestion des CORS
app.use(morgan('combined')); // Logging

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes par défaut
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limite chaque IP à 100 requêtes par fenêtre par défaut
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Middleware pour vérifier le token et ajouter les informations utilisateur aux en-têtes
app.use(gatewayMiddleware.verifyTokenAndAddUserInfo);

// Routes de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenue sur l\'API Bollé',
    version: '1.0.0',
    status: 'online'
  });
});

// Route pour vérifier l'état de l'API Gateway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Proxy vers les microservices
// Service d'authentification
app.use('/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: { '^/auth': '/' }
}));

// Service d'alertes (la plupart des routes nécessitent une authentification)
app.use('/alerts', 
  // Middleware pour vérifier l'authentification pour les routes protégées
  (req, res, next) => {
    // Les routes publiques ne nécessitent pas d'authentification
    const publicRoutes = ['/alerts/public', '/alerts/hotspots'];
    if (publicRoutes.some(route => req.url.startsWith(route))) {
      return next();
    }
    // Pour les autres routes, vérifier l'authentification
    gatewayMiddleware.requireAuth(req, res, next);
  },
  createProxyMiddleware({
    target: process.env.ALERT_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/alerts': '/' }
  })
);

// Service utilisateurs (toutes les routes nécessitent une authentification)
app.use('/users', 
  gatewayMiddleware.requireAuth,
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL || 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: { '^/users': '/' }
  })
);

// Service médias (toutes les routes nécessitent une authentification)
app.use('/media', 
  gatewayMiddleware.requireAuth,
  createProxyMiddleware({
    target: process.env.MEDIA_SERVICE_URL || 'http://localhost:3004',
    changeOrigin: true,
    pathRewrite: { '^/media': '/' }
  })
);

// Service notifications (toutes les routes nécessitent une authentification)
app.use('/notifications', 
  gatewayMiddleware.requireAuth,
  createProxyMiddleware({
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
    changeOrigin: true,
    pathRewrite: { '^/notifications': '/' }
  })
);

// Service de gestion des services publics (certaines routes nécessitent une authentification)
app.use('/services', 
  // Middleware pour vérifier l'authentification pour les routes protégées
  (req, res, next) => {
    // Les routes publiques ne nécessitent pas d'authentification
    const publicRoutes = ['/services/public', '/services/list'];
    if (publicRoutes.some(route => req.url.startsWith(route))) {
      return next();
    }
    // Pour les autres routes, vérifier l'authentification
    gatewayMiddleware.requireAuth(req, res, next);
  },
  createProxyMiddleware({
    target: process.env.SERVICE_MANAGEMENT_URL || 'http://localhost:3007',
    changeOrigin: true,
    pathRewrite: { '^/services': '/services' },
    // Options supplémentaires pour résoudre les problèmes de timeout
    timeout: 60000, // Augmenter le timeout à 60 secondes
    proxyTimeout: 60000,
    // Options de débogage
    logLevel: 'debug',
    onError: (err, req, res) => {
      console.error('Erreur de proxy pour le service-management:', err);
      res.writeHead(500, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        success: false,
        message: `Erreur de proxy: ${err.message}`,
        error: err.code
      }));
    }
  })
);

// Service analytiques (nécessite un rôle d'admin ou d'agent)
app.use('/analytics', 
  gatewayMiddleware.requireAuth,
  gatewayMiddleware.checkRole(['admin', 'superadmin', 'agent']),
  createProxyMiddleware({
    target: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006',
    changeOrigin: true,
    pathRewrite: { '^/analytics': '/' }
  })
);

// Service d'hygiène (nécessite une authentification et un rôle spécifique)
app.use('/hygiene', 
  gatewayMiddleware.requireAuth,
  // Vérifier si l'utilisateur a un rôle dans le service d'hygiène
  (req, res, next) => {
    // Vérifier si la route est publique (login, etc.)
    if (req.url.startsWith('/auth/login') || req.url.startsWith('/auth/forgot-password')) {
      return next();
    }
    
    // Vérifier si l'utilisateur a un rôle dans le service d'hygiène
    const user = req.user;
    if (!user || !user.serviceType || user.serviceType !== 'hygiene') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé: Vous n\'avez pas les droits nécessaires pour accéder au service d\'hygiène'
      });
    }
    
    next();
  },
  createProxyMiddleware({
    target: process.env.HYGIENE_SERVICE_URL || 'http://localhost:3008',
    changeOrigin: true,
    pathRewrite: { '^/hygiene': '/' },
    // Options supplémentaires pour la gestion des erreurs
    timeout: 60000, // Timeout de 60 secondes
    proxyTimeout: 60000,
    onError: (err, req, res) => {
      console.error('Erreur de proxy pour le service d\'hygiène:', err);
      res.writeHead(500, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        success: false,
        message: `Erreur de proxy: ${err.message}`,
        error: err.code
      }));
    }
  })
);

// Routes pour les tableaux de bord des services (accès restreint par service)
app.use('/dashboard/police', 
  gatewayMiddleware.requireAuth,
  gatewayMiddleware.checkRole(['admin', 'superadmin', 'agent']),
  (req, res, next) => {
    if (req.user.role === 'agent' && req.user.service !== 'Police') {
      return res.status(403).json({
        success: false,
        message: 'Accès interdit. Service non autorisé'
      });
    }
    next();
  },
  createProxyMiddleware({
    target: process.env.ALERT_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/dashboard/police': '/service/police' }
  })
);

app.use('/dashboard/hygiene', 
  gatewayMiddleware.requireAuth,
  gatewayMiddleware.checkRole(['admin', 'superadmin', 'agent']),
  (req, res, next) => {
    if (req.user.role === 'agent' && req.user.service !== 'Hygiène') {
      return res.status(403).json({
        success: false,
        message: 'Accès interdit. Service non autorisé'
      });
    }
    next();
  },
  createProxyMiddleware({
    target: process.env.ALERT_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/dashboard/hygiene': '/service/hygiene' }
  })
);

app.use('/dashboard/douane', 
  gatewayMiddleware.requireAuth,
  gatewayMiddleware.checkRole(['admin', 'superadmin', 'agent']),
  (req, res, next) => {
    if (req.user.role === 'agent' && req.user.service !== 'Douane') {
      return res.status(403).json({
        success: false,
        message: 'Accès interdit. Service non autorisé'
      });
    }
    next();
  },
  createProxyMiddleware({
    target: process.env.ALERT_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/dashboard/douane': '/service/douane' }
  })
);

app.use('/dashboard/urbanisme', 
  gatewayMiddleware.requireAuth,
  gatewayMiddleware.checkRole(['admin', 'superadmin', 'agent']),
  (req, res, next) => {
    if (req.user.role === 'agent' && req.user.service !== 'Urbanisme') {
      return res.status(403).json({
        success: false,
        message: 'Accès interdit. Service non autorisé'
      });
    }
    next();
  },
  createProxyMiddleware({
    target: process.env.ALERT_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/dashboard/urbanisme': '/service/urbanisme' }
  })
);

// Middleware de parsing du JSON - APRÈS toutes les routes proxifiées
// Cela évite les problèmes de body parsing avec les microservices
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Une erreur est survenue' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`API Gateway en cours d'exécution sur le port ${PORT}`);
});
