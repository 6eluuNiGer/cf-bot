const mongoose = require('mongoose');
const logger = require('./logger');
const { MONGODB_URI, MONGODB_DB } = require('./config');

async function connectMongo() {
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB || undefined });
  logger.info('MongoDB connected');
}

function setupShutdown() {
  const shutdown = async (sig) => {
    try {
      logger.info(`Received ${sig}, closing Mongo connection...`);
      await mongoose.connection.close();
      process.exit(0);
    } catch (e) {
      logger.error('Error during shutdown:', e);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { connectMongo, setupShutdown };
