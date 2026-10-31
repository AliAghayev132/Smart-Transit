import { clsx } from 'clsx'

const variants = {
  primary: 'bg-brand text-on-brand hover:brightness-110 active:brightness-95',
  go: 'bg-go text-on-go hover:brightness-110 active:brightness-95',
  secondary: 'bg-raised text-ink hover:bg-line/70',
  outline: 'border border-line text-ink hover:bg-raised',
  ghost: 'text-ink-soft hover:bg-raised hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110 dark:text-black',
  success: 'bg-ok text-white hover:brightness-110 dark:text-black',
  warning: 'bg-warn text-white hover:brightness-110 dark:text-black',
}

const sizes = {
  sm: 'h-8 px-3.5 text-sm gap-1.5',
  md: 'h-10 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={clsx(
      'inline-flex shrink-0 items-center justify-center rounded-full font-bold transition-[filter,background-color,color] disabled:cursor-not-allowed disabled:opacity-45',
      variants[variant],
      sizes[size],
      fullWidth && 'w-full',
      className
    )}
    disabled={disabled}
    {...props}
  >
    {leftIcon && <span className="shrink-0">{leftIcon}</span>}
    {children}
    {rightIcon && <span className="shrink-0">{rightIcon}</span>}
  </button>
)
