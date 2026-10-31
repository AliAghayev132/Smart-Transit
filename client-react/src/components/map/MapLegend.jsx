import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { crowdLevels, DENSITY_COLOR, DEMAND_COLOR } from '@constants'
import { CrowdDots } from '@components/transit/CrowdBadge'

const Dot = ({ color }) => <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />

/** Xəritə leqendası: sıxlıq səviyyələri (nöqtə sayı + rəng) + aktiv qatlar */
export const MapLegend = ({ density, demand, hidden, className }) => {
  const { t } = useTranslation()
  if (hidden) return null
  return (
    <div
      className={clsx(
        'pointer-events-none absolute bottom-3 left-3 z-[500] flex max-w-[calc(100%-5rem)] flex-wrap gap-x-3 gap-y-1 rounded-2xl bg-surface/95 px-3 py-1.5 text-xs font-bold text-ink-soft shadow-float',
        className
      )}
    >
      {['low', 'mid', 'high'].map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <CrowdDots level={l} size="sm" /> {t(`crowd.${l}.label`)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <Dot color={crowdLevels.unknown.color} /> {t('crowd.unknown.label')}
      </span>
      {density && (
        <span className="inline-flex items-center gap-1.5">
          <Dot color={DENSITY_COLOR} /> {t('map.legend.liveUsers')}
        </span>
      )}
      {demand && (
        <span className="inline-flex items-center gap-1.5">
          <Dot color={DEMAND_COLOR} /> {t('map.legend.demand')}
        </span>
      )}
    </div>
  )
}
