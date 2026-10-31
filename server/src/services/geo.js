// Coğrafi köməkçi funksiyalar: məsafə, xətt həndəsəsi, proyeksiya, interpolyasiya

const R = 6371000; // Yer radiusu, metr
const toRad = (d) => (d * Math.PI) / 180;

function haversine(a, b) {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Xəttin həndəsəsini qurur: nöqtələr, kumulyativ məsafələr, dayanacaqların xətt üzrə mövqeyi.
 */
function buildGeometry(route) {
  const points =
    route.path && route.path.length >= 2
      ? route.path.map((p) => [p[0], p[1]])
      : route.stops.map((s) => [s.lat, s.lng]);

  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  const length = cum[cum.length - 1];

  const geom = { points, cum, length };
  const stopDist = route.stops.map((s) => project(geom, s.lat, s.lng).distance);
  geom.stopDist = stopDist;
  return geom;
}

/** Xətt üzrə d məsafəsindəki nöqtə */
function pointAt(geom, d) {
  const { points, cum, length } = geom;
  if (d <= 0) return points[0];
  if (d >= length) return points[points.length - 1];
  let i = 1;
  while (i < cum.length && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / seg;
  const a = points[i - 1];
  const b = points[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Nöqtəni xəttə proyeksiya edir.
 * Qaytarır: { distance: xətt boyunca məsafə, offset: xəttdən perpendikulyar məsafə (m) }
 */
function project(geom, lat, lng) {
  const { points, cum } = geom;
  const k = Math.cos(toRad(lat)) * 111320; // 1 dərəcə uzunluq ~ metr
  const m = 110540; // 1 dərəcə en ~ metr
  let best = { distance: 0, offset: Infinity };
  for (let i = 1; i < points.length; i++) {
    const ax = points[i - 1][1] * k, ay = points[i - 1][0] * m;
    const bx = points[i][1] * k, by = points[i][0] * m;
    const px = lng * k, py = lat * m;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx, qy = ay + t * dy;
    const off = Math.hypot(px - qx, py - qy);
    if (off < best.offset) {
      best = { distance: cum[i - 1] + t * (cum[i] - cum[i - 1]), offset: off };
    }
  }
  return best;
}

/** d məsafəsi hansı dayanacaqlar arası seqmentə düşür (0..stops-2) */
function segmentIndex(geom, d) {
  const sd = geom.stopDist;
  for (let i = 1; i < sd.length; i++) if (d <= sd[i]) return i - 1;
  return sd.length - 2;
}

/** Dayanacaqlar arası seqmentlərin həndəsəsi (sıxlıq xəritəsində rəngləmək üçün) */
function segmentPaths(geom) {
  const out = [];
  for (let i = 0; i < geom.stopDist.length - 1; i++) {
    const a = geom.stopDist[i], b = geom.stopDist[i + 1];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const pts = [pointAt(geom, lo)];
    geom.cum.forEach((c, k) => { if (c > lo && c < hi) pts.push(geom.points[k]); });
    pts.push(pointAt(geom, hi));
    out.push(pts);
  }
  return out;
}

/** Xətt üzrə d1-dən d2-yə (istiqamət nəzərə alınmaqla) nöqtələr */
function slicePath(geom, d1, d2) {
  const lo = Math.min(d1, d2), hi = Math.max(d1, d2);
  const pts = [pointAt(geom, lo)];
  geom.cum.forEach((c, k) => { if (c > lo && c < hi) pts.push(geom.points[k]); });
  pts.push(pointAt(geom, hi));
  return d2 >= d1 ? pts : pts.reverse();
}

/** Google "encoded polyline" formatını [[lat,lng],...] massivinə çevirir */
function decodePolyline(str) {
  const out = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

module.exports = { haversine, buildGeometry, pointAt, project, segmentIndex, segmentPaths, slicePath, decodePolyline };
