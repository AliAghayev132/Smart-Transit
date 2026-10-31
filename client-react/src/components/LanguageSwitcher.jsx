import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { LANGS } from '@/lib/i18n'

/** AZ | EN | RU — bir toxunuşla dil dəyişimi (seçim yadda qalır) */
export const LanguageSwitcher = ({ className }) => {
  const { t, i18n } = useTranslation()
  const active = i18n.resolvedLanguage
  return (
    <div role="radiogroup" aria-label={t('lang.label')} className={clsx('inline-flex shrink-0 rounded-full bg-raised p-1', className)}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={active === l.code}
          lang={l.code}
          title={l.name}
          onClick={() => i18n.changeLanguage(l.code)}
          className={clsx(
            'h-8 min-w-9 rounded-full px-2 text-xs font-black transition-colors',
            active === l.code ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink'
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  )
}
