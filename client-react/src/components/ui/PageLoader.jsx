import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

const dots = [0, 1, 2]

export const PageLoader = ({ message }) => {
  const { t } = useTranslation()
  return (
    <div className="flex h-64 select-none flex-col items-center justify-center" role="status">
      <div className="mb-4 flex items-center gap-1.5">
        {dots.map((i) => (
          <motion.div
            key={i}
            className="h-3 w-3 rounded-full bg-brand"
            animate={{ scale: [1, 1.35, 1], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <p className="text-sm font-semibold text-ink-soft">{message || t('status.loading')}</p>
    </div>
  )
}
