const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const health = require('./routes/health');
const { notifyRouter } = require('./routes/notify');
const { adminRouter } = require('./routes/admin');
const { ALLOWED_CHAT_ID, NOTIFY_SECRET, ADMIN_TOKEN } = require('./config');

function buildServer(bot) {
  const app = express();
  app.set('trust proxy', true);

  app.use(helmet());
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('tiny'));

  app.use('/', health);
  app.use('/', notifyRouter(bot, ALLOWED_CHAT_ID, NOTIFY_SECRET));
  app.use('/api', adminRouter(ADMIN_TOKEN));

  // (optional I can add webhook for telegram)
  // app.post('/tg-webhook', (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });

  return app;
}

module.exports = { buildServer };
