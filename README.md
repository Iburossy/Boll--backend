# Bollé - Backend

Backend pour l'application Bollé de signalement citoyen au Sénégal.

## Architecture

Le backend est organisé en microservices communiquant via une API Gateway.

## Stack technique
- Node.js + Express
- MongoDB
- Firebase (auth, stockage, notifications)
- GCP (cloud functions, logging, monitoring)

## Installation

```bash
# Installation des dépendances pour tous les services
npm run install-all

# Démarrage de tous les services
npm run start-all
```

## Services
- API Gateway
- Auth Service
- Alert Service
- User Service
- Media Service
- Notification Service
- Analytics Service
