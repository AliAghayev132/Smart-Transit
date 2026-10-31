// User roles — "operator" dispetçer panelinə daxil olur, "admin" hər şeyi idarə edir
const userRoles = ["user", "operator", "admin"];

// Rollar: operator panelinə giriş icazəsi olanlar
const operatorRoles = ["operator", "admin"];

// Account status
const accountStatus = ["active", "suspended", "pending"];

// OTP types
const otpTypes = ["register", "reset-password", "verify-email"];

// ============ SMART TRANSIT ============

// Crowdsourcing sıxlıq səviyyələri
const crowdLevels = ["low", "mid", "high"];

// Bildirişin koordinat mənbəyi
const reportSources = ["gps", "bus", "stop", "none"];

// Xəbərdarlıq tipləri: crowdsourcing (reaktiv) və səyahət niyyətləri (proaktiv)
const alertTypes = ["RESERVE_BUS_NEEDED", "DEMAND_FORECAST"];

// Xəbərdarlıq statusları
const alertStatus = ["open", "acknowledged", "dispatched", "resolved"];

// Səyahət niyyəti statusları (Yanaşma A)
const intentStatus = ["searched", "confirmed", "cancelled"];

// Dispetçer əmri tipləri
const dispatchCommandTypes = [
  "RESERVE_RELEASE",
  "HEADWAY_REDUCE",
  "SHORT_TURN",
  "EXPRESS_RUN",
  "REROUTE_FROM_LINE",
  "CUSTOM",
];

export {
  userRoles,
  operatorRoles,
  accountStatus,
  otpTypes,
  crowdLevels,
  reportSources,
  alertTypes,
  alertStatus,
  intentStatus,
  dispatchCommandTypes,
};
