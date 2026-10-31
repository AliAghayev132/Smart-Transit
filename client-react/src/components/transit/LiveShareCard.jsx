/** Yanaşma B: canlı mövqeyi anonim paylaşmaq + xəritədə canlı sərnişinləri göstərmək */
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Radio as RadioIcon, Users } from 'lucide-react'

const Switch = ({ checked, onChange, label }) => (
  <input
    type="checkbox"
    role="switch"
    aria-label={label}
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
    className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition-colors before:absolute before:left-1 before:top-1 before:h-5 before:w-5 before:rounded-full before:bg-surface before:shadow before:transition-transform checked:bg-go checked:before:translate-x-5"
  />
)

const Row = ({ icon: Icon, title, hint, checked, onChange }) => (
  <label className="flex cursor-pointer items-center gap-3 py-2">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-ink-soft">
      <Icon className="h-5 w-5" aria-hidden />
    </span>
    <span className="min-w-0 flex-1">
      <strong className="block text-base font-extrabold leading-snug">{title}</strong>
      {hint && <small className="block text-xs font-semibold text-ink-soft">{hint}</small>}
    </span>
    <Switch checked={checked} onChange={onChange} label={title} />
  </label>
)

export const LiveShareCard = ({ share, setShare, state, showDensity, setShowDensity, density }) => {
  const { t } = useTranslation('passenger')
  return (
    <section className="rounded-card bg-surface px-5 py-3 shadow-card">
      <Row icon={RadioIcon} title={t('live.shareTitle')} hint={t('live.shareHint')} checked={share} onChange={setShare} />
      {state && state !== 'off' && (
        <p className={clsx('pb-1 pl-[52px] text-xs font-bold', state === 'on' ? 'text-go' : 'text-warn')} role="status">
          {t(`live.state.${state}`)}
        </p>
      )}
      <div className="my-1 border-t border-line" />
      <Row
        icon={Users}
        title={t('live.showTitle')}
        hint={density ? t('live.online', { count: density.total }) : null}
        checked={showDensity}
        onChange={setShowDensity}
      />
    </section>
  )
}
