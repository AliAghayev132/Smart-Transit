require('dotenv').config({ quiet: true });

const num = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));

module.exports = {
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_transit',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  // Boşdursa operator əməliyyatları açıqdır; doldurulubsa "x-operator-key" başlığı tələb olunur
  operatorKey: process.env.OPERATOR_KEY || '',

  sim: {
    // false olduqda avtobuslar yalnız real GPS (POST /api/buses/:id/location) ilə hərəkət edir
    enabled: process.env.SIM_ENABLED !== 'false',
    tickMs: num(process.env.SIM_TICK_MS, 2000),
    // Pik saatlarda orta sürət (km/saat)
    avgSpeedKmh: num(process.env.SIM_AVG_SPEED_KMH, 22),
    dwellSec: num(process.env.SIM_DWELL_SEC, 25), // hər dayanacaqda dayanma
  },

  crowd: {
    // Sıxlıq hesablanarkən nəzərə alınan bildiriş pəncərəsi
    lookbackMin: num(process.env.CROWD_LOOKBACK_MIN, 15),
    halfLifeMin: num(process.env.CROWD_HALF_LIFE_MIN, 5),
    // GPS koordinatı avtobusa/xəttə bu məsafədən yaxındırsa bildiriş "təsdiqlənmiş" sayılır
    verifyRadiusM: num(process.env.VERIFY_RADIUS_M, 300),
    // Eyni cihazdan eyni avtobus üçün təkrar bildiriş limiti
    cooldownSec: num(process.env.REPORT_COOLDOWN_SEC, 60),
  },

  demoEnabled: process.env.DEMO_ENABLED !== 'false',

  anomaly: {
    windowMin: num(process.env.ANOMALY_WINDOW_MIN, 10),
    minHighReports: num(process.env.ANOMALY_MIN_HIGH, 3),
    minHighRatio: num(process.env.ANOMALY_MIN_RATIO, 0.6),
    checkEverySec: num(process.env.ANOMALY_CHECK_SEC, 20),
  },

  // Marşrut planlayıcı (Haradan → Haraya)
  planner: {
    maxWalkM: num(process.env.PLANNER_MAX_WALK_M, 1200), // başlanğıc/təyinatdan dayanacağa maks. piyada
    transferWalkM: num(process.env.PLANNER_TRANSFER_WALK_M, 350), // köçürmədə dayanacaqlar arası maks. piyada
    walkSpeedMs: num(process.env.PLANNER_WALK_SPEED_MS, 1.25), // ~4.5 km/saat
    walkDetour: 1.25, // düz xətt məsafəsi × küçə əyriliyi
    // "Ən rahat" sıralamasında sıxlıq cəriməsi (dəqiqə)
    crowdPenaltyMin: { low: 0, mid: 3, high: 9, unknown: 1 },
  },

  // İsteğe bağlı: Google Routes API (server açarı) — transit alternativləri üçün
  googleRoutesKey: process.env.GOOGLE_ROUTES_API_KEY || '',

  // Yanaşma A — proaktiv tələb (səyahət niyyətləri)
  demand: {
    intentTtlMin: num(process.env.DEMAND_INTENT_TTL_MIN, 45),
    defaultRadiusM: num(process.env.DEMAND_RADIUS_M, 500),
    horizonMin: num(process.env.DEMAND_HORIZON_MIN, 30),
    // Bir xətt üzrə növbəti horizonMin dəqiqədə təsdiqlənmiş niyyət sayı bu həddi keçərsə → proaktiv xəbərdarlıq
    alertMinConfirmed: num(process.env.DEMAND_ALERT_MIN, 15),
  },

  // Yanaşma B — canlı lokasiya (anonim, yalnız yaddaşda)
  presence: {
    ttlSec: num(process.env.PRESENCE_TTL_SEC, 90),
    cellDeg: num(process.env.PRESENCE_CELL_DEG, 0.0015), // ~165 m şəbəkə xanası
    minCellCount: num(process.env.PRESENCE_MIN_CELL, 1), // k-anonimlik: bundan az olan xanalar göstərilmir
    stopRadiusM: num(process.env.PRESENCE_STOP_RADIUS_M, 70),
    busRadiusM: num(process.env.PRESENCE_BUS_RADIUS_M, 60),
    broadcastSec: num(process.env.PRESENCE_BROADCAST_SEC, 5),
    snapshotSec: num(process.env.PRESENCE_SNAPSHOT_SEC, 60),
  },
};
