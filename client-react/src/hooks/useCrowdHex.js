import { useTheme } from '@store/context'
import { CROWD_HEX } from '@constants'

/** Cari temaya uyğun sıxlıq rəngləri (hex) — Leaflet / recharts kimi SVG atributları üçün */
export const useCrowdHex = () => {
  const { isDark } = useTheme()
  return CROWD_HEX[isDark ? 'dark' : 'light']
}
