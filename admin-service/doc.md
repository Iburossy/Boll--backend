Résumé du service d'administration et guide de test avec Insomnia
Ce qui a été fait
Nous avons implémenté un service d'administration complet pour la gestion des services partenaires de Bollé :

Structure du projet :
Création du dossier admin-service avec l'architecture MVC
Configuration de base (package.json, .env, server.js)
Modèles de données :
Admin : pour gérer les administrateurs de la plateforme
Service : pour gérer les services partenaires
ServiceStats : pour gérer les statistiques des services
Contrôleurs :
auth.controller.js : gestion de l'authentification des administrateurs
service.controller.js : gestion des services partenaires
stats.controller.js : gestion des statistiques
Routes :
/auth : authentification et gestion des administrateurs
/services : gestion des services partenaires
/stats : gestion des statistiques
Intégration avec l'API Gateway :
Ajout de la route /admin dans l'API Gateway
Configuration des middlewares d'authentification
Ce qu'il reste à faire
Initialisation de la base de données avec un administrateur par défaut
Tests complets de toutes les fonctionnalités
Documentation détaillée de l'API
Interface frontend pour l'administration
Guide de test avec Insomnia
Voici comment tester les principales fonctionnalités du service d'administration avec Insomnia :

1. Configuration initiale
Créez une nouvelle collection dans Insomnia nommée "Admin Service"
Créez un environnement avec les variables suivantes :
baseUrl : http://localhost:3000/admin
token : (à remplir après l'authentification)
2. Création du premier administrateur (superadmin)
Comme il s'agit du premier démarrage, nous devons créer manuellement un administrateur dans la base de données :

javascript
CopyInsert
// Exécuter ce script dans MongoDB
db.admins.insertOne({
  username: "superadmin",
  email: "admin@bolle.sn",
  password: "$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // Mot de passe haché
  firstName: "Super",
  lastName: "Admin",
  role: "superadmin",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});
Ou alternativement, créez un script d'initialisation dans le dossier admin-service pour créer automatiquement un administrateur par défaut.

3. Tests d'authentification
Connexion administrateur
Méthode : POST
URL : {{baseUrl}}/auth/login
Corps (JSON) :
json
CopyInsert
{
  "email": "admin@bolle.sn",
  "password": "password123"
}
Réponse attendue : Token JWT et informations de l'administrateur
Action : Copiez le token reçu dans la variable d'environnement token
Obtenir le profil administrateur
Méthode : GET
URL : {{baseUrl}}/auth/me
Headers : Authorization: Bearer {{token}}
Réponse attendue : Informations du profil administrateur
4. Tests de gestion des services
Créer un nouveau service
Méthode : POST
URL : {{baseUrl}}/services
Headers : Authorization: Bearer {{token}}
Corps (JSON) :
json
CopyInsert
{
  "name": "Service d'Hygiène",
  "description": "Service responsable de la gestion des alertes liées à l'hygiène publique",
  "apiUrl": "http://localhost:3008",
  "category": "public",
  "contactEmail": "hygiene@bolle.sn",
  "contactPhone": "221700000000",
  "authType": "jwt"
}
Réponse attendue : Informations du service créé avec un ID
Lister tous les services
Méthode : GET
URL : {{baseUrl}}/services
Headers : Authorization: Bearer {{token}}
Réponse attendue : Liste des services avec pagination
Vérifier la disponibilité d'un service
Méthode : POST
URL : {{baseUrl}}/services/:id/check-availability (remplacez :id par l'ID du service)
Headers : Authorization: Bearer {{token}}
Réponse attendue : État de disponibilité du service
Activer/désactiver un service
Méthode : PATCH
URL : {{baseUrl}}/services/:id/toggle-active (remplacez :id par l'ID du service)
Headers : Authorization: Bearer {{token}}
Réponse attendue : Confirmation du changement d'état
5. Tests des statistiques
Obtenir les statistiques globales
Méthode : GET
URL : {{baseUrl}}/stats/global
Headers : Authorization: Bearer {{token}}
Réponse attendue : Statistiques globales de tous les services
Mettre à jour les statistiques d'un service
Méthode : PUT
URL : {{baseUrl}}/stats/services/:id (remplacez :id par l'ID du service)
Headers : Authorization: Bearer {{token}}
Corps (JSON) :
json
CopyInsert
{
  "alertsCount": {
    "total": 25,
    "pending": 5,
    "inProgress": 10,
    "resolved": 8,
    "rejected": 2
  }
}
Réponse attendue : Statistiques mises à jour
Ajouter une statistique journalière
Méthode : POST
URL : {{baseUrl}}/stats/services/:id/daily (remplacez :id par l'ID du service)
Headers : Authorization: Bearer {{token}}
Corps (JSON) :
json
CopyInsert
{
  "date": "2025-05-12T00:00:00.000Z",
  "alertsReceived": 5,
  "alertsResolved": 3
}
Réponse attendue : Confirmation de l'ajout de la statistique
Conseils pour les tests
Testez d'abord l'authentification pour obtenir un token valide
Utilisez des variables d'environnement dans Insomnia pour stocker les IDs et tokens
Vérifiez les codes de statut HTTP pour vous assurer que les requêtes sont traitées correctement
Testez les cas d'erreur (par exemple, tentative d'accès sans token, création de service avec un nom existant)
Vérifiez les contraintes de validation sur les champs obligatoires
Pour démarrer le service d'administration et l'API Gateway pour les tests, exécutez :