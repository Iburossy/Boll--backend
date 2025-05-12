const mongoose = require('mongoose');

/**
 * Modèle pour les statistiques des services
 * Stocke les données statistiques pour chaque service
 */
const ServiceStatsSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  alertsCount: {
    total: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    },
    inProgress: {
      type: Number,
      default: 0
    },
    resolved: {
      type: Number,
      default: 0
    },
    rejected: {
      type: Number,
      default: 0
    }
  },
  lastActivity: {
    timestamp: {
      type: Date,
      default: null
    },
    type: {
      type: String,
      enum: ['alert_created', 'alert_updated', 'service_ping', 'service_config_updated'],
      default: null
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  dailyStats: [{
    date: {
      type: Date,
      required: true
    },
    alertsReceived: {
      type: Number,
      default: 0
    },
    alertsResolved: {
      type: Number,
      default: 0
    }
  }],
  monthlyStats: [{
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true
    },
    alertsReceived: {
      type: Number,
      default: 0
    },
    alertsResolved: {
      type: Number,
      default: 0
    },
    responseTimeAvg: {
      type: Number,
      default: 0
    }
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Middleware pour mettre à jour le champ updatedAt avant la sauvegarde
ServiceStatsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode pour mettre à jour les statistiques d'alertes
ServiceStatsSchema.methods.updateAlertStats = async function(alertsData) {
  this.alertsCount = {
    total: alertsData.total || 0,
    pending: alertsData.pending || 0,
    inProgress: alertsData.inProgress || 0,
    resolved: alertsData.resolved || 0,
    rejected: alertsData.rejected || 0
  };
  
  // Mise à jour de la dernière activité
  this.lastActivity = {
    timestamp: new Date(),
    type: 'alert_updated',
    details: {
      message: 'Statistiques d\'alertes mises à jour'
    }
  };
  
  return await this.save();
};

// Méthode pour ajouter une statistique journalière
ServiceStatsSchema.methods.addDailyStat = async function(date, alertsReceived, alertsResolved) {
  // Formater la date pour n'avoir que la partie date (sans l'heure)
  const formattedDate = new Date(date);
  formattedDate.setHours(0, 0, 0, 0);
  
  // Vérifier si une entrée existe déjà pour cette date
  const existingStatIndex = this.dailyStats.findIndex(
    stat => new Date(stat.date).toDateString() === formattedDate.toDateString()
  );
  
  if (existingStatIndex >= 0) {
    // Mettre à jour l'entrée existante
    this.dailyStats[existingStatIndex].alertsReceived += alertsReceived;
    this.dailyStats[existingStatIndex].alertsResolved += alertsResolved;
  } else {
    // Ajouter une nouvelle entrée
    this.dailyStats.push({
      date: formattedDate,
      alertsReceived,
      alertsResolved
    });
  }
  
  // Limiter le nombre d'entrées journalières (garder les 30 derniers jours)
  if (this.dailyStats.length > 30) {
    this.dailyStats.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.dailyStats = this.dailyStats.slice(0, 30);
  }
  
  return await this.save();
};

// Méthode pour ajouter une statistique mensuelle
ServiceStatsSchema.methods.addMonthlyStat = async function(year, month, alertsReceived, alertsResolved, responseTimeAvg) {
  // Vérifier si une entrée existe déjà pour ce mois
  const existingStatIndex = this.monthlyStats.findIndex(
    stat => stat.year === year && stat.month === month
  );
  
  if (existingStatIndex >= 0) {
    // Mettre à jour l'entrée existante
    this.monthlyStats[existingStatIndex].alertsReceived += alertsReceived;
    this.monthlyStats[existingStatIndex].alertsResolved += alertsResolved;
    
    // Calculer la moyenne pondérée du temps de réponse
    const oldCount = this.monthlyStats[existingStatIndex].alertsResolved - alertsResolved;
    const oldAvg = this.monthlyStats[existingStatIndex].responseTimeAvg;
    const newCount = alertsResolved;
    const newAvg = responseTimeAvg;
    
    if (oldCount + newCount > 0) {
      this.monthlyStats[existingStatIndex].responseTimeAvg = 
        (oldCount * oldAvg + newCount * newAvg) / (oldCount + newCount);
    }
  } else {
    // Ajouter une nouvelle entrée
    this.monthlyStats.push({
      year,
      month,
      alertsReceived,
      alertsResolved,
      responseTimeAvg
    });
  }
  
  // Limiter le nombre d'entrées mensuelles (garder les 12 derniers mois)
  if (this.monthlyStats.length > 12) {
    this.monthlyStats.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
    this.monthlyStats = this.monthlyStats.slice(0, 12);
  }
  
  return await this.save();
};

// Méthode pour enregistrer une activité
ServiceStatsSchema.methods.recordActivity = async function(type, details = {}) {
  this.lastActivity = {
    timestamp: new Date(),
    type,
    details
  };
  
  return await this.save();
};

module.exports = mongoose.model('ServiceStats', ServiceStatsSchema);
