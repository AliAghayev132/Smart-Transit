/* eslint-disable react-refresh/only-export-components */
/**
 * Xəritə mühərriki konteksti: Google Maps yüklənməsini izləyir və uğursuzluqda
 * (açar yoxdur / səhvdir / şəbəkə / vaxt aşımı) Leaflet/OSM-ə FALLBACK edir.
 * Google Places kitabxanası da buradan paylaşılır (SearchBar autocomplete).
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { APIProvider, useApiLoadingStatus, useMapsLibrary } from '@vis.gl/react-google-maps'
import { GOOGLE_MAPS_KEY, MAP_PROVIDER } from '@/lib/variables'
import { GOOGLE_LOAD_TIMEOUT_MS } from '@constants'
import { useTranslation } from 'react-i18next'

const MapEngineContext = createContext(null)

const getSaved = () => {
  try {
    const v = localStorage.getItem('st_map_engine')
    return v === 'google' || v === 'leaflet' ? v : null
  } catch {
    return null
  }
}

const useEngineState = (googleStatus, placesLib) => {
  const [choice, setChoice] = useState(getSaved)
  const wanted = choice || (MAP_PROVIDER === 'leaflet' ? 'leaflet' : 'google')
  const googleOk = googleStatus === 'LOADED'
  const googleBroken = ['NO_KEY', 'FAILED', 'AUTH_FAILURE', 'TIMEOUT'].includes(googleStatus)

  let engine = wanted
  // Səbəb kodu: NO_KEY | FAILED | AUTH_FAILURE | TIMEOUT → t(`common:map.reason.${code}`)
  let fallbackReason = null
  if (wanted === 'google' && googleBroken) {
    engine = 'leaflet'
    fallbackReason = googleStatus
  } else if (wanted === 'google' && !googleOk) {
    engine = 'loading'
  }

  return useMemo(
    () => ({
      engine, // 'google' | 'leaflet' | 'loading'
      googleStatus,
      googleAvailable: googleOk,
      hasGoogleKey: !!GOOGLE_MAPS_KEY,
      fallbackReason,
      placesLib: googleOk ? placesLib : null,
      setEngine: (v) => {
        try {
          localStorage.setItem('st_map_engine', v)
        } catch {
          /* ignore */
        }
        setChoice(v)
      },
    }),
    [engine, googleStatus, googleOk, fallbackReason, placesLib]
  )
}

const GoogleInner = ({ children }) => {
  const status = useApiLoadingStatus()
  const placesLib = useMapsLibrary('places')
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (status === 'LOADED') return
    const t = setTimeout(() => setTimedOut(true), GOOGLE_LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [status])
  const effective =
    status !== 'LOADED' && timedOut && !['FAILED', 'AUTH_FAILURE'].includes(status) ? 'TIMEOUT' : status
  const value = useEngineState(effective, placesLib)
  return <MapEngineContext.Provider value={value}>{children}</MapEngineContext.Provider>
}

const NoGoogle = ({ children }) => {
  const value = useEngineState('NO_KEY', null)
  return <MapEngineContext.Provider value={value}>{children}</MapEngineContext.Provider>
}

export const MapEngineProvider = ({ children }) => {
  const { i18n } = useTranslation()
  // Google Maps dili yalnız ilk yükləmədə təyin olunur (API yenidən yüklənmir)
  const [mapsLang] = useState(() => i18n.resolvedLanguage || 'az')
  if (!GOOGLE_MAPS_KEY || MAP_PROVIDER === 'leaflet') return <NoGoogle>{children}</NoGoogle>
  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} language={mapsLang} region="AZ" libraries={['places', 'marker', 'geometry']}>
      <GoogleInner>{children}</GoogleInner>
    </APIProvider>
  )
}

export const useMapEngine = () => useContext(MapEngineContext)
