const { Schema, model, Types } = require('mongoose');

/**
 * Yanaşma A (proaktiv): istifadəçinin "haradan → haraya" getmək niyyəti.
 * Hər cihazın eyni anda yalnız bir aktiv niyyəti olur (deviceId üzrə upsert).
 *  - searched:  marşrut axtarıb (zəif siqnal)
 *  - confirmed: "Gedirəm" düyməsini basıb (güclü siqnal)
 */
const PointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

const TripIntentSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['searched', 'confirmed', 'cancelled'], default: 'searched', index: true },
    origin: { type: PointSchema, required: true },
    destination: { type: PointSchema, required: true },
    originLabel: String,
    destinationLabel: String,
    // İlk avtobus mərhələsi — hansı dayanacaqdan hansı xəttə minəcək
    board: {
      route: { type: Types.ObjectId, ref: 'Route' },
      routeNumber: String,
      stopId: Types.ObjectId,
      stopName: String,
      lat: Number,
      lng: Number,
    },
    routes: [{ type: Types.ObjectId, ref: 'Route' }],
    departAt: Date, // planlaşdırılan minik vaxtı
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

TripIntentSchema.index({ origin: '2dsphere' });
TripIntentSchema.index({ 'board.stopId': 1, status: 1 });
TripIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // vaxtı keçən niyyətlər avtomatik silinir

module.exports = model('TripIntent', TripIntentSchema);
