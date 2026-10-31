import { clsx } from 'clsx'

export const Checkbox = ({ label, checked, onChange, disabled = false, className, ...props }) => (
  <label className={clsx('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-50', className)}>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-md border-line accent-[var(--color-brand)]"
      {...props}
    />
    {label && <span className="text-sm text-ink-soft">{label}</span>}
  </label>
)
