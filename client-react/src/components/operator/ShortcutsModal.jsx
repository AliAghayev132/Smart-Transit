import { useTranslation } from 'react-i18next'
import { Modal } from '@components/ui'
import { shortcuts } from '@constants'

/** Klaviatura qısa yolları (?) */
export const ShortcutsModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation('operator')
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('shortcuts.title')} size="sm">
      <ul className="divide-y divide-line">
        {shortcuts.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm text-ink">
            <span className="min-w-0">{t(`shortcuts.${s.id}`)}</span>
            <span className="flex shrink-0 gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="grid h-7 min-w-7 place-items-center rounded-lg border border-line bg-raised px-1.5 text-xs font-black text-ink">
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
