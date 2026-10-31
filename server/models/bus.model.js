import { Schema, Model } from "#constants";

const busSchema = new Schema(
  {
    route: { type: Schema.Types.ObjectId, ref: "Route", required: true },
    plate: { type: String, required: true, unique: true, trim: true },
    lat: Number,
    lng: Number,
    // Xətt boyunca məsafə (m) və istiqamət (+1 irəli, -1 geri)
    distance: { type: Number, default: 0 },
    direction: { type: Number, enum: [1, -1], default: 1 },
    isReserve: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    lastUpdate: Date,
  },
  { timestamps: true, versionKey: false },
);

busSchema.index({ route: 1, active: 1 });

export const Bus = Model("Bus", busSchema);
