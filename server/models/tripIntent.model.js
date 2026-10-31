import { Schema, Model, intentStatus } from "#constants";

/**
 * TripIntent — Yanaşma A (proaktiv): "haradan → haraya" niyyəti.
 * Hər cihazın bir aktiv niyyəti olur (deviceId üzrə upsert).
 */
const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false },
);

const tripIntentSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    status: { type: String, enum: intentStatus, default: "searched" },
    origin: { type: pointSchema, required: true },
    destination: { type: pointSchema, required: true },
    originLabel: String,
    destinationLabel: String,
    board: {
      route: { type: Schema.Types.ObjectId, ref: "Route" },
      routeNumber: String,
      stopId: Schema.Types.ObjectId,
      stopName: String,
      lat: Number,
      lng: Number,
    },
    routes: [{ type: Schema.Types.ObjectId, ref: "Route" }],
    departAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

tripIntentSchema.index({ origin: "2dsphere" });
tripIntentSchema.index({ "board.stopId": 1, status: 1 });
tripIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TripIntent = Model("TripIntent", tripIntentSchema);
