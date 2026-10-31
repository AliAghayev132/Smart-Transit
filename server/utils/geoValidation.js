import { i18nError } from "./httpError.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const isValidLatLng = (lat, lng) =>
  isNum(lat) && isNum(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * { lat, lng, name? } obyektini yoxlayıb normallaşdırır, səhvdirsə 400 atır.
 */
const parsePoint = (p, label = "point") => {
  const lat = p && Number(p.lat);
  const lng = p && Number(p.lng);
  if (!isValidLatLng(lat, lng)) {
    throw i18nError(400, "common.invalidPoint", { label });
  }
  return {
    lat,
    lng,
    name: p.name ? String(p.name).slice(0, 120) : undefined,
  };
};

export { isNum, isValidLatLng, parsePoint };
