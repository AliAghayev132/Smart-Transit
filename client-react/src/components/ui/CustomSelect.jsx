import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

// Styled, animated select. Options can be plain strings or { value, label } objects.
export const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  icon: Icon,
  label,
  size = 'md',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedOption = options.find((opt) =>
    typeof opt === 'string' ? opt === value : opt.value === value
  )

  const displayLabel = selectedOption
    ? typeof selectedOption === 'string'
      ? selectedOption
      : selectedOption.label
    : null

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
  }

  return (
    <div className={clsx('relative', className)} ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-ink-soft mb-2">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full border rounded-2xl text-left flex items-center justify-between gap-2 transition-all bg-surface',
          isOpen
            ? 'border-brand ring-4 ring-brand/20'
            : 'border-line hover:border-ink-faint',
          sizeClasses[size]
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && <Icon className="w-4 h-4 text-ink-faint shrink-0" />}
          <span className={displayLabel ? 'text-ink' : 'text-ink-faint'}>
            {displayLabel || placeholder}
          </span>
        </span>
        <ChevronDown
          className={clsx(
            'w-4 h-4 text-ink-faint transition-transform shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute z-30 w-full mt-1.5 bg-surface border border-line rounded-2xl shadow-float overflow-hidden max-h-64 overflow-y-auto"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {options.map((opt) => {
              const optValue = typeof opt === 'string' ? opt : opt.value
              const optLabel = typeof opt === 'string' ? opt : opt.label
              const isSelected = optValue === value

              return (
                <div
                  key={optValue}
                  className={clsx(
                    'px-4 py-2.5 cursor-pointer transition-colors text-sm',
                    isSelected
                      ? 'font-bold bg-brand-soft text-brand'
                      : 'hover:bg-raised'
                  )}
                  onClick={() => {
                    onChange(optValue)
                    setIsOpen(false)
                  }}
                >
                  {optLabel}
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
