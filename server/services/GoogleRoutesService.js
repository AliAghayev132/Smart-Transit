import { config } from "#config";
import { GeoService } from "#services/GeoService.js";
import { PlannerService } from "#services/PlannerService.js";

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.polyline.encodedPolyline",
  "routes.legs.steps.startLocation",
  "routes.legs.steps.endLocation",
  "routes.legs.steps.transitDetails",
].join(",");

const secs = (d) => (d ? parseInt(String(d).replace("s", ""), 10) || 0 : 0);
const ll = (loc) =>
  loc?.latLng ? { lat: loc.latLng.latitude, lng: loc.latLng.longitude } : null;

/**
 * GoogleRoutesService (static) — isteğe bağlı.
 * Google Routes API (v2) ilə TRANSIT alternativləri. Açar yoxdursa və ya xəta olarsa
 * boş nəticə qaytarır — planlayıcı öz mühərriki ilə davam edir.
 */
class GoogleRoutesService {
  static get enabled() {
    return !!config.transit.googleRoutesKey;
  }

  static async computeTransit(fleet, crowd, from, to) {
    if (!this.enabled) return { enabled: false, itineraries: [] };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": config.transit.googleRoutesKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: from.lat, longitude: from.lng } },
          },
          destination: {
            location: { latLng: { latitude: to.lat, longitude: to.lng } },
          },
          travelMode: "TRANSIT",
          computeAlternativeRoutes: true,
          languageCode: "az",
          units: "METRIC",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          enabled: true,
          error: data.error?.message || `HTTP ${res.status}`,
          itineraries: [],
        };
      }
      const now = Date.now();
      const itineraries = (data.routes || [])
        .map((r) => this.toItinerary(r, fleet, crowd, from, to, now))
        .filter(Boolean);
      return { enabled: true, itineraries };
    } catch (e) {
      return {
        enabled: true,
        error: e.name === "AbortError" ? "timeout" : e.message,
        itineraries: [],
      };
    } finally {
      clearTimeout(timer);
    }
  }

  static toItinerary(route, fleet, crowd, from, to, now) {
    const steps = (route.legs || []).flatMap((l) => l.steps || []);
    const legs = [];
    let clock = 0;
    for (const s of steps) {
      const path = s.polyline?.encodedPolyline
        ? GeoService.decodePolyline(s.polyline.encodedPolyline)
        : [];
      const dur = secs(s.staticDuration);
      if (s.travelMode === "TRANSIT" && s.transitDetails) {
        const t = s.transitDetails;
        const line = t.transitLine || {};
        const number = line.nameShort || line.name || "?";
        // Google xətti bizim xətlə eyni nömrədədirsə — sıxlığı əlavə edirik
        const ours = fleet.findRouteByNumber(number);
        const rc =
          ours && crowd
            ? crowd.routes.find((x) => x.routeId === String(ours.route._id))
            : null;
        const dep = t.stopDetails?.departureTime
          ? (new Date(t.stopDetails.departureTime).getTime() - now) / 1000
          : clock;
        const waitSec = Math.max(0, Math.round(dep - clock));
        legs.push({
          type: "bus",
          routeId: ours ? String(ours.route._id) : null,
          number,
          name: line.name || number,
          color: line.color || ours?.route.color || "#475569",
          headsign: t.headsign,
          from: {
            name: t.stopDetails?.departureStop?.name,
            ...ll(t.stopDetails?.departureStop?.location),
          },
          to: {
            name: t.stopDetails?.arrivalStop?.name,
            ...ll(t.stopDetails?.arrivalStop?.location),
          },
          departInSec: Math.round(dep),
          waitSec,
          rideSec: dur,
          durationSec: waitSec + dur,
          stopsCount: t.stopCount || 0,
          distanceM: s.distanceMeters || 0,
          crowd: rc
            ? { level: rc.level, source: "route", loadPct: rc.loadPct ?? null }
            : { level: "unknown", source: "none", loadPct: null },
          live: false,
          path,
        });
        clock += waitSec + dur;
      } else {
        const last = legs[legs.length - 1];
        if (last?.type === "walk") {
          last.distanceM += s.distanceMeters || 0;
          last.durationSec += dur;
          last.path.push(...path);
          last.to = ll(s.endLocation) || last.to;
        } else {
          legs.push({
            type: "walk",
            from: ll(s.startLocation) || from,
            to: ll(s.endLocation) || to,
            distanceM: s.distanceMeters || 0,
            durationSec: dur,
            path,
          });
        }
        clock += dur;
      }
    }
    return legs.length ? PlannerService.finalize(legs, now, "google") : null;
  }
}

export { GoogleRoutesService };
