import { Schema, Model, alertTypes, alertStatus } from "#constants";

/**
 * RouteAlert — xətt üzrə operator xəbərdarlığı.
 *  RESERVE_BUS_NEEDED: crowdsourcing (son 10 dəq "high")
 *  DEMAND_FORECAST:    "Gedirəm" niyyətləri (proaktiv)
 */
const routeAlertSchema = new Schema(
  {
    route: { type: Schema.Types.ObjectId, ref: "Route", required: true },
    type: { type: String, enum: alertTypes, default: "RESERVE_BUS_NEEDED" },
    message: { type: String, required: true },
    status: { type: String, enum: alertStatus, default: "open" },
    // Tipə görə statistika (bax: AnalyticsService / DemandService)
    stats: { type: Schema.Types.Mixed, default: {} },
    // Ayrılmış ehtiyat avtobuslar
    reserveBuses: [{ type: Schema.Types.ObjectId, ref: "Bus" }],
    // Son AI/qayda əsaslı tövsiyə (operator təsdiqləyə bilər)
    recommendation: { type: Schema.Types.Mixed, default: null },
    history: [
      {
        _id: false,
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
        // Tərcümə açarı (client: alert.note.<noteKey>) + parametrlər; operatorun sərbəst qeydi yalnız `note`-dadır
        noteKey: String,
        noteParams: { type: Schema.Types.Mixed },
        by: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
    resolvedAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

routeAlertSchema.index({ route: 1, type: 1, status: 1 });
routeAlertSchema.index({ createdAt: -1 });

routeAlertSchema.virtual("isActive").get(function () {
  return this.status !== "resolved";
});

routeAlertSchema.statics.findActiveFor = function (routeId, type) {
  return this.findOne({ route: routeId, type, status: { $ne: "resolved" } });
};

routeAlertSchema.methods.transition = function (
  status,
  note,
  by,
  { noteKey, noteParams } = {},
) {
  this.status = status;
  if (status === "resolved") this.resolvedAt = new Date();
  this.history.push({
    status,
    note,
    by,
    ...(noteKey ? { noteKey, noteParams } : {}),
  });
  return this;
};

export const RouteAlert = Model("RouteAlert", routeAlertSchema);
