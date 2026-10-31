import { Schema, Model, crowdLevels, reportSources } from "#constants";

/**
 * DensityReport — sərnişinin crowdsourcing bildirişi (Low / Mid / High).
 */
const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false },
);

const densityReportSchema = new Schema(
  {
    route: { type: Schema.Types.ObjectId, ref: "Route", required: true },
    bus: { type: Schema.Types.ObjectId, ref: "Bus" },
    stopId: { type: Schema.Types.ObjectId },
    level: { type: String, enum: crowdLevels, required: true },
    // GeoJSON nöqtə — yalnız koordinat olduqda yazılır
    location: { type: pointSchema, default: undefined },
    source: { type: String, enum: reportSources, default: "none" },
    verified: { type: Boolean, default: false },
    distanceToBusM: Number,
    deviceId: { type: String, index: true },
    // Şəbəkə mənbəyinin HMAC-ı (IP özü saxlanılmır) — Sybil qorunması üçün
    ipHash: { type: String },
  },
  { timestamps: true, versionKey: false },
);

densityReportSchema.index({ route: 1, createdAt: -1 });
densityReportSchema.index({ location: "2dsphere" }, { sparse: true });
// Proqnoz modeli üçün tarixçə 30 gün saxlanılır
densityReportSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 3600 },
);

densityReportSchema.statics.findSince = function (since, filter = {}) {
  return this.find({ ...filter, createdAt: { $gte: since } }).lean();
};

export const DensityReport = Model("DensityReport", densityReportSchema);
