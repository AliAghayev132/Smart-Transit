import { Schema, Model } from "#constants";

const stopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: true },
);

const routeSchema = new Schema(
  {
    // Xəttin nömrəsi, məs. "5"
    number: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#2563eb" },
    stops: {
      type: [stopSchema],
      validate: (v) => Array.isArray(v) && v.length >= 2,
    },
    // Həndəsə [[lat, lng], ...]. Boşdursa dayanacaqlardan qurulur.
    path: { type: [[Number]], default: [] },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

routeSchema.index({ active: 1 });

routeSchema.statics.findActive = function () {
  return this.find({ active: true }).lean();
};

export const Route = Model("Route", routeSchema);
