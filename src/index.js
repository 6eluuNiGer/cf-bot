require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const {
  createZone, getZoneByName, getZoneNS,
  listDns, createDns, updateDns, deleteDns,
  getZoneStatusByName
} = require('./cloudFlareClient');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ---- Access control helpers ----
function normalizeId(v) {
  if (v === undefined || v === null) return null;
  return String(v).replace(/^\uFEFF/, '').trim().replace(/\r/g, '');
}
const allowed = normalizeId(process.env.ALLOWED_CHAT_ID);

function ensureChatAllowed(chatId) {
  // Без ALLOWED_CHAT_ID – нікого не пускаємо
  if (!allowed) return false;
  return String(chatId) === allowed;
}

// ---- Utils ----
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

// ---- Diagnostics ----
bot.onText(/^\/whoami(?:@.+)?$/, (msg) => {
  const info = {
    chat_id: msg.chat.id,
    chat_type: msg.chat.type,
    title: msg.chat.title,
    username: msg.chat.username,
    from_id: msg.from?.id,
    from_username: msg.from?.username
  };
  bot.sendMessage(msg.chat.id, 'Debug:\n```' + JSON.stringify(info, null, 2) + '```', { parse_mode: 'Markdown' });
  console.log('WHOAMI:', info);
});

bot.on('message', (msg) => {
  console.log('[MSG]', { chatId: msg.chat.id, type: msg.chat.type, text: msg.text });
});

// ---- Commands ----
bot.onText(/^\/start|\/help(?:@.+)?$/, (msg) => {
  if (!ensureChatAllowed(msg.chat.id)) return bot.sendMessage(msg.chat.id, '⛔ Доступ із цього чату заборонено.');
  bot.sendMessage(msg.chat.id,
`Команди:
• /register example.com — створити зону в CF і повернути NS
• /dns_list example.com — список записів
• /dns_add domain=ex.com type=A name=@ content=1.2.3.4 ttl=300 proxied=true
• /dns_update domain=ex.com id=<recordId> content=1.2.3.5 ttl=120 proxied=false
• /dns_delete domain=ex.com id=<recordId>
• /status example.com — статус зони (active/pending) + NS якщо pending`);
});

// /register <domain>
bot.onText(/^\/register(?:@.+)?\s+(.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!ensureChatAllowed(chatId)) return bot.sendMessage(chatId, '⛔ Доступ із цього чату заборонено.');
  const domain = (match?.[1] || '').trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) return bot.sendMessage(chatId, '❌ Невалідний домен. Приклад: /register example.com');

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
Статус: ${zone.status || 'pending'}`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    const m = e?.response?.data?.errors?.[0]?.message || e.message || 'Unknown error';
    bot.sendMessage(chatId, `❌ Cloudflare: ${m}`);
  }
});

// /dns_list <domain>
bot.onText(/^\/dns_list(?:@.+)?\s+(.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!ensureChatAllowed(chatId)) return bot.sendMessage(chatId, '⛔ Доступ із цього чату заборонено.');
  const domain = (match?.[1] || '').trim().toLowerCase();
  if (!domain) return bot.sendMessage(chatId, 'Приклад: /dns_list example.com');

  try {
    const zone = await getZoneByName(domain);
    if (!zone) return bot.sendMessage(chatId, `❌ Зона ${domain} не знайдена. Спочатку /register ${domain}`);
    const records = await listDns(zone.id);
    if (!records.length) return bot.sendMessage(chatId, 'Порожньо.');
    const text = records.map(r => `${r.id} — ${r.type} ${r.name} → ${r.content}${r.proxied ? ' (proxied)' : ''}`).join('\n');
    bot.sendMessage(chatId, '```' + '\n' + text + '\n' + '```', { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Cloudflare: ${e?.response?.data?.errors?.[0]?.message || e.message}`);
  }
});

// /dns_add key=value...
bot.onText(/^\/dns_add(?:@.+)?\s+(.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!ensureChatAllowed(chatId)) return bot.sendMessage(chatId, '⛔ Доступ із цього чату заборонено.');
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
});

// /dns_update key=value...
bot.onText(/^\/dns_update(?:@.+)?\s+(.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!ensureChatAllowed(chatId)) return bot.sendMessage(chatId, '⛔ Доступ із цього чату заборонено.');
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
});

// /dns_delete key=value...
bot.onText(/^\/dns_delete(?:@.+)?\s+(.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!ensureChatAllowed(chatId)) return bot.sendMessage(chatId, '⛔ Доступ із цього чату заборонено.');
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
});

bot.onText(/^\/status(?:@.+)?\s+(.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!ensureChatAllowed(chatId)) return bot.sendMessage(chatId, '⛔ Доступ із цього чату заборонено.');
  const domain = (match?.[1] || '').trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) {
    return bot.sendMessage(chatId, '❌ Невалідний домен. Приклад: /status example.com');
  }
  try {
    const info = await getZoneStatusByName(domain); // якщо не додав хелпер — заміни на getZoneByName(domain)
    if (!info) return bot.sendMessage(chatId, `❌ Зона ${domain} не знайдена. Спочатку /register ${domain}`);

    const status = info.status;
    let extra = '';
    if (status === 'pending') {
      const ns = await getZoneNS(info.id);
      extra = `\nNS (встанови у реєстратора):\n\`\`\`\n${ns.join('\n')}\n\`\`\``;
    }
    bot.sendMessage(chatId, `ℹ️ Статус *${domain}*: *${status}*${extra}`, { parse_mode: 'Markdown' });
  } catch (e) {
    const m = e?.response?.data?.errors?.[0]?.message || e.message || 'Unknown error';
    bot.sendMessage(chatId, `❌ Cloudflare: ${m}`);
  }
});

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// middleware: перевірка секрету (якщо задано)
function checkSecret(req, res, next) {
  const s = process.env.NOTIFY_SECRET;
  if (!s) return next(); // якщо секрет не задано — пропускаємо всі (для локальних тестів)
  if ((req.headers['x-notify-secret'] || '') !== s) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// утиліта обрізання довгих тіл, щоб TG не різав повідомлення
function shorten(str, max = 3500) {
  if (!str) return '';
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max) + `\n...[truncated ${s.length - max} chars]`;
}

app.get('/', (_req, res) => res.send('Bot API active'));

app.all('/notify', checkSecret, (req, res) => {
  const ip = req.ip;
  const method = req.method;
  const url = req.originalUrl;
  const ua = req.headers['user-agent'] || '(none)';
  const query = Object.keys(req.query || {}).length ? JSON.stringify(req.query) : '(порожньо)';
  const headersPick = (({ host, 'user-agent': uaH, 'content-type': ct, 'x-forwarded-for': xff, 'x-real-ip': xrip }) =>
    ({ host, 'user-agent': uaH, 'content-type': ct, 'x-forwarded-for': xff, 'x-real-ip': xrip }))(req.headers);
  const bodyPretty = req.body && Object.keys(req.body).length
    ? shorten(JSON.stringify(req.body, null, 2))
    : '(порожньо)';

  const text =
`📨 HTTP ${method} ${url}
IP: ${ip}
User-Agent: ${ua}
Query: ${query}
Headers: ${JSON.stringify(headersPick)}
Body:
\`\`\`
${bodyPretty}
\`\`\``;

  bot.sendMessage(process.env.ALLOWED_CHAT_ID, text, { parse_mode: 'Markdown' })
    .catch(err => console.error('TG send error:', err?.response?.body || err));

  res.json({ ok: true });
});

app.listen(process.env.PORT, () => console.log(`🚀 Server on http://localhost:${process.env.PORT}`));
