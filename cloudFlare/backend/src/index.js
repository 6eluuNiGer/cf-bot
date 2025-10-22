require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');

const {
  createZone, getZoneByName, getZoneNS,
  listDns, createDns, updateDns, deleteDns,
  getZoneStatusByName
} = require('./cloudFlareClient');

// ===== Mongo =====
(async () => {
  try {
    console.log(process.env.MONGODB_URI,'process.env.MONGODB_URI');
    
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || undefined });
    console.log('✅ MongoDB connected');
  } catch (e) {
    console.error('❌ MongoDB connection error:', e.message);
    process.exit(1);
  }
})();

// ===== Telegram Bot (polling; для webhook вимкни polling і додай /tg-webhook) =====
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ===== Access control =====
function normalizeId(v) {
  if (v === undefined || v === null) return null;
  return String(v).replace(/^\uFEFF/, '').trim().replace(/\r/g, '');
}
const allowedChat = normalizeId(process.env.ALLOWED_CHAT_ID);

function ensureChatAllowedCtx(chat) {
  // Приватні чати — дозволяємо, але далі перевіряємо whitelist
  if (chat?.type === 'private') return true;
  // Групи/супергрупи — тільки дозволений чат
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
function allow(handler) {
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

// ===== Utils =====
function parseArgs(s) {
  const regex = /(\w+)=(".*?"|'.*?'|\S+)/g;
  const out = {}; let m;
  while ((m = regex.exec(s)) !== null) {
    const key = m[1]; let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

// ===== Diagnostics =====
bot.onText(/^\/whoami(?:@.+)?$/, (msg) => {
  const info = {
    chat_id: msg.chat.id, chat_type: msg.chat.type, title: msg.chat.title,
    from_id: msg.from?.id, from_username: msg.from?.username
  };
  bot.sendMessage(msg.chat.id, '```' + JSON.stringify(info, null, 2) + '```', { parse_mode: 'Markdown' });
});

// ===== Commands =====
bot.onText(/^\/start|\/help(?:@.+)?$/, allow(async (msg) => {
  bot.sendMessage(msg.chat.id,
`Команди:
• /status example.com — статус зони (active/pending) + NS якщо pending
• /register example.com — створити зону і повернути NS
• /dns_list example.com — список записів
• /dns_add domain=ex.com type=A name=@ content=1.2.3.4 ttl=300 proxied=true
• /dns_update domain=ex.com id=<recordId> content=1.2.3.5 ttl=120 proxied=false
• /dns_delete domain=ex.com id=<recordId>`);
}));

bot.onText(/^\/status(?:@.+)?\s+(.+)$/, allow(async (msg, match) => {
  const chatId = msg.chat.id;
  const domain = (match?.[1] || '').trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain))
    return bot.sendMessage(chatId, '❌ Невалідний домен. Приклад: /status example.com');
  try {
    const info = await getZoneStatusByName(domain);
    if (!info) return bot.sendMessage(chatId, `❌ Зона ${domain} не знайдена. Спочатку /register ${domain}`);
    let extra = '';
    if (info.status === 'pending') {
      const ns = await getZoneNS(info.id);
      extra = `\nNS (встанови у реєстратора):\n\`\`\`\n${ns.join('\n')}\n\`\`\``;
    }
    bot.sendMessage(chatId, `ℹ️ Статус *${domain}*: *${info.status}*${extra}`, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Cloudflare: ${e?.response?.data?.errors?.[0]?.message || e.message}`);
  }
}));

bot.onText(/^\/register(?:@.+)?\s+(.+)$/, allow(async (msg, match) => {
  const chatId = msg.chat.id;
  const domain = (match?.[1] || '').trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain))
    return bot.sendMessage(chatId, '❌ Невалідний домен. Приклад: /register example.com');
  try {
    const existing = await getZoneByName(domain);
    const zone = existing || await createZone(domain);
    const ns = await getZoneNS(zone.id);
    bot.sendMessage(chatId,
`✅ Домен *${domain}* додано/знайдено.
NS-сервери:
\`\`\`
${ns.join('\n')}
\`\`\`
Статус: ${zone.status || 'pending'}`, { parse_mode: 'Markdown' });
  } catch (e) {
    const m = e?.response?.data?.errors?.[0]?.message || e.message || 'Unknown error';
    bot.sendMessage(chatId, `❌ Cloudflare: ${m}`);
  }
}));

bot.onText(/^\/dns_list(?:@.+)?\s+(.+)$/, allow(async (msg, match) => {
  const chatId = msg.chat.id;
  const domain = (match?.[1] || '').trim().toLowerCase();
  if (!domain) return bot.sendMessage(chatId, 'Приклад: /dns_list example.com');
  try {
    const zone = await getZoneByName(domain);
    if (!zone) return bot.sendMessage(chatId, `❌ Зона ${domain} не знайдена. Спочатку /register ${domain}`);
    const records = await listDns(zone.id);
    if (!records.length) return bot.sendMessage(chatId, 'Порожньо.');
    const text = records.map(r => `${r.id} — ${r.type} ${r.name} → ${r.content}${r.proxied ? ' (proxied)' : ''}`).join('\n');
    bot.sendMessage(chatId, '```' + text + '```', { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Cloudflare: ${e?.response?.data?.errors?.[0]?.message || e.message}`);
  }
}));

bot.onText(/^\/dns_add(?:@.+)?\s+(.+)$/, allow(async (msg, match) => {
  const chatId = msg.chat.id;
  const args = parseArgs(match?.[1] || '');
  const { domain, type, name, content } = args;
  if (!domain || !type || !name || !content)
    return bot.sendMessage(chatId, 'Приклад:\n/dns_add domain=ex.com type=A name=@ content=1.2.3.4 ttl=300 proxied=true');
  try {
    const zone = await getZoneByName(domain);
    if (!zone) return bot.sendMessage(chatId, `❌ Зона ${domain} не знайдена. Спочатку /register ${domain}`);
    const rec = {
      type,
      name: name === '@' ? domain : name,
      content,
      ...(args.ttl ? { ttl: Number(args.ttl) } : {}),
      ...(args.proxied !== undefined ? { proxied: args.proxied === 'true' } : {}),
      ...(args.priority ? { priority: Number(args.priority) } : {}),
    };
    const created = await createDns(zone.id, rec);
    bot.sendMessage(chatId, `✅ DNS створено: \`${created.id}\`\n${created.type} ${created.name} → ${created.content}`, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Cloudflare: ${e?.response?.data?.errors?.[0]?.message || e.message}`);
  }
}));

bot.onText(/^\/dns_update(?:@.+)?\s+(.+)$/, allow(async (msg, match) => {
  const chatId = msg.chat.id;
  const args = parseArgs(match?.[1] || '');
  const { domain, id } = args;
  if (!domain || !id)
    return bot.sendMessage(chatId, 'Приклад: /dns_update domain=ex.com id=<recordId> content=1.2.3.5 ttl=120 proxied=false');
  try {
    const zone = await getZoneByName(domain);
    if (!zone) return bot.sendMessage(chatId, `❌ Зона ${domain} не знайдена`);
    const patch = {};
    if (args.content) patch.content = args.content;
    if (args.ttl) patch.ttl = Number(args.ttl);
    if (args.proxied !== undefined) patch.proxied = args.proxied === 'true';
    if (!Object.keys(patch).length) return bot.sendMessage(chatId, 'Немає що оновлювати.');
    const updated = await updateDns(zone.id, id, patch);
    bot.sendMessage(chatId, `✅ Оновлено ${updated.id}: ${updated.type} ${updated.name} → ${updated.content}`);
  } catch (e) {
    bot.sendMessage(chatId, `❌ Cloudflare: ${e?.response?.data?.errors?.[0]?.message || e.message}`);
  }
}));

bot.onText(/^\/dns_delete(?:@.+)?\s+(.+)$/, allow(async (msg, match) => {
  const chatId = msg.chat.id;
  const args = parseArgs(match?.[1] || '');
  const { domain, id } = args;
  if (!domain || !id) return bot.sendMessage(chatId, 'Приклад: /dns_delete domain=ex.com id=<recordId>');
  try {
    const zone = await getZoneByName(domain);
    if (!zone) return bot.sendMessage(chatId, `❌ Зона ${domain} не знайдена`);
    await deleteDns(zone.id, id);
    bot.sendMessage(chatId, `🗑️ Видалено запис ${id}`);
  } catch (e) {
    bot.sendMessage(chatId, `❌ Cloudflare: ${e?.response?.data?.errors?.[0]?.message || e.message}`);
  }
}));

// ===== Express: notify + Users API =====
const app = express();
app.set('trust proxy', true);
app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => res.send('Bot API active'));

function checkNotifySecret(req, res, next) {
  const s = process.env.NOTIFY_SECRET;
  if (!s) return next();
  if ((req.headers['x-notify-secret'] || '') !== s)
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

function shorten(str, max = 3500) {
  if (!str) return '';
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max) + `\n...[truncated ${s.length - max} chars]`;
}

app.all('/notify', checkNotifySecret, (req, res) => {
  const ip = req.ip, method = req.method, url = req.originalUrl;
  const ua = req.headers['user-agent'] || '(none)';
  const query = Object.keys(req.query || {}).length ? JSON.stringify(req.query) : '(порожньо)';
  const headersPick = (({ host, 'user-agent': uaH, 'content-type': ct, 'x-forwarded-for': xff, 'x-real-ip': xrip }) =>
    ({ host, 'user-agent': uaH, 'content-type': ct, 'x-forwarded-for': xff, 'x-real-ip': xrip }))(req.headers);
  const body = req.body && Object.keys(req.body).length ? shorten(JSON.stringify(req.body, null, 2)) : '(порожньо)';
  const text =
`📨 HTTP ${method} ${url}
IP: ${ip}
User-Agent: ${ua}
Query: ${query}
Headers: ${JSON.stringify(headersPick)}
Body:
\`\`\`
${body}
\`\`\``;
  bot.sendMessage(process.env.ALLOWED_CHAT_ID, text, { parse_mode: 'Markdown' })
    .catch(err => console.error('TG send error:', err?.response?.body || err));
  res.json({ ok: true });
});

// ---- Admin Users API ----
function requireAdmin(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!process.env.ADMIN_TOKEN) return res.status(500).json({ ok: false, error: 'ADMIN_TOKEN not set' });
  if (token !== process.env.ADMIN_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.get('/api/users', requireAdmin, async (_req, res) => {
  const items = await User.find({}).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, items });
});
app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    let { username, telegramId } = req.body || {};
    username = (username || '').trim().replace(/^@/, '').toLowerCase();
    telegramId = telegramId ? Number(telegramId) : undefined;
    if (!username && !telegramId) return res.status(400).json({ ok: false, error: 'username or telegramId required' });
    const doc = await User.create({ username: username || undefined, telegramId });
    res.json({ ok: true, item: doc });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// (Webhook режим — якщо треба)
// app.post('/tg-webhook', (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on http://0.0.0.0:${PORT}`));