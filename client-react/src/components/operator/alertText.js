/**
 * Server strukturlu data → tərcümə olunmuş mətn (operator modulu).
 *  - tövsiyə səbəbləri: { code, params } → t(`reco.reason.${code}`)
 *  - xəbərdarlıq başlığı / statistikası: type + stats + route
 *  - tarixçə qeydi: { noteKey, noteParams } → t(`alert.note.${noteKey}`), əks halda sərbəst `note`
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

// Hər səbəb kodunda cəm formasını hansı parametr müəyyən edir
const COUNT_PARAM = {
  reserves_on_line: 'count',
  crowd_live: 'total',
  demand_intents: 'intents',
  live_riders: 'riders',
  limit_max: 'max',
}

export const useAlertText = () => {
  const { t } = useTranslation('operator')

  const reason = useCallback(
    (r) => {
      if (!r) return ''
      if (typeof r === 'string') return r // köhnə data: hazır mətn
      const p = { ...(r.params || {}) }
      if (p.level) p.level = t(`common:crowd.${p.level}.label`, { defaultValue: p.level })
      const cp = COUNT_PARAM[r.code]
      if (cp && p[cp] != null) p.count = p[cp]
      return t(`reco.reason.${r.code}`, { ...p, defaultValue: r.code })
    },
    [t]
  )

  const title = useCallback((a) => t(`alert.title.${a?.type || 'RESERVE_BUS_NEEDED'}`, { defaultValue: a?.message || '' }), [t])

  const heading = useCallback(
    (a) => t(`alert.banner.${a?.type || 'RESERVE_BUS_NEEDED'}`, { number: a?.route?.number ?? '—' }),
    [t]
  )

  const stats = useCallback(
    (a) => {
      const s = a?.stats || {}
      if (a?.type === 'DEMAND_FORECAST') {
        return t('alert.statsDemand', { count: s.confirmedIntents ?? 0, window: s.windowMin ?? 30, stop: s.topStop || '—' })
      }
      return t('alert.statsHigh', { count: s.highReports ?? 0, window: s.windowMin ?? 10, pct: Math.round((s.highRatio || 0) * 100) })
    },
    [t]
  )

  const note = useCallback(
    (h) => {
      if (!h?.noteKey) return h?.note || ''
      const p = { ...(h.noteParams || {}) }
      if (h.noteKey === 'command') p.template = t(`dispatch.types.${p.type}`, { defaultValue: p.type || '' })
      return t(`alert.note.${h.noteKey}`, { ...p, defaultValue: h.note || '' })
    },
    [t]
  )

  return useMemo(() => ({ reason, title, heading, stats, note }), [reason, title, heading, stats, note])
}

/**
 * Dil dəyişəndə serverdən gələn mətni (AI xülasəsi, şablonlar) yenidən istə.
 * RTK keş açarında dil yoxdur — Accept-Language başlığı isə yeni dili göndərir.
 */
export const useRefetchOnLanguage = (refetch, enabled = true) => {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const seen = useRef(lang)
  useEffect(() => {
    if (!enabled || seen.current === lang) return
    seen.current = lang
    refetch?.()
  }, [lang, enabled, refetch])
}
