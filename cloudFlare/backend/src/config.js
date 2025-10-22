require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Telegram
  TELEGRAM_TOKEN: required('TELEGRAM_TOKEN'),
  ALLOWED_CHAT_ID: (process.env.ALLOWED_CHAT_ID || '').trim(),

  // Cloudflare (Global API Key, Token)
  CF_EMAIL: process.env.CF_EMAIL,
  CF_GLOBAL_API_KEY: process.env.CF_GLOBAL_API_KEY,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_TOKEN: process.env.CLOUDFLARE_TOKEN,

  // Mongo
  MONGODB_URI: required('MONGODB_URI'),
  MONGODB_DB: process.env.MONGODB_DB,

  // Express
  PORT: Number(process.env.PORT || 3000),
  NOTIFY_SECRET: process.env.NOTIFY_SECRET,

  // Admin
  ADMIN_TOKEN: required('ADMIN_TOKEN'),
};

module.exports = config;
