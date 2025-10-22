const express = require('express');
const User = require('../models/User');

function requireAdmin(ADMIN_TOKEN) {
  return (req, res, next) => {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!ADMIN_TOKEN) return res.status(503).json({ ok: false, error: 'ADMIN_TOKEN not configured' });
    if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });
    next();
  };
}

function adminRouter(ADMIN_TOKEN) {
  const router = express.Router();
  const guard = requireAdmin(ADMIN_TOKEN);

  router.get('/users', guard, async (_req, res) => {
    const items = await User.find({}).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, items });
  });

  router.post('/users', guard, async (req, res) => {
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

  // optional PATCH (update username/ID)
  router.patch('/users/:id', guard, async (req, res) => {
    try {
      const update = {};
      if (req.body.username !== undefined) {
        update.username = String(req.body.username).trim().replace(/^@/, '').toLowerCase() || undefined;
      }
      if (req.body.telegramId !== undefined) {
        update.telegramId = req.body.telegramId ? Number(req.body.telegramId) : undefined;
      }
      const doc = await User.findByIdAndUpdate(req.params.id, update, { new: true });
      res.json({ ok: true, item: doc });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.delete('/users/:id', guard, async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { adminRouter };
