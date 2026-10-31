import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

/** Socket bağlantı göstəricisi */
export const LiveIndicator = ({ connected, className }) => {
  const { t } = useTranslation()
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-bold', connected ? 'text-go' : 'text-ink-faint', className)} role="status">
      <span className={clsx('h-2 w-2 rounded-full', connected ? 'animate-pulse bg-go' : 'bg-ink-faint')} />
      {connected ? t('status.live') : t('status.offline')}
    </span>
  )
}
