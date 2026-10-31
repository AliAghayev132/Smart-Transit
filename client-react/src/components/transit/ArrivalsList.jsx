/** Dayanacağa gələn avtobuslar (ETA + sıxlıq + canlı istifadəçilər) */
import { clsx } from 'clsx'
import { Badge } from '@components/ui'
import { fmtDist, fmtEta, fmtAgo } from '@utils'
import { CrowdBadge, RouteNum } from './CrowdBadge'

export const ArrivalsList = ({ route, eta }) => (
  <div className="mt-3 space-y-2">
    <div className="flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-slate-100">
      <span>Gələn avtobuslar</span>
      <small className="font-normal text-gray-400">{eta ? `yeniləndi ${fmtAgo(eta.generatedAt)}` : 'yüklənir…'}</small>
    </div>
    {eta?.stop.liveWaiting > 0 && (
      <p className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
        📍 İndi bu dayanacaqda {eta.stop.liveWaiting} istifadəçi gözləyir (canlı lokasiya)
      </p>
    )}
    {eta?.arrivals.length === 0 && <p className="text-sm text-gray-500">Bu xətdə hazırda aktiv avtobus yoxdur.</p>}
    {eta?.arrivals.map((a, i) => (
      <div
        key={a.busId}
        className={clsx(
          'grid grid-cols-[72px_1fr_auto] items-center gap-2 rounded-xl border p-2.5',
          i === 0 ? 'border-cyan-600 bg-cyan-50/60 dark:border-cyan-500 dark:bg-cyan-500/10' : 'border-gray-200 dark:border-slate-700'
        )}
      >
        <div>
          <p className="font-mono text-lg font-bold tracking-tight text-gray-900 dark:text-slate-100">{fmtEta(a.etaSec)}</p>
          <p className="text-xs text-gray-500">{a.etaSec > 30 ? fmtDist(a.distanceM) : 'dayanacağa çatır'}</p>
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-slate-100">
            <RouteNum number={route.number} color={route.color} size="sm" /> → {a.headsign}
            {a.isReserve && <Badge variant="warning" size="sm">Ehtiyat</Badge>}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-slate-400">
            {a.plate} · {a.stopsAway === 0 ? 'aralıq dayanacaq yoxdur' : `${a.stopsAway} dayanacaq uzaqda`}
            {a.liveRiders > 0 && ` · 📍 ${a.liveRiders} istifadəçi içində`}
          </p>
        </div>
        <CrowdBadge level={a.crowd.level} size="sm" />
      </div>
    ))}
  </div>
)
