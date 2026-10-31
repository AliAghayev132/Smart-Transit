const { Schema, model } = require('mongoose');

/**
 * Yanaşma B (canlı lokasiya) — dəqiqəlik ANONİM aqreqat.
 * Cihaz identifikatorları və fərdi koordinatlar saxlanılmır, yalnız xana sayları.
 */
const DensitySnapshotSchema = new Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    total: Number,
    cellDeg: Number,
    cells: [{ _id: false, lat: Number, lng: Number, count: Number }],
    stops: [{ _id: false, stopId: String, name: String, waiting: Number }],
    buses: [{ _id: false, busId: String, routeNumber: String, riders: Number }],
  },
  { versionKey: false }
);

DensitySnapshotSchema.index({ at: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

module.exports = model('DensitySnapshot', DensitySnapshotSchema);
