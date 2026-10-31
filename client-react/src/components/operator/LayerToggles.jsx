import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import { operatorLayers } from '@constants'

/** Xəritə qatları (seqment sıxlığı, bildirişlər, canlı B, tələb A) */
export const LayerToggles = ({ layers, onToggle, className }) => {
  const { t } = useTranslation('operator')
  return (
    <div role="group" aria-label={t('layers.title')} className={clsx('flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-[20px] bg-surface/95 p-1 text-xs font-bold shadow-float backdrop-blur', className)}>
      <Layers className="mx-1.5 h-4 w-4 text-ink-faint" aria-hidden />
      {operatorLayers.map((l) => (
        <button
          key={l.key}
          aria-pressed={!!layers[l.key]}
          onClick={() => onToggle(l.key)}
          className={clsx('h-8 rounded-full px-3 transition-colors', layers[l.key] ? 'bg-brand text-on-brand' : 'text-ink-soft hover:bg-raised hover:text-ink')}
        >
          {t(`layers.${l.key}`)}
        </button>
      ))}
    </div>
  )
}
