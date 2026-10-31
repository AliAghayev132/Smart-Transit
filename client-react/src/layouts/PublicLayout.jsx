import { Link, Outlet } from 'react-router'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, LogIn } from 'lucide-react'
import { ThemeToggle, LanguageSwitcher, BrandMark } from '@components'
import { useTransitLive } from '@store/hooks'
import { operatorRoles } from '@constants'

/**
 * Sərnişin qabığı: tam ekran xəritə + üzən idarəetmə düymələri (Six-O — minimum xrom).
 * Sol üst: loqo (mobil). Sağ üst: canlı status, dil, tema, operator girişi.
 */
export const PublicLayout = () => {
  const { t } = useTranslation()
  const { isAuthenticated, role } = useSelector((state) => state.auth)
  const { isConnected } = useTransitLive()
  const isOperator = isAuthenticated && operatorRoles.includes(role)
  const opLabel = isOperator ? t('nav.operatorPanel') : t('nav.login')

  return (
    <div className="relative h-dvh overflow-hidden bg-deep text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-start justify-between gap-2 p-3">
        <Link to="/" className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-1.5 shadow-float sm:pr-4 lg:invisible">
          <BrandMark />
          <span className="hidden text-base font-black tracking-tight sm:inline">{t('app.name')}</span>
        </Link>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface p-1 shadow-float">
          <span
            className={`mx-2 h-2.5 w-2.5 shrink-0 rounded-full ${isConnected ? 'animate-pulse bg-go' : 'bg-ink-faint'}`}
            role="status"
            aria-label={isConnected ? t('status.live') : t('status.offline')}
            title={isConnected ? t('status.live') : t('status.offline')}
          />
          <LanguageSwitcher />
          <ThemeToggle />
          <Link
            to={isOperator ? '/dashboard' : '/login'}
            title={opLabel}
            aria-label={opLabel}
            className="grid h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink"
          >
            {isOperator ? <LayoutDashboard className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          </Link>
        </div>
      </div>
      <Outlet />
    </div>
  )
}
