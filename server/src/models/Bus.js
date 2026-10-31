const { Schema, model, Types } = require('mongoose');

const BusSchema = new Schema(
  {
    route: { type: Types.ObjectId, ref: 'Route', required: true, index: true },
    plate: { type: String, required: true, unique: true },
    lat: Number,
    lng: Number,
    // Xətt boyunca məsafə (metr) və istiqamət (+1 irəli, -1 geri)
    distance: { type: Number, default: 0 },
    direction: { type: Number, enum: [1, -1], default: 1 },
    isReserve: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    lastUpdate: Date,
  },
  { timestamps: true }
);

module.exports = model('Bus', BusSchema);
