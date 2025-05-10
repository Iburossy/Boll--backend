# 📚 Documentation API – Service d’Alertes (Bollé)

## 🔗 Base URL

```
https://api.bolle.sn/alerts
```

---

## 🔒 Authentification

- Toutes les routes (sauf création anonyme) nécessitent un token JWT dans le header :
  ```
  Authorization: Bearer <token>
  ```

---

## 📤 1. Créer une alerte

**POST** `/alerts`

- **Body (JSON | multipart/form-data pour médias) :**
  ```json
  {
    "serviceName": "Police Nationale",
    "description": "Trouble à l'ordre public",
    "latitude": 14.6928,
    "longitude": -17.4467,
    "anonymous": false,
    "media": [
      // fichiers (photo, audio, vidéo) en multipart
    ]
  }
  ```
- **Réponse :**
  ```json
  {
    "id": "6625f7...",
    "serviceName": "Police Nationale",
    "description": "...",
    "date": "2025-04-22T00:14:31Z",
    "status": "in_progress",
    "statusLabel": "En cours",
    "media": [
      {"type": "photo", "url": "https://..."},
      {"type": "audio", "url": "https://..."},
      {"type": "video", "url": "https://..."}
    ]
  }
  ```
- **Notes :**
  - Si `anonymous: true`, ne pas lier l’alerte à un utilisateur.
  - Les médias sont optionnels.

---

## 📥 2. Récupérer les alertes d’un utilisateur

**GET** `/alerts/user/:userId`

- **Headers :** JWT requis
- **Réponse :**
  ```json
  [
    {
      "id": "6625f7...",
      "serviceName": "Police Nationale",
      "description": "...",
      "date": "2025-04-22T00:14:31Z",
      "status": "resolved",
      "statusLabel": "Résolue",
      "media": [
        {"type": "photo", "url": "https://..."},
        {"type": "audio", "url": "https://..."}
      ]
    },
    ...
  ]
  ```

---

## 📄 3. Détail d’une alerte

**GET** `/alerts/:alertId`

- **Headers :** JWT requis
- **Réponse :**
  ```json
  {
    "id": "6625f7...",
    "serviceName": "Police Nationale",
    "description": "...",
    "date": "2025-04-22T00:14:31Z",
    "status": "in_progress",
    "statusLabel": "En cours",
    "media": [
      {"type": "photo", "url": "https://..."},
      {"type": "video", "url": "https://..."}
    ]
  }
  ```

---

## 🟢 4. Modifier le statut d’une alerte

**PATCH** `/alerts/:alertId/status`

- **Headers :** JWT requis (admin/service concerné)
- **Body :**
  ```json
  {
    "status": "resolved" // ou "rejected" ou "in_progress"
  }
  ```
- **Réponse :**
  ```json
  {
    "id": "6625f7...",
    "status": "resolved",
    "statusLabel": "Résolue"
  }
  ```

---

## 🗑️ 5. Supprimer une alerte (optionnel)

**DELETE** `/alerts/:alertId`

- **Headers :** JWT requis (admin/service concerné)
- **Réponse :**
  ```json
  {
    "success": true
  }
  ```

---

## 🗂️ 6. Schéma d’une alerte (pour MongoDB)

```json
{
  "_id": "ObjectId",
  "serviceName": "string",
  "description": "string",
  "date": "ISODate",
  "status": "string",         // in_progress | resolved | rejected
  "statusLabel": "string",    // En cours | Résolue | Rejetée
  "userId": "string (optionnel si anonyme)",
  "latitude": "float",
  "longitude": "float",
  "media": [
    {
      "type": "photo|audio|video",
      "url": "string"
    }
  ]
}
```

---

## 💡 Bonnes pratiques

- Toujours retourner les URLs absolues pour les médias.
- Respecter la cohérence des statuts et labels (voir frontend).
- Les endpoints doivent retourner des erreurs explicites (401, 403, 404, 422, etc.).
- Pour l’anonymat, ne pas stocker de userId.

---

## 🔗 À relier

- Authentification via `/auth`
- Utilisateurs via `/users/:id`
- Notifications via `/notifications`

---

**Besoin d’une version anglaise, d’un Swagger/OpenAPI, ou d’un exemple d’implémentation Node.js/Express ?**
Dis-le-moi !
