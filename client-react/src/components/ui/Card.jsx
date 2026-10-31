import { clsx } from 'clsx'

const paddings = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-7' }

/** Six-O kartı: iri radius, yumşaq kölgə (qaranlıqda — nazik halqa) */
export const Card = ({ children, className, padding = 'md', shadow = 'sm', ...props }) => (
  <div className={clsx('rounded-card bg-surface text-ink', shadow !== 'none' && 'shadow-card', paddings[padding], className)} {...props}>
    {children}
  </div>
)

const CardHeader = ({ children, className }) => <div className={clsx('mb-4', className)}>{children}</div>
const CardTitle = ({ children, className }) => <h3 className={clsx('text-lg font-extrabold text-ink', className)}>{children}</h3>
const CardDescription = ({ children, className }) => <p className={clsx('mt-1 text-sm text-ink-soft', className)}>{children}</p>
const CardContent = ({ children, className }) => <div className={className}>{children}</div>
const CardFooter = ({ children, className }) => <div className={clsx('mt-4 border-t border-line pt-4', className)}>{children}</div>

Card.Header = CardHeader
Card.Title = CardTitle
Card.Description = CardDescription
Card.Content = CardContent
Card.Footer = CardFooter
