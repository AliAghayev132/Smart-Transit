const { Schema, model } = require('mongoose');

const StopSchema = new Schema(
  {
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: true }
);

const RouteSchema = new Schema(
  {
    number: { type: String, required: true, unique: true }, // məs. "5"
    name: { type: String, required: true },
    color: { type: String, default: '#2563eb' },
    stops: { type: [StopSchema], validate: (v) => v.length >= 2 },
    // Xəttin həndəsəsi — [[lat,lng], ...]. Boşdursa dayanacaqlardan qurulur.
    path: { type: [[Number]], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('Route', RouteSchema);
