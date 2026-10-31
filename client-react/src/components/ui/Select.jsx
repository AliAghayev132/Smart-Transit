import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { fieldClass } from './fieldClass'
import { FieldHint, FieldLabel } from './Input'

export const Select = ({ label, error, helperText, options = [], placeholder, className, id, ...props }) => (
  <div className="w-full">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <div className="relative">
      <select id={id} className={clsx(fieldClass(error), 'appearance-none pr-10', className)} {...props}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
    </div>
    <FieldHint error={error} helperText={helperText} />
  </div>
)
