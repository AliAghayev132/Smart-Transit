import { clsx } from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

const changeColors = { positive: 'text-ok', negative: 'text-danger', neutral: 'text-ink-soft' }

export const StatCard = ({ title, value, change, changeType = 'neutral', icon, className }) => (
  <div className={clsx('rounded-card bg-surface p-5 shadow-card', className)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-sm font-semibold text-ink-soft">{title}</p>
        <p className="text-3xl font-black tracking-tight text-ink">{value}</p>
        {change && (
          <div className={clsx('mt-2 flex items-center gap-1 text-sm font-semibold', changeColors[changeType])}>
            {changeType === 'positive' && <TrendingUp className="h-4 w-4" />}
            {changeType === 'negative' && <TrendingDown className="h-4 w-4" />}
            <span>{change}</span>
          </div>
        )}
      </div>
      {icon && <div className="rounded-2xl bg-brand-soft p-3 text-brand">{icon}</div>}
    </div>
  </div>
)
