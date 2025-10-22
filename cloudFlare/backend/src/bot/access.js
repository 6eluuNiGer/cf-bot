const User = require('../models/User');
const { ALLOWED_CHAT_ID } = require('../config');

function normalizeId(v) {
  if (v === undefined || v === null) return null;
  return String(v).replace(/^\uFEFF/, '').trim().replace(/\r/g, '');
}
const allowedChat = normalizeId(ALLOWED_CHAT_ID);

function ensureChatAllowedCtx(chat) {
  if (chat?.type === 'private') return true;
  if (!allowedChat) return false;
  return String(chat.id) === allowedChat;
}

async function isUserWhitelisted(msg) {
  if (msg.chat?.type === 'group' || msg.chat?.type === 'supergroup') return true;
  const username = (msg.from?.username || '').toLowerCase();
  const telegramId = msg.from?.id ? Number(msg.from.id) : undefined;
  const found = await User.findOne({
    $or: [
      ...(username ? [{ username }] : []),
      ...(telegramId ? [{ telegramId }] : []),
    ]
  }).lean();
  return !!found;
}

function protect(handler, bot) {
  return async (msg, ...rest) => {
    if (!ensureChatAllowedCtx(msg.chat)) {
      return bot.sendMessage(msg.chat.id, '⛔ Доступ із цього чату заборонено.');
    }
    if (msg.chat.type === 'private') {
      const ok = await isUserWhitelisted(msg);
      if (!ok) {
        return bot.sendMessage(msg.chat.id, '⛔ У вас немає доступу до цього бота. Зверніться до адміністратора.');
      }
    }
    return handler(msg, ...rest);
  };
}

module.exports = { protect };
