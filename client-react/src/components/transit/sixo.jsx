/**
 * Six-O ümumi hissələri: canlı siqnal, piyada çipi, səfər zolağı (rəng köməkçiləri: @utils/routeColor).
 */
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Footprints } from 'lucide-react'
import { fmtMin } from '@utils'

/** Real-vaxt (GPS) işarəsi — Transit-dəki kimi siqnal qövsləri */
export const LiveArc = ({ className }) => (
  <svg viewBox="0 0 16 16" className={clsx('live-sig', className)} aria-hidden>
    <circle cx="3.2" cy="12.8" r="2" fill="currentColor" />
    <path d="M3.2 7.6a5.2 5.2 0 0 1 5.2 5.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M3.2 2.6a10.2 10.2 0 0 1 10.2 10.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

/** Piyada çipi: "🚶 2 dəqiqə" — solda nöqtəli birləşdirici xətt */
export const WalkChip = ({ sec, className }) => {
  const { t } = useTranslation()
  return (
    <div className={clsx('flex items-center gap-3 pl-[22px]', className)}>
      <span className="h-9 border-l-[3px] border-dotted border-ink-faint/70" aria-hidden />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-1.5 text-base font-extrabold text-ink">
        <Footprints className="h-4 w-4" aria-hidden />
        {t('time.minutes', { count: fmtMin(sec) })}
      </span>
    </div>
  )
}

/** Səfərin üfüqi zolağı: piyada — nöqtələr, avtobus — xətt rəngində zolaq (müddətə mütənasib) */
export const TripBar = ({ legs, className }) => (
  <div className={clsx('flex h-3.5 items-center gap-1', className)} aria-hidden>
    {legs.map((l, i) =>
      l.type === 'walk' ? (
        <span key={i} className="flex h-2 min-w-3 shrink-0 items-center justify-center gap-[3px]" style={{ flexGrow: Math.max(1, l.durationSec / 60) * 0.35 }}>
          {Array.from({ length: Math.min(4, Math.max(1, Math.round(l.durationSec / 120))) }).map((_, k) => (
            <i key={k} className="h-1.5 w-1.5 rounded-full bg-ink-faint/60" />
          ))}
        </span>
      ) : (
        <span key={i} className="h-3.5 min-w-8 rounded-full" style={{ flexGrow: Math.max(2, l.durationSec / 60), background: l.color }} />
      )
    )}
  </div>
)
