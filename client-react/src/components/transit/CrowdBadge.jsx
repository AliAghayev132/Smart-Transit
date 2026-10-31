import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { crowdLevels } from '@constants'

/**
 * Doluluq nöqtələri (Six-O): 3 nöqtə, dolu nöqtə sayı = səviyyə.
 * Rəng tək məlumat daşıyıcısı deyil — nöqtə sayı da səviyyəni göstərir.
 */
export const CrowdDots = ({ level = 'unknown', size = 'md', tone, className }) => {
  const l = crowdLevels[level] || crowdLevels.unknown
  const d = size === 'lg' ? 'h-2.5 w-2.5' : size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
  return (
    <span className={clsx('inline-flex items-center gap-[3px]', className)} aria-hidden>
      {[1, 2, 3].map((i) => (
        <i
          key={i}
          className={clsx('rounded-full', d, i > l.bars && 'opacity-30')}
          style={{ background: i <= l.bars ? tone || l.color : tone || 'var(--color-crowd-none)' }}
        />
      ))}
    </span>
  )
}

/** Köhnə ad — geriyə uyğunluq */
export const CrowdBars = CrowdDots

/** Sıxlıq nişanı: nöqtələr + söz (Az / Orta / Yüksək), isteğe bağlı doluluq faizi */
export const CrowdBadge = ({ level = 'unknown', long = false, size = 'md', pct, className }) => {
  const { t } = useTranslation()
  const l = crowdLevels[level] || crowdLevels.unknown
  const key = crowdLevels[level] ? level : 'unknown'
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-bold',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className
      )}
      style={{ color: l.color, background: `color-mix(in srgb, ${l.color} 14%, transparent)` }}
    >
      <CrowdDots level={key} size="sm" />
      {t(`crowd.${key}.${long ? 'long' : 'label'}`)}
      {pct != null && key !== 'unknown' && <span className="opacity-75">{pct}%</span>}
    </span>
  )
}

/** Xətt nömrəsi nişanı (xətt rəngində) */
export const RouteNum = ({ number, color, size = 'md', className }) => (
  <span
    className={clsx(
      'inline-flex shrink-0 items-center justify-center rounded-lg font-black leading-none text-white',
      size === 'sm' ? 'h-5 min-w-7 px-1.5 text-xs' : size === 'lg' ? 'h-9 min-w-11 px-2.5 text-lg' : 'h-6 min-w-8 px-1.5 text-sm',
      className
    )}
    style={{ background: color }}
  >
    {number}
  </span>
)
