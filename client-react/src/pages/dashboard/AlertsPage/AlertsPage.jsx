import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'

import { SEO, Card, AlertCard, RecommendationPanel, CrowdBadge, PageLoader, RouteNum, Badge } from '@components'
import { useAlertText } from '@components/operator/alertText'
import { useGetAlertsQuery, useGetAlertQuery } from '@store/api'
import { selectAlert } from '@store/slices/operatorSlice'
import { useAlertActions } from '@hooks'
import { alertStatusOptions, alertTypeOptions } from '@constants'
import { formatDateTime } from '@utils'

const STATUS_TABS = ['active', 'resolved', '']

const SectionTitle = ({ children }) => <h3 className="mb-2 text-sm font-extrabold text-ink">{children}</h3>

/** Anomaliyalar: filtrlər + siyahı (J/K ilə naviqasiya) + seçilmiş xəbərdarlığın tarixçəsi və əmrləri */
export const AlertsPage = () => {
  const { t } = useTranslation('operator')
  const text = useAlertText()
  const dispatch = useDispatch()
  const { selectedAlertId } = useSelector((s) => s.operator)
  const [status, setStatus] = useState('active')
  const [type, setType] = useState('')
  const { data: alerts = [], isLoading } = useGetAlertsQuery(status ? { status } : {})
  const { data: detail } = useGetAlertQuery(selectedAlertId, { skip: !selectedAlertId })
  const { act, compose, busy } = useAlertActions()

  const list = useMemo(() => alerts.filter((a) => !type || a.type === type), [alerts, type])
  const selected = detail?.alert

  return (
    <div className="grid h-full min-h-0 gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <SEO title={t('nav.alerts')} noindex />
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-raised p-1" role="tablist">
            {STATUS_TABS.map((k) => (
              <button
                key={k || 'all'}
                role="tab"
                aria-selected={status === k}
                onClick={() => setStatus(k)}
                className={clsx('h-8 rounded-full px-3.5 text-sm font-bold transition-colors', status === k ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink')}
              >
                {t(`alert.filter.${k || 'all'}`)}
              </button>
            ))}
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label={t('alert.filter.type')}
            className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/20"
          >
            <option value="">{t('alert.filter.allTypes')}</option>
            {Object.keys(alertTypeOptions).map((k) => (
              <option key={k} value={k}>
                {t(`alert.type.${k}`)}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs font-semibold text-ink-faint">{t('alert.keysHint')}</span>
        </div>

        {isLoading ? (
          <PageLoader />
        ) : (
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {!list.length && (
              <Card padding="sm" className="text-sm text-ink-soft">
                {t('alert.empty')}
              </Card>
            )}
            {list.map((a) => (
              <AlertCard key={a._id} alert={a} selected={a._id === selectedAlertId} onSelect={(x) => dispatch(selectAlert(x))} onAct={act} onCompose={compose} busy={busy} />
            ))}
          </div>
        )}
      </div>

      <Card padding="md" className="min-h-0 space-y-4 overflow-y-auto">
        {!selected ? (
          <p className="text-sm text-ink-soft">{t('alert.selectHint')}</p>
        ) : (
          <>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                {selected.route && <RouteNum number={selected.route.number} color={selected.route.color} />}
                <Badge size="sm" variant={alertStatusOptions[selected.status]?.badge}>
                  {t(`alert.status.${selected.status}`)}
                </Badge>
                <Badge size="sm" variant={alertTypeOptions[selected.type]?.badge === 'danger' ? 'default' : 'info'}>
                  {t(`alert.type.${selected.type}`)}
                </Badge>
              </div>
              <p className="mt-2 text-title text-danger hyphens-none">{text.title(selected)}</p>
              <p className="mt-1 text-sm text-ink-soft">{selected.route?.name}</p>
              <p className="mt-1 text-sm text-ink">{text.stats(selected)}</p>
            </div>

            {selected.status !== 'resolved' && <RecommendationPanel key={selected._id} routeId={selected.route?._id} alertId={selected._id} />}

            <div>
              <SectionTitle>{t('alert.history')}</SectionTitle>
              <ol className="relative space-y-3 border-l-2 border-line pl-4">
                {selected.history?.map((h, i) => (
                  <li key={i} className="text-sm">
                    <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-surface bg-brand" />
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <b className="text-ink">{t(`alert.status.${h.status}`, { defaultValue: h.status })}</b>
                      <span className="text-xs text-ink-faint">{formatDateTime(h.at)}</span>
                    </span>
                    {(h.noteKey || h.note) && <p className="text-xs text-ink-soft">{text.note(h)}</p>}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <SectionTitle>{t('alert.commands')}</SectionTitle>
              {!detail.commands?.length && <p className="text-sm text-ink-faint">{t('alert.noCommands')}</p>}
              <ul className="space-y-2">
                {detail.commands?.map((c) => (
                  <li key={c._id} className="rounded-2xl bg-raised p-3 text-sm">
                    <p className="text-ink">{c.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                      <span>{formatDateTime(c.createdAt)}</span>
                      <Badge size="sm" variant={c.source === 'ai' ? 'purple' : 'default'}>
                        {t(`alert.source.${c.source === 'ai' ? 'ai' : 'manual'}`)}
                      </Badge>
                      {c.reserveBuses?.length > 0 && (
                        <Badge size="sm" variant="warning">
                          {t('alert.reservesN', { count: c.reserveBuses.length })}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {selected.stats?.highReports != null && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <CrowdBadge level="high" size="sm" />
                {t('alert.highOfTotal', { high: selected.stats.highReports, total: selected.stats.totalReports, pct: Math.round(selected.stats.highRatio * 100) })}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
