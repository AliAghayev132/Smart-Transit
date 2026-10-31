/**
 * Centralized URL / ENV configuration (Vite build).
 * Vite only exposes `VITE_*` variables, inlined at BUILD time.
 */

const stripTrailingSlash = (url) =>
  typeof url === 'string' && url.endsWith('/') ? url.slice(0, -1) : url

/** Backend origin (without /api) — Socket.IO connects here */
export const SERVER_URL = stripTrailingSlash(import.meta.env.VITE_API_URL || 'http://localhost:5000')

/** Backend REST API root (kept in sync with store/api/baseApi.js) */
export const API_URL = `${SERVER_URL}/api`

/** Canonical site root (SEO) */
export const SITE_URL = stripTrailingSlash(import.meta.env.VITE_SITE_URL || 'http://localhost:5173')

// ============ MAPS ============
/** auto | google | leaflet */
export const MAP_PROVIDER = (import.meta.env.VITE_MAP_PROVIDER || 'auto').toLowerCase()
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
export const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID'
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

/** CARTO basemaps (raster) — API açarı ilə. URL-lərə ?key=… avtomatik əlavə olunur. */
export const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY || ''
export const CARTO_TILE_URL = import.meta.env.VITE_CARTO_TILE_URL || 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
export const CARTO_TILE_URL_DARK = import.meta.env.VITE_CARTO_TILE_URL_DARK || 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'

const variables = { SERVER_URL, API_URL, SITE_URL, MAP_PROVIDER, GOOGLE_MAPS_KEY, GOOGLE_MAP_ID, MAPBOX_TOKEN, CARTO_API_KEY }
export default variables
