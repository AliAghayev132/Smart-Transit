const { Schema, model, Types } = require('mongoose');

const PointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

const ReportSchema = new Schema(
  {
    route: { type: Types.ObjectId, ref: 'Route', required: true, index: true },
    bus: { type: Types.ObjectId, ref: 'Bus' },
    stopId: { type: Types.ObjectId },
    level: { type: String, enum: ['low', 'mid', 'high'], required: true },
    // GeoJSON nöqtə — yalnız koordinat olduqda yazılır
    location: { type: PointSchema, default: undefined },
    source: { type: String, enum: ['gps', 'stop', 'none'], default: 'none' },
    verified: { type: Boolean, default: false },
    distanceToBusM: Number,
    deviceId: { type: String, index: true },
  },
  { timestamps: true }
);

ReportSchema.index({ route: 1, createdAt: -1 });
ReportSchema.index({ location: '2dsphere' }, { sparse: true });
// Köhnə bildirişlər 7 gündən sonra avtomatik silinir
ReportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

module.exports = model('Report', ReportSchema);
