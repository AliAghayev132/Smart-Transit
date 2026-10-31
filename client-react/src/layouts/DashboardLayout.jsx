// React
import { useCallback, useMemo, useState } from 'react'

// React Router
import { Link, Outlet, NavLink, useLocation, useNavigate } from 'react-router'

// Redux
import { useSelector, useDispatch } from 'react-redux'

// i18n
import { useTranslation } from 'react-i18next'

// Motion
import { motion, AnimatePresence } from 'framer-motion'

// Icons
import { Map as MapIcon, Route as RouteIcon, AlertTriangle, BarChart3, LogOut, ChevronLeft, ChevronRight, BusFront, Keyboard, Sparkles, Smartphone } from 'lucide-react'

// Components
import { ThemeToggle, LanguageSwitcher, LiveIndicator, AlertBanner, DispatchModal, ShortcutsModal, Badge } from '@components'

// Store
import { logout } from '@store/slices/authSlice'
import { hideBanner, showBanner, selectAlert, closeDispatch, setShortcutsOpen } from '@store/slices/operatorSlice'
import { baseApi, useLogoutMutation, useGetAlertsQuery, useGetRoutesQuery, useGetAiStatusQuery } from '@store/api'
import { useSocketEvent, useTransitLive } from '@store/hooks'
import { useTheme } from '@store/context'

// Hooks + utils
import { useAlertActions, useKeyboardShortcuts } from '@hooks'
import { beep } from '@utils'

// Dispetçer naviqasiyası (qısa yollar: 1–4). Ad: t(`nav.${id}`)
const navItems = [
  { id: 'map', path: '/dashboard', icon: MapIcon, end: true, key: '1' },
  { id: 'routes', path: '/dashboard/routes', icon: RouteIcon, key: '2' },
  { id: 'alerts', path: '/dashboard/alerts', icon: AlertTriangle, key: '3', badge: true },
  { id: 'reports', path: '/dashboard/reports', icon: BarChart3, key: '4' },
]

/**
 * Operator (dispetçer) qabığı: sol menyu + header + <Outlet/>.
 * Qlobal: yeni xəbərdarlıq banneri (səs ilə), dispetçer əmri pəncərəsi,
 * klaviatura qısa yolları və real-vaxt keş yeniləmələri.
 */
export const DashboardLayout = () => {
  const { t } = useTranslation('operator')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { banner, dispatch: dispatchState, shortcutsOpen, selectedAlertId } = useSelector((state) => state.operator)
  const [logoutApi] = useLogoutMutation()
  const { toggleTheme } = useTheme()
  const { isConnected } = useTransitLive()
  const { data: alerts = [] } = useGetAlertsQuery({ status: 'active' })
  const { data: routes = [] } = useGetRoutesQuery()
  const { data: ai } = useGetAiStatusQuery()
  const { act, compose } = useAlertActions()

  // ---- Real-vaxt: yeni / yenilənmiş xəbərdarlıq, əmrlər ----
  const onAlertNew = useCallback(
    (alert) => {
      dispatch(showBanner(alert))
      dispatch(baseApi.util.invalidateTags([{ type: 'Alert', id: 'LIST' }]))
      beep()
    },
    [dispatch]
  )
  const onAlertUpdate = useCallback((a) => dispatch(baseApi.util.invalidateTags([{ type: 'Alert', id: 'LIST' }, { type: 'Alert', id: a?._id }])), [dispatch])
  const onDispatchNew = useCallback(() => dispatch(baseApi.util.invalidateTags(['Dispatch'])), [dispatch])
  const onDemand = useCallback(() => dispatch(baseApi.util.invalidateTags(['Demand'])), [dispatch])
  useSocketEvent('alert:new', onAlertNew)
  useSocketEvent('alert:update', onAlertUpdate)
  useSocketEvent('dispatch:new', onDispatchNew)
  useSocketEvent('demand:changed', onDemand)

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap()
    } catch {
      // Ignore network/logout errors — we clear the local session regardless.
    }
    dispatch(logout())
    navigate('/')
  }

  // ---- Klaviatura qısa yolları ----
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status !== 'resolved'), [alerts])
  const selected = activeAlerts.find((a) => a._id === selectedAlertId)
  const step = (dir) => {
    if (!activeAlerts.length) return
    const i = activeAlerts.findIndex((a) => a._id === selectedAlertId)
    const next = activeAlerts[(i + dir + activeAlerts.length) % activeAlerts.length]
    dispatch(selectAlert(next))
  }
  useKeyboardShortcuts({
    ...Object.fromEntries(navItems.map((n) => [n.key, () => navigate(n.path)])),
    j: () => step(1),
    k: () => step(-1),
    a: () => selected?.status === 'open' && act(selected, 'acknowledge'),
    d: () => selected && !selected.reserveBuses?.length && act(selected, 'dispatch'),
    r: () => selected && act(selected, 'resolve'),
    c: () => compose(selected || null),
    t: toggleTheme,
    '?': () => dispatch(setShortcutsOpen(true)),
    Escape: () => {
      if (shortcutsOpen) dispatch(setShortcutsOpen(false))
      else if (dispatchState.open) dispatch(closeDispatch())
      else if (banner) dispatch(hideBanner())
      else dispatch(selectAlert(null))
    },
  })

  const activeItem = navItems.find((item) => (item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)))
  const closeBanner = useCallback(() => dispatch(hideBanner()), [dispatch])

  return (
    <div className="flex h-screen bg-canvas">
      {/* Sidebar */}
      <motion.aside
        className="relative z-[1100] flex flex-col border-r border-line bg-surface dark:bg-deep"
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 76 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? t('panel.collapse') : t('panel.expand')}
          title={sidebarOpen ? t('panel.collapse') : t('panel.expand')}
          className="absolute -right-3.5 top-20 z-10 grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-ink-soft shadow-card transition-colors hover:text-ink"
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex h-16 items-center px-4">
          <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand">
              <BusFront className="h-5 w-5" />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span className="whitespace-nowrap leading-tight" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}>
                  <strong className="block font-black text-ink">{t('common:app.name')}</strong>
                  <span className="text-xs font-semibold text-ink-soft">{t('panel.title')}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-hidden p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              title={`${t(`nav.${item.id}`)} (${item.key})`}
              className={({ isActive }) =>
                `relative flex h-11 items-center gap-3 rounded-full px-3.5 transition-colors ${isActive ? 'bg-brand text-on-brand' : 'text-ink-soft hover:bg-raised hover:text-ink'}`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span
                    className="flex-1 whitespace-nowrap text-sm font-bold"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {t(`nav.${item.id}`)}
                  </motion.span>
                )}
              </AnimatePresence>
              {item.badge && activeAlerts.length > 0 && (
                <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-black text-white dark:text-black ${sidebarOpen ? '' : 'absolute -right-0.5 -top-0.5'}`}>
                  {activeAlerts.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-line p-3">
          <Link to="/" title={t('panel.openPassenger')} className="flex h-11 w-full items-center gap-3 rounded-full px-3.5 text-ink-soft transition-colors hover:bg-raised hover:text-ink">
            <Smartphone className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span className="whitespace-nowrap text-sm font-bold">{t('panel.openPassenger')}</span>}
          </Link>
          <button
            onClick={() => dispatch(setShortcutsOpen(true))}
            title={`${t('panel.shortcuts')} (?)`}
            className="flex h-11 w-full items-center gap-3 rounded-full px-3.5 text-ink-soft transition-colors hover:bg-raised hover:text-ink"
          >
            <Keyboard className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span className="whitespace-nowrap text-sm font-bold">{t('panel.shortcuts')} (?)</span>}
          </button>
          <button
            onClick={handleLogout}
            title={t('panel.logout')}
            className="flex h-11 w-full items-center gap-3 rounded-full px-3.5 text-danger transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span className="whitespace-nowrap text-sm font-bold">{t('panel.logout')}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1000] flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2 md:px-6 dark:bg-canvas">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-xl font-black tracking-tight text-ink">{activeItem ? t(`nav.${activeItem.id}`) : t('panel.title')}</h2>
            <LiveIndicator connected={isConnected} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span title={ai?.enabled ? undefined : t('panel.aiRulesHint')}>
              <Badge variant={ai?.enabled ? 'purple' : 'default'} size="sm">
                <Sparkles className="h-3 w-3" />
                {ai?.enabled ? t('panel.aiOn') : t('panel.aiRules')}
              </Badge>
            </span>
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="flex items-center gap-2.5 pl-1">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-black text-on-brand">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="hidden text-right lg:block">
                <p className="text-sm font-bold text-ink">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-ink-soft">{t(`panel.role.${user?.role === 'admin' ? 'admin' : 'operator'}`)}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <AlertBanner
        alert={banner}
        onClose={closeBanner}
        onView={(a) => {
          dispatch(selectAlert(a))
          dispatch(hideBanner())
          navigate('/dashboard')
        }}
        onDispatch={(a) => {
          act(a, 'dispatch')
          dispatch(selectAlert(a))
          dispatch(hideBanner())
        }}
      />
      {dispatchState.open && <DispatchModal key={`${dispatchState.routeId}:${dispatchState.alertId}`} state={dispatchState} routes={routes} onClose={() => dispatch(closeDispatch())} />}
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => dispatch(setShortcutsOpen(false))} />
    </div>
  )
}
