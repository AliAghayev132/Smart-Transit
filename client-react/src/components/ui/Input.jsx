import { clsx } from 'clsx'
import { fieldClass } from './fieldClass'

export const FieldLabel = ({ children, htmlFor }) =>
  children ? (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-ink-soft">
      {children}
    </label>
  ) : null

export const FieldHint = ({ error, helperText }) =>
  error || helperText ? <p className={clsx('mt-1.5 text-sm', error ? 'text-danger' : 'text-ink-soft')}>{error || helperText}</p> : null

export const Input = ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }) => (
  <div className="w-full">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <div className="relative">
      {leftIcon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">{leftIcon}</div>}
      <input id={id} className={clsx(fieldClass(error), leftIcon && 'pl-11', rightIcon && 'pr-11', className)} {...props} />
      {rightIcon && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint">{rightIcon}</div>}
    </div>
    <FieldHint error={error} helperText={helperText} />
  </div>
)
