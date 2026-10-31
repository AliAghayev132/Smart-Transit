/**
 * GeoService (static)
 * Coğrafi hesablamalar: məsafə, xətt həndəsəsi, proyeksiya, interpolyasiya, polyline decode.
 */
const EARTH_RADIUS_M = 6371000;
const toRad = (d) => (d * Math.PI) / 180;

class GeoService {
  /** İki nöqtə arası məsafə (m). a, b: [lat, lng] */
  static haversine(a, b) {
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
  }

  /** Xəttin həndəsəsi: nöqtələr, kumulyativ məsafələr, dayanacaqların xətt üzrə mövqeyi */
  static buildGeometry(route) {
    const points =
      route.path && route.path.length >= 2
        ? route.path.map((p) => [p[0], p[1]])
        : route.stops.map((s) => [s.lat, s.lng]);

    const cum = [0];
    for (let i = 1; i < points.length; i++) {
      cum.push(cum[i - 1] + this.haversine(points[i - 1], points[i]));
    }
    const geom = { points, cum, length: cum[cum.length - 1] };
    geom.stopDist = route.stops.map(
      (s) => this.project(geom, s.lat, s.lng).distance,
    );
    return geom;
  }

  /** Xətt üzrə d məsafəsindəki nöqtə [lat, lng] */
  static pointAt(geom, d) {
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

  /** Nöqtəni xəttə proyeksiya edir → { distance (xətt boyunca), offset (xəttdən, m) } */
  static project(geom, lat, lng) {
    const { points, cum } = geom;
    const kx = Math.cos(toRad(lat)) * 111320;
    const ky = 110540;
    let best = { distance: 0, offset: Infinity };
    for (let i = 1; i < points.length; i++) {
      const ax = points[i - 1][1] * kx;
      const ay = points[i - 1][0] * ky;
      const bx = points[i][1] * kx;
      const by = points[i][0] * ky;
      const px = lng * kx;
      const py = lat * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(
        0,
        Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2),
      );
      const off = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (off < best.offset) {
        best = {
          distance: cum[i - 1] + t * (cum[i] - cum[i - 1]),
          offset: off,
        };
      }
    }
    return best;
  }

  /** d məsafəsi hansı dayanacaqlar arası seqmentə düşür (0..stops-2) */
  static segmentIndex(geom, d) {
    const sd = geom.stopDist;
    for (let i = 1; i < sd.length; i++) if (d <= sd[i]) return i - 1;
    return sd.length - 2;
  }

  /** Xətt üzrə d1 → d2 (istiqamət nəzərə alınmaqla) nöqtələr */
  static slicePath(geom, d1, d2) {
    const lo = Math.min(d1, d2);
    const hi = Math.max(d1, d2);
    const pts = [this.pointAt(geom, lo)];
    geom.cum.forEach((c, k) => {
      if (c > lo && c < hi) pts.push(geom.points[k]);
    });
    pts.push(this.pointAt(geom, hi));
    return d2 >= d1 ? pts : pts.reverse();
  }

  /** Dayanacaqlar arası seqmentlərin həndəsəsi (sıxlıq xəritəsi üçün) */
  static segmentPaths(geom) {
    const out = [];
    for (let i = 0; i < geom.stopDist.length - 1; i++) {
      out.push(this.slicePath(geom, geom.stopDist[i], geom.stopDist[i + 1]));
    }
    return out;
  }

  /** Google "encoded polyline" → [[lat, lng], ...] */
  static decodePolyline(str) {
    const out = [];
    let i = 0;
    let lat = 0;
    let lng = 0;
    while (i < str.length) {
      for (const which of [0, 1]) {
        let shift = 0;
        let result = 0;
        let b;
        do {
          b = str.charCodeAt(i++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const delta = result & 1 ? ~(result >> 1) : result >> 1;
        if (which === 0) lat += delta;
        else lng += delta;
      }
      out.push([lat / 1e5, lng / 1e5]);
    }
    return out;
  }
}

export { GeoService };
