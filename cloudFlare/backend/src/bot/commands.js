const { parseArgs, validDomain } = require('./utils');
const {
  createZone, getZoneByName, getZoneNS,
  listDns, createDns, updateDns, deleteDns,
  getZoneStatusByName
} = require('../cf/cloudFlareClient');

function registerCommands(bot, protect) {
  // diagnostics
  bot.onText(/^\/whoami(?:@.+)?$/, (msg) => {
    const info = {
      chat_id: msg.chat.id, chat_type: msg.chat.type, title: msg.chat.title,
      from_id: msg.from?.id, from_username: msg.from?.username
    };
    bot.sendMessage(msg.chat.id, '```' + JSON.stringify(info, null, 2) + '```', { parse_mode: 'Markdown' });
  });

  bot.onText(/^\/myid(?:@.+)?$/, (msg) => {
    const id = msg.from?.id;
    const uname = msg.from?.username ? '@' + msg.from.username : '(no username)';
    bot.sendMessage(msg.chat.id, `Ваш Telegram ID: \`${id}\`\nUsername: ${uname}`, { parse_mode: 'Markdown' });
  });

  // help
  bot.onText(/^\/start|\/help(?:@.+)?$/, protect(async (msg) => {
    bot.sendMessage(msg.chat.id,
`Команди:
• /status example.com — статус зони (active/pending) + NS якщо pending
• /register example.com — створити зону і повернути NS
• /dns_list example.com — список записів
• /dns_add domain=ex.com type=A name=@ content=1.2.3.4 ttl=300 proxied=true
• /dns_update domain=ex.com id=<recordId> content=1.2.3.5 ttl=120 proxied=false
• /dns_delete domain=ex.com id=<recordId>`);
  }));

  // status
  bot.onText(/^\/status(?:@.+)?\s+(.+)$/, protect(async (msg, match) => {
    const chatId = msg.chat.id;
    const domain = (match?.[1] || '').trim().toLowerCase();
    if (!validDomain(domain)) return bot.sendMessage(chatId, '❌ Невалідний домен. Приклад: /status example.com');
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

  // register
  bot.onText(/^\/register(?:@.+)?\s+(.+)$/, protect(async (msg, match) => {
    const chatId = msg.chat.id;
    const domain = (match?.[1] || '').trim().toLowerCase();
    if (!validDomain(domain)) return bot.sendMessage(chatId, '❌ Невалідний домен. Приклад: /register example.com');
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

  // dns list
  bot.onText(/^\/dns_list(?:@.+)?\s+(.+)$/, protect(async (msg, match) => {
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

  // dns add
  bot.onText(/^\/dns_add(?:@.+)?\s+(.+)$/, protect(async (msg, match) => {
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

  // dns update
  bot.onText(/^\/dns_update(?:@.+)?\s+(.+)$/, protect(async (msg, match) => {
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

  // dns delete
  bot.onText(/^\/dns_delete(?:@.+)?\s+(.+)$/, protect(async (msg, match) => {
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
}

module.exports = { registerCommands };
