import { useTranslation } from 'react-i18next'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@components/ui'
import { useGetRouteSummaryQuery } from '@store/api'

/** Seçilmiş xətt üzrə qısa AI xülasəsi (AI açarı yoxdursa qayda əsaslı) — cari dildə */
export const AISummaryCard = ({ routeId }) => {
  const { t } = useTranslation('operator')
  const { data, isFetching, refetch, error } = useGetRouteSummaryQuery(routeId, { skip: !routeId, pollingInterval: 120000 })
  return (
    <div className="rounded-2xl bg-[color-mix(in_srgb,#7c3aed_10%,var(--color-surface))] p-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#6d28d9] dark:text-[#c4b5fd]">
          <Sparkles className="h-4 w-4" /> {t('summary.title')}
        </span>
        <span className="flex items-center gap-1.5">
          {data && (
            <Badge size="sm" variant={data.source === 'ai' ? 'purple' : 'default'}>
              {data.source === 'ai' ? t('summary.ai') : t('summary.rules')}
            </Badge>
          )}
          <button
            onClick={refetch}
            className="grid h-7 w-7 place-items-center rounded-full text-[#6d28d9] hover:bg-[color-mix(in_srgb,#7c3aed_15%,transparent)] dark:text-[#c4b5fd]"
            title={t('summary.refresh')}
            aria-label={t('summary.refresh')}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </span>
      </div>
      <p className="text-sm leading-relaxed text-ink">{error ? t('summary.failed') : data?.text || (isFetching ? t('summary.preparing') : '—')}</p>
    </div>
  )
}
