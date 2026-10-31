import { useNavigate } from 'react-router'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { MapPinned, PenLine } from 'lucide-react'

import { SEO, Card, Table, Button, CrowdBadge, RouteNum, PageLoader } from '@components'
import { useGetRoutesQuery, useGetForecastAllQuery, useGetDemandStopsQuery, useGetAlertsQuery } from '@store/api'
import { useTransitLive } from '@store/hooks'
import { selectRoute } from '@store/slices/operatorSlice'
import { useAlertActions } from '@hooks'
import { crowdLevels } from '@constants'
import { fmtAgo } from '@utils'

/** Xətlər siyahısı: cari sıxlıq, trend, avtobuslar, canlı (B), tələb (A), 3 saatlıq proqnoz */
export const RoutesPage = () => {
  const { t } = useTranslation('operator')
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const live = useTransitLive()
  const { data: routes = [], isLoading } = useGetRoutesQuery()
  const { data: forecasts = [] } = useGetForecastAllQuery(undefined, { pollingInterval: 300000 })
  const { data: demand } = useGetDemandStopsQuery(undefined, { pollingInterval: 30000 })
  const { data: alerts = [] } = useGetAlertsQuery({ status: 'active' })
  const { compose } = useAlertActions()

  if (isLoading) return <PageLoader />

  const rows = routes.map((r) => {
    const c = live.crowd?.routes.find((x) => x.routeId === r.id)
    const buses = live.buses.filter((b) => b.routeId === r.id)
    return {
      route: r,
      crowd: c,
      buses: buses.length,
      reserves: buses.filter((b) => b.isReserve).length,
      riders: (live.density?.buses || []).filter((b) => b.routeId === r.id).reduce((s, b) => s + b.riders, 0),
      intents: (demand?.stops || []).filter((s) => s.routeId === r.id).reduce((s, x) => s + x.confirmed, 0),
      forecast: forecasts.find((f) => f.routeId === r.id),
      alerts: alerts.filter((a) => a.route?._id === r.id).length,
    }
  })

  return (
    <div className="space-y-4 p-4 md:p-6">
      <SEO title={t('nav.routes')} noindex />
      <Card padding="none" className="overflow-hidden">
        <Table>
          <Table.Header>
            <Table.Row hoverable={false}>
              <Table.Head className="px-3 hyphens-none">{t('routes.col.route')}</Table.Head>
              <Table.Head className="px-3 hyphens-none">{t('routes.col.crowd')}</Table.Head>
              <Table.Head className="px-3 hyphens-none">{t('routes.col.reports')}</Table.Head>
              <Table.Head className="px-3 hyphens-none">{t('routes.col.buses')}</Table.Head>
              <Table.Head className="px-3 hyphens-none">{t('routes.col.live')}</Table.Head>
              <Table.Head className="px-3 hyphens-none">{t('routes.col.intents')}</Table.Head>
              <Table.Head className="px-3 hyphens-none">{t('routes.col.forecast')}</Table.Head>
              <Table.Head align="right" className="px-3">{t('routes.col.actions')}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map(({ route, crowd, buses, reserves, riders, intents, forecast, alerts: n }) => (
              <Table.Row key={route.id}>
                <Table.Cell className="min-w-44 px-3">
                  <div className="flex items-center gap-2.5">
                    <RouteNum number={route.number} color={route.color} size="lg" />
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{route.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-ink-soft">
                        <span>{t('context.stops', { count: route.stops.length })}</span>
                        <span className="text-ink-faint">{t('common:dist.km', { n: route.lengthKm })}</span>
                        {n > 0 && <span className="font-bold text-danger">{t('routes.activeAlerts', { count: n })}</span>}
                      </div>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell className="px-3">
                  <div className="space-y-1.5">
                    <CrowdBadge level={crowd?.level} size="sm" pct={crowd?.loadPct} />
                    <div className="flex w-28 gap-0.5">
                      {(crowd?.segments || []).map((s) => (
                        <span
                          key={s.index}
                          className="h-1.5 flex-1 rounded-full"
                          style={{ background: (crowdLevels[s.level] || crowdLevels.unknown).color, opacity: s.level === 'unknown' ? 0.3 : 1 }}
                        />
                      ))}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell className="min-w-32 px-3 [&_p]:hyphens-none">
                  <p className="text-sm font-bold text-ink">
                    {crowd?.total || 0} <span className="text-xs font-semibold text-ink-faint">{t('routes.gps', { count: crowd?.verified || 0 })}</span>
                  </p>
                  {crowd?.total ? (
                    <p className="text-xs text-ink-soft">
                      {t(`common:trend.${crowd.trend}`)}, {fmtAgo(crowd.lastReportAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-faint">—</p>
                  )}
                </Table.Cell>
                <Table.Cell className="px-3">
                  <span className="whitespace-nowrap text-sm font-bold text-ink">
                    {buses}
                    {reserves ? <span className="ml-1 text-xs font-bold text-warn">{t('routes.reserves', { count: reserves })}</span> : null}
                  </span>
                </Table.Cell>
                <Table.Cell className="px-3">
                  <span className="text-sm font-bold text-ink">{riders}</span>
                </Table.Cell>
                <Table.Cell className="px-3">
                  <span className="text-sm font-bold text-ink">{intents}</span>
                </Table.Cell>
                <Table.Cell className="px-3">
                  <div className="flex flex-wrap gap-1">
                    {(forecast?.points || []).slice(1, 4).map((p) => {
                      const c = (crowdLevels[p.level] || crowdLevels.unknown).color
                      return (
                        <span
                          key={p.at}
                          title={t('routes.confidence', { pct: Math.round(p.confidence * 100) })}
                          className="whitespace-nowrap rounded-lg px-1.5 py-0.5 text-[11px] font-bold"
                          style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}
                        >
                          {String(p.hour).padStart(2, '0')}:00 {t(`common:crowd.${p.level}.label`)}
                        </span>
                      )
                    })}
                  </div>
                </Table.Cell>
                <Table.Cell align="right" className="px-3">
                  <div className="flex justify-end gap-1.5">
                    {/* Dar ekranda yalnız ikon (etiket title/aria-label-də) */}
                    <Button
                      size="sm"
                      variant="secondary"
                      title={t('routes.map')}
                      aria-label={t('routes.map')}
                      className="px-2.5 2xl:px-3.5"
                      leftIcon={<MapPinned className="h-4 w-4" />}
                      onClick={() => {
                        dispatch(selectRoute(route.id))
                        navigate('/dashboard')
                      }}
                    >
                      <span className="hidden 2xl:inline">{t('routes.map')}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={t('routes.command')}
                      aria-label={t('routes.command')}
                      className="px-2.5 2xl:px-3.5"
                      leftIcon={<PenLine className="h-4 w-4" />}
                      onClick={() => compose({ route })}
                    >
                      <span className="hidden 2xl:inline">{t('routes.command')}</span>
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>
      <p className="max-w-3xl text-xs text-ink-faint">{t('routes.forecastNote')}</p>
    </div>
  )
}
