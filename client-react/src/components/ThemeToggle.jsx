import { Moon, Sun } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@store/context'

/** Qaranlıq / işıqlı rejim düyməsi (qısa yol: T) */
export const ThemeToggle = ({ className }) => {
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const label = isDark ? t('theme.toLight') : t('theme.toDark')
  return (
    <button
      onClick={toggleTheme}
      title={`${label} (T)`}
      aria-label={label}
      className={clsx('grid h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink', className)}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
