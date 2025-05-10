const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bolle-hygiene', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info(`MongoDB connecté: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Erreur de connexion à MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
