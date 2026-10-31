const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const connectDB = require('./config/db');
const seed = require('./seed');
const fleet = require('./services/fleet');
const { Analytics } = require('./services/analytics');
const { Demand } = require('./services/demand');
const { Presence } = require('./services/presence');
const createApi = require('./routes/api');
const createPlannerApi = require('./routes/planner');
const createDensityApi = require('./routes/density');

async function main() {
  await connectDB(config.mongoUri);
  await seed(); // baza boşdursa demo xətləri yaradır
  await fleet.load();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: config.clientOrigin } });
  const analytics = new Analytics(fleet);
  const demand = new Demand(fleet); // Yanaşma A — proaktiv tələb
  const presence = new Presence(fleet); // Yanaşma B — canlı lokasiya

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', createApi({ fleet, analytics, presence, io }));
  app.use('/api', createPlannerApi({ fleet, analytics, demand }));
  app.use('/api', createDensityApi({ presence }));

  // Production: React build-i eyni serverdən paylanır
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Tapılmadı' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.name === 'CastError' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Server xətası' : err.message, retryAfter: err.retryAfter });
  });

  // ── Real-vaxt yayım ──
  fleet.on('tick', (buses) => io.volatile.emit('buses:update', buses));
  analytics.on('crowd', (c) => io.emit('crowd:update', c));
  analytics.on('alert:new', (a) => io.emit('alert:new', a));
  analytics.on('alert:update', (a) => io.emit('alert:update', a));
  demand.on('alert:new', (a) => io.emit('alert:new', a));
  demand.on('alert:update', (a) => io.emit('alert:update', a));
  demand.on('changed', () => io.emit('demand:changed'));
  presence.on('density', (d) => io.volatile.emit('density:update', d));

  io.on('connection', (socket) => {
    socket.emit('buses:update', fleet.snapshot());
    if (analytics.cache) socket.emit('crowd:update', analytics.cache);
    socket.emit('density:update', presence.last);

    // Canlı lokasiya (yalnız istifadəçi razılıq verdikdə göndərilir; açar = anonim socket id)
    socket.on('presence:update', (p) => presence.update(socket.id, p));
    socket.on('presence:stop', () => presence.remove(socket.id));
    socket.on('disconnect', () => presence.remove(socket.id));
  });

  fleet.start();
  analytics.start();
  demand.start();
  presence.start();

  server.listen(config.port, () => {
    console.log(`[server] http://localhost:${config.port}  (API: /api, simulyator: ${config.sim.enabled ? 'aktiv' : 'söndürülüb'})`);
    console.log(
      `[anomaly] Qayda: son ${config.anomaly.windowMin} dəq-də ≥${config.anomaly.minHighReports} unikal "Yüksək" bildiriş və ≥${Math.round(
        config.anomaly.minHighRatio * 100
      )}% pay`
    );
  });

  const shutdown = async () => {
    fleet.stop();
    analytics.stop();
    demand.stop();
    presence.stop();
    await fleet.persist().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[server] Başlatma xətası:', e.message);
  if (/ECONNREFUSED|querySrv|ServerSelection/i.test(e.message)) {
    console.error('MongoDB işləmir? MONGO_URI-ni .env faylında yoxlayın:', config.mongoUri);
  }
  process.exit(1);
});
