/** Ana ekran: xətlər — iri nömrə bloku, ad, sıxlıq və xəttdəki avtobus sayı */
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { routeShade } from '@utils'
import { CrowdBadge } from './CrowdBadge'

export const RouteList = ({ routes = [], crowd, buses = [], onOpen }) => {
  const { t } = useTranslation('passenger')
  return (
    <ul className="space-y-2.5">
      {routes.map((r) => {
        const c = crowd?.routes.find((x) => x.routeId === r.id)
        const n = buses.filter((b) => b.routeId === r.id).length
        return (
          <li key={r.id}>
            <button onClick={() => onOpen(r)} className="flex w-full items-center gap-4 rounded-card bg-surface p-3 pr-4 text-left shadow-card transition-colors hover:bg-raised">
              <span className="grid h-16 min-w-16 shrink-0 place-items-center rounded-[18px] px-2 text-[28px] font-black text-white" style={{ background: routeShade(r.color) }}>
                {r.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold leading-snug">{r.name}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <CrowdBadge level={c?.level} pct={c?.loadPct} size="sm" />
                  <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-bold text-ink-soft">{t('route.busesOnLine', { count: n })}</span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
