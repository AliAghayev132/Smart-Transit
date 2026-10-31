import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-full mx-4' }

export const Modal = ({ isOpen, onClose, title, children, size = 'md', showCloseButton = true }) => {
  const { t } = useTranslation()
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] dark:bg-black/75" onClick={onClose} />
        <div className={clsx('relative w-full rounded-sheet bg-surface text-ink shadow-float', sizes[size])}>
          <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-5">
            <h3 className="text-title">{title}</h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label={t('actions.close')}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-ink-soft transition-colors hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="px-6 pb-6 pt-2">{children}</div>
        </div>
      </div>
    </div>
  )
}

const ModalFooter = ({ children, className }) => (
  <div className={clsx('flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4', className)}>{children}</div>
)

Modal.Footer = ModalFooter
