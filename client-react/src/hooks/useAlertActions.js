import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useAlertActionMutation } from '@store/api'
import { openDispatch } from '@store/slices/operatorSlice'
import { toast } from '@utils'

/**
 * Xəbərdarlıq əməliyyatları (kartlar, banner, qısa yollar eyni məntiqi paylaşır).
 *  act(alert, 'acknowledge' | 'dispatch' | 'resolve')
 *  compose(alert | { route })  → dispetçer əmri pəncərəsi
 */
export const useAlertActions = () => {
  const { t } = useTranslation('operator')
  const dispatch = useDispatch()
  const [alertAction, { isLoading }] = useAlertActionMutation()

  const act = useCallback(
    async (alert, action) => {
      if (!alert) return
      try {
        const res = await alertAction({ id: alert._id, action, count: action === 'dispatch' ? alert.recommendation?.recommendedBuses || 1 : undefined }).unwrap()
        toast.success(res?.message || t(`alert.toast.${action}`))
      } catch (err) {
        toast.error(err?.data?.message || t('common:status.actionFailed'))
      }
    },
    [alertAction, t]
  )

  const compose = useCallback(
    (target) => {
      const routeId = target?.route?._id || target?.route?.id || null
      const rec = target?.recommendation
      dispatch(
        openDispatch({
          routeId,
          alertId: target?._id || null,
          type: 'RESERVE_RELEASE',
          params: { count: rec?.recommendedBuses || 1, stop: rec?.suggestedStop?.name },
        })
      )
    },
    [dispatch]
  )

  return { act, compose, busy: isLoading }
}

export default useAlertActions
