/** «GO» / «Gedirəm» — səfəri təsdiqləyir (Yanaşma A: operatorlar tələbi əvvəlcədən görür) */
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'

export const GoButton = ({ confirmed, busy, onGo, onCancel, className }) => {
  const { t } = useTranslation('passenger')
  if (confirmed) {
    return (
      <div className={clsx('flex items-center gap-1 rounded-[20px] bg-go-soft p-1.5 pl-4 text-go shadow-float', className)}>
        <Check className="h-5 w-5" aria-hidden />
        <span className="text-base font-black">{t('trip.onYourWay')}</span>
        <button
          onClick={onCancel}
          title={t('trip.cancelGo')}
          aria-label={t('trip.cancelGo')}
          className="ml-1 grid h-8 w-8 place-items-center rounded-full text-go hover:bg-go/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }
  return (
    <button
      onClick={onGo}
      disabled={busy}
      title={t('trip.goHint')}
      className={clsx(
        'go-btn h-14 rounded-[20px] bg-go px-6 text-[28px] leading-none text-on-go shadow-float transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60',
        className
      )}
    >
      {t('trip.go')}
    </button>
  )
}
