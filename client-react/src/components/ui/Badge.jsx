import { clsx } from 'clsx'

// Yumşaq fon + tünd mətn — hər iki rejimdə token rəngləri ilə
const variants = {
  default: 'bg-raised text-ink-soft',
  primary: 'bg-brand-soft text-brand',
  success: 'bg-[color-mix(in_srgb,var(--color-ok)_16%,transparent)] text-ok',
  warning: 'bg-[color-mix(in_srgb,var(--color-warn)_18%,transparent)] text-warn',
  danger: 'bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-danger',
  info: 'bg-brand-soft text-brand',
  go: 'bg-go-soft text-go',
  purple: 'bg-[color-mix(in_srgb,#7c3aed_16%,transparent)] text-[#6d28d9] dark:text-[#c4b5fd]',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export const Badge = ({ children, variant = 'default', size = 'md', className }) => (
  <span className={clsx('inline-flex items-center gap-1 rounded-full font-bold', variants[variant], sizes[size], className)}>{children}</span>
)
