import { Schema, Model } from "#constants";

/**
 * DensitySnapshot — Yanaşma B: dəqiqəlik ANONİM aqreqat (fərdi koordinat saxlanılmır).
 */
const densitySnapshotSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    total: Number,
    cellDeg: Number,
    cells: [{ _id: false, lat: Number, lng: Number, count: Number }],
    stops: [{ _id: false, stopId: String, name: String, waiting: Number }],
    buses: [{ _id: false, busId: String, routeNumber: String, riders: Number }],
  },
  { versionKey: false },
);

densitySnapshotSchema.index({ at: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

export const DensitySnapshot = Model("DensitySnapshot", densitySnapshotSchema);
