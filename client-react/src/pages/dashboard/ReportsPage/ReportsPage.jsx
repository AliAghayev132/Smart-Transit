import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MessageSquareText, AlertTriangle, BusFront, Send } from 'lucide-react'
import { clsx } from 'clsx'

import { SEO, Card, StatCard, Table, Badge, RouteNum, PageLoader } from '@components'
import { useGetTimeseriesQuery, useGetRoutesQuery, useGetAlertsQuery, useGetDispatchCommandsQuery } from '@store/api'
import { useTransitLive } from '@store/hooks'
import { useTheme } from '@store/context'
import { useCrowdHex } from '@hooks'
import { crowdLevelKeys } from '@constants'
import { fmtTime, formatDateTime } from '@utils'

const RANGES = [
  { hours: 3, bucket: 10, key: 'h3' },
  { hours: 6, bucket: 15, key: 'h6' },
  { hours: 24, bucket: 60, key: 'h24' },
]

/** Hesabatlar: crowdsourcing həcmi, səviyyələr, xətlər üzrə paylanma, dispetçer jurnalı */
export const ReportsPage = () => {
  const { t } = useTranslation('operator')
  const hex = useCrowdHex()
  const { isDark } = useTheme()
  const [range, setRange] = useState(RANGES[1])
  const live = useTransitLive()
  const { data: ts, isLoading } = useGetTimeseriesQuery({ hours: range.hours, bucket: range.bucket }, { pollingInterval: 60000 })
  const { data: routes = [] } = useGetRoutesQuery()
  const { data: alerts = [] } = useGetAlertsQuery({})
  const { data: commands = [] } = useGetDispatchCommandsQuery({ limit: 30 })

  const series = useMemo(() => (ts?.series || []).map((p) => ({ ...p, name: fmtTime(p.at) })), [ts])
  const byRoute = useMemo(
    () =>
      routes.map((r) => ({
        name: `№${r.number}`,
        ...(ts?.byRoute?.[r.id] || { low: 0, mid: 0, high: 0 }),
      })),
    [routes, ts]
  )
  const reserves = live.buses.filter((b) => b.isReserve).length
  const activeAlerts = alerts.filter((a) => a.status !== 'resolved').length

  if (isLoading) return <PageLoader />

  const axis = isDark ? '#85858f' : '#7d838c'
  const grid = isDark ? '#2f2f34' : '#e2e5e9'
  const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: 'var(--color-ink)' }
  const order = (i) => crowdLevelKeys.indexOf(i.dataKey)
  const bars = crowdLevelKeys.map((l) => <Bar key={l} dataKey={l} name={t(`common:crowd.${l}.label`)} stackId="a" fill={hex[l]} />)

  return (
    <div className="space-y-6 p-4 md:p-6">
      <SEO title={t('nav.reports')} noindex />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-soft">{t('reports.subtitle', { range: t(`reports.range.${range.key}`) })}</p>
        <div className="flex rounded-full bg-raised p-1" role="tablist">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              role="tab"
              aria-selected={range.hours === r.hours}
              onClick={() => setRange(r)}
              className={clsx('h-8 rounded-full px-3.5 text-sm font-bold transition-colors', range.hours === r.hours ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink')}
            >
              {t(`reports.range.${r.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t('reports.kpi.reports')} value={ts?.total ?? 0} icon={<MessageSquareText className="h-5 w-5" />} />
        <StatCard title={t('reports.kpi.activeAlerts')} value={activeAlerts} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title={t('reports.kpi.reserves')} value={reserves} icon={<BusFront className="h-5 w-5" />} />
        <StatCard title={t('reports.kpi.commands')} value={commands.length} icon={<Send className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Card.Title>{t('reports.overTime')}</Card.Title>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: axis }} stroke={axis} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axis }} stroke={axis} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: grid, opacity: 0.4 }} itemSorter={order} />
                <Legend itemSorter={order} />
                {bars}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <Card.Title>{t('reports.byRoute')}</Card.Title>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRoute} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: axis }} stroke={axis} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: axis }} stroke={axis} width={44} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: grid, opacity: 0.4 }} itemSorter={order} />
                {bars}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="p-5 pb-3">
          <Card.Title>{t('reports.log')}</Card.Title>
        </div>
        <Table>
          <Table.Header>
            <Table.Row hoverable={false}>
              <Table.Head>{t('reports.col.time')}</Table.Head>
              <Table.Head>{t('reports.col.route')}</Table.Head>
              <Table.Head>{t('reports.col.command')}</Table.Head>
              <Table.Head>{t('reports.col.source')}</Table.Head>
              <Table.Head>{t('reports.col.operator')}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {!commands.length && (
              <Table.Row hoverable={false}>
                <Table.Cell className="text-ink-faint">{t('reports.noCommands')}</Table.Cell>
              </Table.Row>
            )}
            {commands.map((c) => (
              <Table.Row key={c._id}>
                <Table.Cell className="whitespace-nowrap text-xs text-ink-soft">{formatDateTime(c.createdAt)}</Table.Cell>
                <Table.Cell>{c.route && <RouteNum number={c.route.number} color={c.route.color} size="sm" />}</Table.Cell>
                <Table.Cell className="max-w-xl">{c.text}</Table.Cell>
                <Table.Cell>
                  <Badge size="sm" variant={c.source === 'ai' ? 'purple' : 'default'}>
                    {t(`alert.source.${c.source === 'ai' ? 'ai' : 'manual'}`)}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="text-xs text-ink-soft">{c.issuedBy ? `${c.issuedBy.firstName} ${c.issuedBy.lastName}` : '—'}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>
    </div>
  )
}
