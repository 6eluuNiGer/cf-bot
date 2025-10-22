const express = require('express');
const router = express.Router();

function shorten(str, max = 3500) {
  if (!str) return '';
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max) + `\n...[truncated ${s.length - max} chars]`;
}

function checkNotifySecret(secret) {
  return (req, res, next) => {
    if (!secret) return next();
    if ((req.headers['x-notify-secret'] || '') !== secret)
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    next();
  };
}

function notifyRouter(bot, allowedChatId, secret) {
  router.all('/notify', checkNotifySecret(secret), (req, res) => {
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
    bot.sendMessage(allowedChatId, text, { parse_mode: 'Markdown' })
      .catch(() => {});
    res.json({ ok: true });
  });

  return router;
}

module.exports = { notifyRouter };
