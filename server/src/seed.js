/**
 * Verilənlər bazasını demo xətlər və avtobuslarla doldurur.
 *   npm run seed           — boşdursa doldurur
 *   npm run seed -- --reset — hər şeyi silib yenidən doldurur
 */
const mongoose = require('mongoose');
const config = require('./config');
const connectDB = require('./config/db');
const Route = require('./models/Route');
const Bus = require('./models/Bus');
const Report = require('./models/Report');
const Alert = require('./models/Alert');
const { buildGeometry, pointAt } = require('./services/geo');
const seedData = require('./seedData');

async function seed({ reset = false } = {}) {
  if (reset) {
    await Promise.all([Route.deleteMany({}), Bus.deleteMany({}), Report.deleteMany({}), Alert.deleteMany({})]);
    console.log('[seed] Köhnə məlumatlar silindi');
  } else if ((await Route.countDocuments()) > 0) {
    console.log('[seed] Baza artıq doludur — keçildi');
    return false;
  }

  for (const r of seedData) {
    const route = await Route.create({ number: r.number, name: r.name, color: r.color, stops: r.stops });
    const geom = buildGeometry(route);
    const buses = Array.from({ length: r.buses }, (_, i) => {
      // Avtobusları xətt boyunca bərabər paylayırıq, yarısı əks istiqamətdə
      const distance = (geom.length * (i + 0.5)) / r.buses;
      const [lat, lng] = pointAt(geom, distance);
      return {
        route: route._id,
        plate: `10-${r.number.padStart(2, '0')}-${String.fromCharCode(65 + i)}${100 + i * 37}`,
        distance,
        direction: i % 2 === 0 ? 1 : -1,
        lat,
        lng,
      };
    });
    await Bus.insertMany(buses);
    console.log(`[seed] Xətt ${r.number} (${r.name}): ${r.stops.length} dayanacaq, ${r.buses} avtobus`);
  }
  return true;
}

module.exports = seed;

if (require.main === module) {
  connectDB(config.mongoUri)
    .then(() => seed({ reset: process.argv.includes('--reset') }))
    .then(() => mongoose.disconnect())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
