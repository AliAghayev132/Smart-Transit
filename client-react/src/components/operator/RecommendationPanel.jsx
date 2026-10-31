import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BusFront, Sparkles, Wand2 } from 'lucide-react'
import { Button, Textarea, Badge } from '@components/ui'
import { useGetDispatchRecommendationQuery, useLazyGetDispatchAdviceQuery, useCreateDispatchCommandMutation } from '@store/api'
import { toast } from '@utils'
import { useAlertText, useRefetchOnLanguage } from './alertText'

const Kpi = ({ label, value }) => (
  <div className="min-w-0 rounded-2xl bg-raised px-2 py-2.5 text-center">
    <p className="whitespace-nowrap text-lg font-black leading-none tracking-tight text-ink">{value}</p>
    <p className="mt-1 text-[11px] font-semibold leading-tight text-ink-soft">{label}</p>
  </div>
)

/**
 * Smart Dispatcher Assistant: deterministik tövsiyə (neçə avtobus) + AI izahı + hazır əmr.
 * Operator mətni redaktə edib bir kliklə təsdiqləyir.
 */
export const RecommendationPanel = ({ routeId, alertId }) => {
  const { t } = useTranslation('operator')
  const text = useAlertText()
  const { data, isFetching } = useGetDispatchRecommendationQuery(routeId, { skip: !routeId, pollingInterval: 60000 })
  const [getAdvice, { data: advice, isFetching: adviceLoading }] = useLazyGetDispatchAdviceQuery()
  const [createCommand, { isLoading: sending }] = useCreateDispatchCommandMutation()
  const [draft, setDraft] = useState(null)
  const rec = advice?.recommendation || data?.recommendation

  // Dil dəyişəndə AI izahını və əmr mətnini yeni dildə yenidən istə
  useRefetchOnLanguage(() => {
    if (!advice) return
    setDraft(null)
    getAdvice(routeId)
  })

  const confirm = async () => {
    try {
      const cmd = advice?.command
      await createCommand({
        routeId,
        alertId,
        type: cmd?.type || 'RESERVE_RELEASE',
        params: cmd?.params || { count: rec?.recommendedBuses || 1, stop: rec?.suggestedStop?.name },
        text: draft ?? cmd?.text,
        source: advice?.source === 'ai' ? 'ai' : 'manual',
      }).unwrap()
      toast.success(t('reco.sent'))
      setDraft(null)
    } catch (err) {
      toast.error(err?.data?.message || t('reco.notSent'))
    }
  }

  if (!rec) return isFetching ? <p className="text-sm text-ink-faint">{t('reco.computing')}</p> : null

  const reasons = advice ? [advice.rationale] : rec.reasons || []

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Wand2 className="h-4 w-4 text-brand" /> {t('reco.title')}
        </span>
        <Badge size="sm" variant="primary">
          {t('reco.confidence', { pct: Math.round((rec.confidence || 0) * 100) })}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Kpi label={t('reco.extraBuses')} value={rec.recommendedBuses} />
        <Kpi label={t('reco.headway')} value={`${rec.headwayNowMin ?? '—'}→${rec.headwayAfterMin ?? '—'}`} />
        <Kpi label={t('reco.load')} value={`${rec.loadNowPct}→${rec.loadAfterPct}%`} />
      </div>
      <ul className="space-y-1 text-xs leading-relaxed text-ink-soft">
        {reasons.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            <span className="min-w-0">{text.reason(r)}</span>
          </li>
        ))}
      </ul>

      {!advice ? (
        <Button size="sm" variant="outline" fullWidth leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => getAdvice(routeId)} disabled={adviceLoading}>
          {adviceLoading ? t('reco.preparing') : t('reco.explain')}
        </Button>
      ) : (
        <>
          <Textarea rows={3} value={draft ?? advice.command.text} onChange={(e) => setDraft(e.target.value)} aria-label={t('dispatch.text')} />
          <Button size="md" fullWidth leftIcon={<BusFront className="h-4 w-4" />} onClick={confirm} disabled={sending || !rec.recommendedBuses}>
            {rec.recommendedBuses ? t('reco.confirmN', { count: rec.recommendedBuses }) : t('reco.notNeeded')}
          </Button>
          <p className="text-right text-[11px] text-ink-faint">{advice.source === 'ai' ? t('reco.sourceAi', { model: advice.model }) : t('reco.sourceRules')}</p>
        </>
      )}
    </div>
  )
}
