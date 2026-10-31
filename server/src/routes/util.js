const config = require('../config');

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const validLatLng = (lat, lng) => isNum(lat) && isNum(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function httpError(status, message, extra) {
  const e = new Error(message);
  e.status = status;
  Object.assign(e, extra);
  return e;
}

function requireOperator(req, _res, next) {
  if (!config.operatorKey) return next();
  if (req.get('x-operator-key') === config.operatorKey) return next();
  next(httpError(401, 'Operator açarı yanlışdır və ya göndərilməyib'));
}

/** {lat,lng,name?} obyektini yoxlayır */
function parsePoint(p, label) {
  const lat = p && Number(p.lat);
  const lng = p && Number(p.lng);
  if (!validLatLng(lat, lng)) throw httpError(400, `${label}: lat/lng düzgün deyil`);
  return { lat, lng, name: p.name ? String(p.name).slice(0, 120) : undefined };
}

module.exports = { isNum, validLatLng, httpError, requireOperator, parsePoint };
