/** Crowdsourcing (Six-O): «Avtobus nə qədər doludur?» — bir toxunuşla Az / Orta / Yüksək */
import { useState } from 'react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@components/ui'
import { useCreateReportMutation } from '@store/api'
import { getPosition } from '@services'
import { getDeviceId, fmtEta } from '@utils'
import { crowdLevels, crowdLevelKeys } from '@constants'
import { CrowdDots } from './CrowdBadge'

const NONE = 'none'

export const ReportCard = ({ route, stop, arrivals = [], buses = [] }) => {
  const { t } = useTranslation('passenger')
  const [picked, setPicked] = useState(null)
  const [useGps, setUseGps] = useState(true)
  const [sending, setSending] = useState(null)
  const [result, setResult] = useState(null)
  const [createReport] = useCreateReportMutation()

  // Xətt dəyişəndə seçimi və nəticəni sıfırla (render zamanı — effektsiz)
  const [prevRoute, setPrevRoute] = useState(route.id)
  if (route.id !== prevRoute) {
    setPrevRoute(route.id)
    setPicked(null)
    setResult(null)
  }

  // Default: dayanacağa ən yaxın gələn avtobus
  const options = arrivals.slice(0, 3)
  const known = (id) => options.some((a) => a.busId === id) || buses.some((b) => b.id === id)
  const busId = picked === NONE ? '' : picked && known(picked) ? picked : options[0]?.busId || ''

  const send = async (level) => {
    setSending(level)
    setResult(null)
    try {
      const pos = useGps ? await getPosition() : null
      const res = await createReport({ routeId: route.id, busId: busId || undefined, stopId: stop?.id, level, lat: pos?.lat, lng: pos?.lng, deviceId: getDeviceId() }).unwrap()
      setResult({ ok: true, text: res.message, gpsMissing: useGps && !pos })
    } catch (err) {
      setResult({ ok: false, text: err?.data?.message || t('common:status.notSent') })
    } finally {
      setSending(null)
    }
  }

  const chip = (active) =>
    clsx('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-extrabold transition-colors', active ? 'bg-ink text-canvas' : 'bg-raised text-ink-soft hover:text-ink')

  return (
    <section className="rounded-card bg-surface p-5 shadow-card">
      <h3 className="text-title">{t('report.title')}</h3>
      <p className="mt-1 text-sm font-semibold text-ink-soft">{t('report.subtitle')}</p>

      <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={t('report.whichBus')}>
        {options.map((a) => (
          <button key={a.busId} role="radio" aria-checked={busId === a.busId} onClick={() => setPicked(a.busId)} className={chip(busId === a.busId)}>
            <span className="tabular-nums">{fmtEta(a.etaSec)}</span>
            <span className="font-semibold opacity-75">{a.plate}</span>
          </button>
        ))}
        <button role="radio" aria-checked={!busId} onClick={() => setPicked(NONE)} className={chip(!busId)}>
          {t('report.unknownBus')}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {crowdLevelKeys.map((l) => {
          const c = crowdLevels[l].color
          return (
            <button
              key={l}
              disabled={!!sending}
              onClick={() => send(l)}
              className="relative flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[20px] border-2 px-2 py-3 text-center transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60"
              style={{ borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} 10%, var(--color-surface))` }}
            >
              <CrowdDots level={l} size="lg" />
              <strong className="text-sm font-black leading-tight text-ink hyphens-none">{t(`common:crowd.${l}.hint`)}</strong>
              <small className="text-xs font-bold" style={{ color: c }}>
                {t(`common:crowd.${l}.label`)}
              </small>
              {sending === l && <span className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent text-ink-soft" />}
            </button>
          )
        })}
      </div>

      <Checkbox className="mt-4" checked={useGps} onChange={(e) => setUseGps(e.target.checked)} label={t('report.useGps')} />

      {result && (
        <div
          role="status"
          className={clsx(
            'mt-3 rounded-2xl p-3 text-sm font-bold',
            result.ok ? 'bg-go-soft text-go' : 'bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-surface))] text-danger'
          )}
        >
          {result.text}
          {result.gpsMissing && <div className="mt-0.5 font-semibold">{t('report.gpsMissing')}</div>}
        </div>
      )}
    </section>
  )
}
