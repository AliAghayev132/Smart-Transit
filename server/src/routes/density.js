/**
 * Yanaşma B — canlı lokasiya sıxlığı API-si.
 * Mövqelər Socket.IO "presence:update" hadisəsi ilə gəlir (bax: src/index.js).
 */
const express = require('express');
const config = require('../config');
const DensitySnapshot = require('../models/DensitySnapshot');
const { requireOperator } = require('./util');

module.exports = function createDensityApi({ presence }) {
  const router = express.Router();

  router.get('/density/live', (_req, res) => res.json(presence.last));

  /** Son N dəqiqənin anonim aqreqatları (trend qrafiki/tarixçə üçün) */
  router.get('/density/history', async (req, res) => {
    const minutes = Math.min(Number(req.query.minutes) || 60, 24 * 60);
    const list = await DensitySnapshot.find({ at: { $gte: new Date(Date.now() - minutes * 60000) } })
      .sort({ at: 1 })
      .lean();
    res.json(list.map((s) => ({ at: s.at, total: s.total, stops: s.stops, buses: s.buses })));
  });

  if (config.demoEnabled) {
    router.post('/demo/presence', requireOperator, (req, res) => {
      const count = Math.min(Number((req.body || {}).count) || 40, 300);
      presence.addSynthetic(count, 3);
      res.json({ ok: true, inserted: count, density: presence.compute() });
    });
  }

  return router;
};
