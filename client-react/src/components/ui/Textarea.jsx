import { clsx } from 'clsx'
import { fieldClass } from './fieldClass'
import { FieldHint, FieldLabel } from './Input'

export const Textarea = ({ label, error, helperText, className, rows = 4, id, ...props }) => (
  <div className="w-full">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <textarea id={id} rows={rows} className={clsx(fieldClass(error), 'resize-none', className)} {...props} />
    <FieldHint error={error} helperText={helperText} />
  </div>
)
