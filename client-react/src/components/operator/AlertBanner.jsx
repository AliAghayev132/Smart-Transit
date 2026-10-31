import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, BusFront, X } from 'lucide-react'
import { RouteNum } from '@components/transit'
import { useAlertText } from './alertText'

/**
 * Yeni anomaliya üçün avtomatik banner (10 dəq ərzində "Yüksək" və ya tələb proqnozu).
 * 15 saniyədən sonra özü bağlanır; hərəkətlər: Xəritədə bax · Tövsiyəni təsdiqlə.
 */
export const AlertBanner = ({ alert, onView, onDispatch, onClose }) => {
  const { t } = useTranslation('operator')
  const text = useAlertText()

  useEffect(() => {
    if (!alert) return
    const timer = setTimeout(onClose, 15000)
    return () => clearTimeout(timer)
  }, [alert, onClose])

  const rec = alert?.recommendation
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert._id}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed left-1/2 top-4 z-[1800] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-card bg-[#c81e2a] text-white shadow-float"
          role="alert"
        >
          <div className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-extrabold">
                {alert.route && <RouteNum number={alert.route.number} color={alert.route.color} size="sm" className="ring-2 ring-white/70" />}
                <span className="min-w-0">{text.heading(alert)}</span>
              </p>
              <p className="mt-1 text-lg font-black leading-tight">{text.title(alert)}</p>
              <p className="mt-1 text-sm text-white/90">{text.stats(alert)}</p>
              {rec && (
                <p className="mt-1 text-sm font-semibold text-white/90">
                  {rec.recommendedBuses ? t('alert.reco', { count: rec.recommendedBuses }) : t('alert.recoNone')}
                  {rec.headwayNowMin != null && (
                    <span className="font-normal text-white/80"> — {t('alert.recoDetail', { hwFrom: rec.headwayNowMin, hwTo: rec.headwayAfterMin ?? '—', loadFrom: rec.loadNowPct, loadTo: rec.loadAfterPct })}</span>
                  )}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => onView(alert)} className="h-9 rounded-full bg-white/15 px-4 text-sm font-bold hover:bg-white/25">
                  {t('alert.actions.view')}
                </button>
                <button onClick={() => onDispatch(alert)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-extrabold text-[#a5121d] hover:bg-white/90">
                  <BusFront className="h-4 w-4" />
                  {rec?.recommendedBuses ? t('alert.actions.confirmRecoN', { count: rec.recommendedBuses }) : t('alert.actions.confirmReco')}
                </button>
              </div>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/15" aria-label={t('common:actions.close')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <motion.div className="h-1 bg-white/40" initial={{ width: '100%' }} animate={{ width: 0 }} transition={{ duration: 15, ease: 'linear' }} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
