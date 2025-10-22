const { connectMongo, setupShutdown } = require('./db');
const { initBot } = require('./bot');
const { buildServer } = require('./server');
const { PORT } = require('./config');
const logger = require('./logger');

(async function bootstrap() {
  try {
    await connectMongo();
    setupShutdown();

    const bot = initBot();
    const app = buildServer(bot);

    app.listen(PORT, '0.0.0.0', () => logger.info(`Server on http://0.0.0.0:${PORT}`));
  } catch (e) {
    logger.error('Fatal error on startup:', e);
    process.exit(1);
  }
})();
