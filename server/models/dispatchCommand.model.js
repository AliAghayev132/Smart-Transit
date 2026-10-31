import { Schema, Model, dispatchCommandTypes } from "#constants";

/**
 * DispatchCommand — operatorun verdiyi dispetçer əmri (şablon və ya AI tövsiyəsi əsasında).
 */
const dispatchCommandSchema = new Schema(
  {
    route: { type: Schema.Types.ObjectId, ref: "Route", required: true },
    alert: { type: Schema.Types.ObjectId, ref: "RouteAlert" },
    type: { type: String, enum: dispatchCommandTypes, required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    params: { type: Schema.Types.Mixed, default: {} },
    source: { type: String, enum: ["manual", "ai"], default: "manual" },
    reserveBuses: [{ type: Schema.Types.ObjectId, ref: "Bus" }],
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

dispatchCommandSchema.index({ route: 1, createdAt: -1 });

export const DispatchCommand = Model("DispatchCommand", dispatchCommandSchema);
