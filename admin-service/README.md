# Service d'Administration Bollé

Service backend pour la gestion des services partenaires de la plateforme Bollé.

## Fonctionnalités

- Gestion des services partenaires (création, modification, activation/désactivation)
- Vérification de la disponibilité des services
- Statistiques globales et par service
- Authentification des administrateurs
- Gestion des profils administrateurs

## Prérequis

- Node.js (v14+)
- MongoDB
- npm ou yarn

## Installation

1. Cloner le dépôt
2. Installer les dépendances :
```bash
cd admin-service
npm install
```

3. Configurer les variables d'environnement :
   - Copier le fichier `.env.example` en `.env` (si nécessaire)
   - Modifier les variables selon votre environnement

4. Initialiser l'administrateur par défaut :
```bash
npm run init-admin
```

## Démarrage

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm start
```

## Test avec l'API Gateway

Pour tester le service via l'API Gateway :
```bash
cd ..
npm run dev-admin
```

## Structure du projet

```
admin-service/
├── config/           # Configuration
├── controllers/      # Contrôleurs
├── middlewares/      # Middlewares
├── models/           # Modèles de données
├── routes/           # Routes API
├── scripts/          # Scripts utilitaires
├── utils/            # Utilitaires
├── server.js         # Point d'entrée
└── package.json
```

## API Endpoints

### Authentification

- `POST /auth/login` - Connexion administrateur
- `POST /auth/refresh-token` - Rafraîchir le token
- `GET /auth/me` - Obtenir le profil administrateur
- `PUT /auth/me` - Mettre à jour le profil
- `PUT /auth/change-password` - Changer le mot de passe
- `POST /auth/logout` - Déconnexion
- `POST /auth/register` - Inscription (réservé aux superadmins)

### Services

- `GET /services` - Lister tous les services
- `POST /services` - Créer un nouveau service
- `GET /services/:id` - Obtenir un service par ID
- `PUT /services/:id` - Mettre à jour un service
- `DELETE /services/:id` - Supprimer un service (soft delete)
- `POST /services/:id/check-availability` - Vérifier la disponibilité
- `PATCH /services/:id/toggle-active` - Activer/désactiver un service
- `GET /services/public` - Obtenir les services publics (pour les citoyens)

### Statistiques

- `GET /stats/global` - Obtenir les statistiques globales
- `GET /stats/services` - Obtenir les statistiques de tous les services
- `GET /stats/services/:id` - Obtenir les statistiques d'un service
- `PUT /stats/services/:id` - Mettre à jour les statistiques d'un service
- `POST /stats/services/:id/daily` - Ajouter une statistique journalière
- `POST /stats/services/:id/monthly` - Ajouter une statistique mensuelle
- `GET /stats/period/:period` - Obtenir les statistiques par période

## Informations d'identification par défaut

- **Username** : superadmin
- **Email** : admin@bolle.sn
- **Mot de passe** : Passer@1

## Documentation complète

Pour une documentation détaillée de l'API, consultez le fichier [doc.md](./doc.md).
