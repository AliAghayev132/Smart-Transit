const { Schema, model, Types } = require('mongoose');

const AlertSchema = new Schema(
  {
    route: { type: Types.ObjectId, ref: 'Route', required: true, index: true },
    // RESERVE_BUS_NEEDED — crowdsourcing (reaktiv), DEMAND_FORECAST — səyahət niyyətləri (proaktiv)
    type: { type: String, enum: ['RESERVE_BUS_NEEDED', 'DEMAND_FORECAST'], default: 'RESERVE_BUS_NEEDED', index: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'dispatched', 'resolved'],
      default: 'open',
      index: true,
    },
    // RESERVE_BUS_NEEDED: {windowMin, highReports, totalReports, highRatio, firstHighAt, lastHighAt}
    // DEMAND_FORECAST:    {windowMin, confirmedIntents, topStop, topStopCount}
    stats: { type: Schema.Types.Mixed, default: {} },
    reserveBus: { type: Types.ObjectId, ref: 'Bus' },
    history: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
    resolvedAt: Date,
  },
  { timestamps: true }
);

module.exports = model('Alert', AlertSchema);
