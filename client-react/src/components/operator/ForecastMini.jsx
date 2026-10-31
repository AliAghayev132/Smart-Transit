import { useTranslation } from 'react-i18next'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGetForecastQuery } from '@store/api'
import { useCrowdHex } from '@hooks'
import { useTheme } from '@store/context'

/** Növbəti saatlar üçün sıxlıq proqnozu (1 = Az, 3 = Yüksək) */
export const ForecastMini = ({ routeId }) => {
  const { t } = useTranslation('operator')
  const hex = useCrowdHex()
  const { isDark } = useTheme()
  const { data } = useGetForecastQuery(routeId, { skip: !routeId, pollingInterval: 300000 })
  if (!data) return null
  const points = data.points.map((p) => ({ name: `${String(p.hour).padStart(2, '0')}:00`, score: p.score, level: p.level, loadPct: p.loadPct }))
  const axis = isDark ? '#85858f' : '#7d838c'
  const line = isDark ? '#3d9bff' : '#0b5fdb'
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="text-sm font-extrabold text-ink">{t('forecast.title')}</span>
        <span className="text-ink-faint">{t('forecast.basedOn', { count: data.historyReports })}</span>
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hex.high} stopOpacity={0.45} />
                <stop offset="100%" stopColor={hex.low} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: axis }} stroke={axis} />
            <YAxis domain={[1, 3]} ticks={[1, 2, 3]} tick={{ fontSize: 10, fill: axis }} stroke={axis} />
            <Tooltip
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12, color: 'var(--color-ink)' }}
              formatter={(v, n, p) => [
                `${t(`common:crowd.${p.payload.level}.label`)} (${v}${p.payload.loadPct != null ? `, ${p.payload.loadPct}%` : ''})`,
                t('forecast.tooltip'),
              ]}
            />
            <Area type="monotone" dataKey="score" stroke={line} strokeWidth={2} fill="url(#fc)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
