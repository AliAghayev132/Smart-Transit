/**
 * Ünvan axtarışı (autocomplete) provayderləri:
 *  1) Google Places API (New) — açar varsa və Google yüklənibsə
 *  2) Photon (OpenStreetMap / komoot) — fallback, açar tələb etmir
 *  3) Öz dayanacaqlarımız — həmişə (şəbəkəsiz)
 */
import { BAKU, BAKU_BBOX } from '@constants'
import { normalizeAz } from '@utils'
import i18n from '@/lib/i18n'

const PHOTON = 'https://photon.komoot.io'

/** Dayanacaqlar üzrə yerli axtarış */
export const searchStops = (q, routes, limit = 4) => {
  const n = normalizeAz(q.trim())
  if (!n) return []
  const seen = new Map()
  for (const r of routes) {
    for (const s of r.stops) {
      if (!normalizeAz(s.name).includes(n)) continue
      const cur = seen.get(s.name) || { id: `stop:${s.id}`, name: s.name, lat: s.lat, lng: s.lng, routes: [], source: 'stop' }
      if (!cur.routes.includes(r.number)) cur.routes.push(r.number)
      seen.set(s.name, cur)
    }
  }
  return [...seen.values()]
    .map((x) => ({ ...x, secondary: i18n.t('passenger:search.stopSecondary', { routes: x.routes.join(', '), count: x.routes.length }) }))
    .sort((a, b) => normalizeAz(a.name).indexOf(n) - normalizeAz(b.name).indexOf(n))
    .slice(0, limit)
}

const photonLabel = (p) => {
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const name = p.name || street || p.district || p.city || i18n.t('passenger:search.address')
  const secondary = [p.name ? street : null, p.district || p.locality, p.city].filter(Boolean).join(', ')
  return { name, secondary }
}

export const photonSearch = async (q, signal) => {
  const url = `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=6&lat=${BAKU.lat}&lon=${BAKU.lng}&bbox=${BAKU_BBOX.join(',')}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  const data = await res.json()
  return (data.features || []).map((f, i) => {
    const [lng, lat] = f.geometry.coordinates
    return { id: `osm:${f.properties.osm_id || i}`, ...photonLabel(f.properties), lat, lng, source: 'osm' }
  })
}

export const photonReverse = async (lat, lng) => {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&limit=1`)
    const f = (await res.json()).features?.[0]
    return f ? photonLabel(f.properties).name : null
  } catch {
    return null
  }
}

/** Google Places API (New) — AutocompleteSuggestion */
export const googleSuggest = async (placesLib, q, sessionToken) => {
  const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: q,
    sessionToken,
    language: 'az',
    region: 'az',
    includedRegionCodes: ['az'],
    locationBias: { center: BAKU, radius: 30000 },
  })
  return suggestions
    .filter((s) => s.placePrediction)
    .slice(0, 5)
    .map((s) => {
      const p = s.placePrediction
      return {
        id: `g:${p.placeId}`,
        name: p.mainText?.text || p.text?.text,
        secondary: p.secondaryText?.text || '',
        source: 'google',
        prediction: p,
      }
    })
}

/** Google təklifi → koordinat (Place Details) */
export const googleResolve = async (item) => {
  const place = item.prediction.toPlace()
  await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] })
  return { lat: place.location.lat(), lng: place.location.lng(), name: place.displayName || item.name }
}

/** Koordinat → ünvan adı: Google Geocoder → Photon → koordinat */
export const reverseLabel = async (lat, lng, googleAvailable) => {
  if (googleAvailable && window.google?.maps?.Geocoder) {
    try {
      const { results } = await new window.google.maps.Geocoder().geocode({ location: { lat, lng }, language: 'az' })
      if (results?.[0]) return results[0].formatted_address.split(',').slice(0, 2).join(',')
    } catch {
      /* Geocoding API aktiv deyil — Photon-a keçirik */
    }
  }
  return (await photonReverse(lat, lng)) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
