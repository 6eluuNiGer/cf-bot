const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_TOKEN } = require('../config');
const { protect } = require('./access');
const { registerCommands } = require('./commands');
const logger = require('../logger');

function initBot() {
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  registerCommands(bot, (handler) => protect(handler, bot));
  bot.on('polling_error', (err) => logger.error('Polling error:', err?.message || err));
  logger.info('Telegram bot started (polling)');
  return bot;
}

module.exports = { initBot };
