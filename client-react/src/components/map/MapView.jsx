/**
 * MapView — xəritə mühərrikini seçir:
 *   Google Maps (açar varsa və yükləndisə)  ⟶  əks halda Leaflet (CARTO / OSM plitələri, avtomatik fallback)
 * Google açarı varsa küncdə əl ilə keçid düyməsi görünür (seçim yadda qalır).
 */
import { lazy, Suspense, useState } from 'react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { useMapEngine } from '@store/context'
import { LeafletTransitMap } from './LeafletTransitMap'
import { MapLegend } from './MapLegend'

const GoogleTransitMap = lazy(() => import('./GoogleTransitMap'))

const Loading = ({ text }) => <div className="absolute inset-0 grid place-items-center bg-deep text-sm font-bold text-ink-soft">{text}</div>

export const MapView = ({ legend = {}, className, controlsClassName, children, ...props }) => {
  const { t } = useTranslation()
  const ctx = useMapEngine()
  const [tile, setTile] = useState(null)
  const engine = ctx?.engine || 'leaflet'

  return (
    <div className={clsx('relative h-full w-full overflow-hidden bg-deep', className)}>
      {engine === 'loading' && <Loading text={t('map.loadingGoogle')} />}
      {engine === 'google' && (
        <Suspense fallback={<Loading text={t('map.loading')} />}>
          <GoogleTransitMap {...props} />
        </Suspense>
      )}
      {engine === 'leaflet' && <LeafletTransitMap {...props} onTileProvider={setTile} />}

      {/* Mühərrik keçidi — yalnız Google açarı olduqda mənalıdır */}
      {ctx?.hasGoogleKey && (
        <div className={clsx('absolute left-3 top-3 z-[600] flex flex-col items-start gap-2', controlsClassName)}>
          <div className="flex rounded-full bg-surface p-1 shadow-float" role="group" aria-label={t('map.engine')}>
            {[
              ['google', 'Google'],
              ['leaflet', tile?.name || 'OSM'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => ctx?.setEngine(key)}
                aria-pressed={engine === key}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-bold transition-colors',
                  engine === key ? 'bg-brand text-on-brand' : 'text-ink-soft hover:bg-raised hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {ctx?.fallbackReason && (
            <div className="max-w-xs rounded-2xl bg-[color-mix(in_srgb,var(--color-warn)_18%,var(--color-surface))] px-3 py-1.5 text-xs font-bold text-warn shadow-float">
              {t('map.fallback', { reason: t(`map.reason.${ctx.fallbackReason}`) })}
            </div>
          )}
        </div>
      )}

      <MapLegend {...legend} />
      {children}
    </div>
  )
}

export default MapView
