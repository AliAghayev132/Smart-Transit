import { clsx } from 'clsx'

export const Radio = ({
  label,
  checked,
  onChange,
  disabled = false,
  name,
  value,
  className,
  ...props
}) => {
  return (
    <label
      className={clsx(
        'flex items-center gap-2 cursor-pointer',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-[18px] w-[18px] shrink-0 accent-[var(--color-brand)]"
        {...props}
      />
      {label && <span className="text-sm text-ink-soft">{label}</span>}
    </label>
  )
}

const RadioGroup = ({ children, label, className }) => (
  <div className={className}>
    {label && <p className="text-sm font-medium text-ink-soft mb-2">{label}</p>}
    <div className="space-y-2">{children}</div>
  </div>
)

Radio.Group = RadioGroup
