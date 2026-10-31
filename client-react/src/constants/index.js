// Frontend sabitləri — server enum-ları ilə sinxron saxlayın
// (server/constants/shared/enums.js).
import { MAPBOX_TOKEN, CARTO_API_KEY, CARTO_TILE_URL, CARTO_TILE_URL_DARK } from '@/lib/variables'

// ============ SIXLIQ ============
// Crowdsourcing səviyyələri (server crowdLevels) + "unknown".
// Mətnlər tərcümədədir: t(`common:crowd.${level}.label | long | hint`) — bax <CrowdBadge/>.
// `color` — CSS token (tema ilə dəyişir); SVG/xəritə üçün hex: CROWD_HEX / useCrowdHex().
export const crowdLevels = {
  low: { bars: 1, badge: 'success', color: 'var(--color-crowd-low)' },
  mid: { bars: 2, badge: 'warning', color: 'var(--color-crowd-mid)' },
  high: { bars: 3, badge: 'danger', color: 'var(--color-crowd-high)' },
  unknown: { bars: 0, badge: 'default', color: 'var(--color-crowd-none)' },
}
export const crowdLevelKeys = ['low', 'mid', 'high']

/** App.css-dəki --color-crowd-* tokenləri ilə sinxron (Leaflet / recharts SVG atributları var() qəbul etmir) */
export const CROWD_HEX = {
  light: { low: '#087a45', mid: '#b45309', high: '#d1242f', unknown: '#98a2b3' },
  dark: { low: '#3ddc84', mid: '#ffb020', high: '#ff5468', unknown: '#5e5e66' },
}

/** Trend açarları → t(`common:trend.${trend}`) */
export const trendKeys = ['up', 'down', 'flat', 'new']

// ============ XƏBƏRDARLIQLAR ============
// Etiketlər: t(`operator:alert.status.${status}`), t(`operator:alert.type.${type}`)
export const alertStatusOptions = {
  open: { badge: 'danger' },
  acknowledged: { badge: 'warning' },
  dispatched: { badge: 'info' },
  resolved: { badge: 'default' },
}
export const alertTypeOptions = {
  RESERVE_BUS_NEEDED: { badge: 'danger' },
  DEMAND_FORECAST: { badge: 'info' },
}

// Rollar (server userRoles / operatorRoles)
export const operatorRoles = ['operator', 'admin']

// ============ XƏRİTƏ ============
export const BAKU = { lat: 40.389, lng: 49.86 }
// Autocomplete üçün Bakı və ətrafı (minLng, minLat, maxLng, maxLat)
export const BAKU_BBOX = [49.6, 40.25, 50.25, 40.62]
export const GOOGLE_LOAD_TIMEOUT_MS = 10000

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const CARTO_ATTR = `${OSM_ATTR} &copy; <a href="https://carto.com/attributions">CARTO</a>`
const withKey = (url, key) => `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`

/**
 * Leaflet plitə FALLBACK zənciri:
 *   CARTO (API açarı ilə) → Mapbox (token varsa) → CARTO (açıq) → OpenStreetMap
 * Provayder plitə yükləyə bilmirsə avtomatik növbətiyə keçilir (LeafletTransitMap → FallbackTileLayer).
 */
export const TILE_PROVIDERS = [
  CARTO_API_KEY && {
    id: 'carto-key',
    name: 'CARTO',
    url: withKey(CARTO_TILE_URL, CARTO_API_KEY),
    darkUrl: withKey(CARTO_TILE_URL_DARK, CARTO_API_KEY),
    subdomains: '',
    attribution: CARTO_ATTR,
  },
  MAPBOX_TOKEN && {
    id: 'mapbox',
    name: 'Mapbox',
    url: `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
    darkUrl: `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
    attribution: `&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ${OSM_ATTR}`,
  },
  {
    id: 'carto',
    name: 'CARTO',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    darkUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: CARTO_ATTR,
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
  },
].filter(Boolean)

export const WALK_COLOR = '#64748b'
export const DENSITY_COLOR = '#7c3aed'
export const DEMAND_COLOR = '#0284c7'

// ============ OPERATOR ============
// Etiketlər: t(`operator:layers.${key}`)
export const operatorLayers = [{ key: 'segments' }, { key: 'reports' }, { key: 'density' }, { key: 'demand' }]

/** Klaviatura qısa yolları (bax hooks/useKeyboardShortcuts). Etiket: t(`operator:shortcuts.${id}`) */
export const shortcuts = [
  { id: 'map', keys: ['1'] },
  { id: 'routes', keys: ['2'] },
  { id: 'alerts', keys: ['3'] },
  { id: 'reports', keys: ['4'] },
  { id: 'nextPrev', keys: ['J', 'K'] },
  { id: 'acknowledge', keys: ['A'] },
  { id: 'dispatch', keys: ['D'] },
  { id: 'resolve', keys: ['R'] },
  { id: 'command', keys: ['C'] },
  { id: 'escape', keys: ['Esc'] },
  { id: 'theme', keys: ['T'] },
  { id: 'help', keys: ['?'] },
]
