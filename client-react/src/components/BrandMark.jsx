import { clsx } from 'clsx'

/** Loqo nişanı: mavi kvadrat + avtobus (Bakı avtobuslarının rəngi) */
export const BrandMark = ({ className }) => (
  <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand', className)} aria-hidden>
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <rect x="4" y="2.5" width="16" height="16.5" rx="3.4" fill="currentColor" />
      <rect x="6.2" y="5.6" width="11.6" height="6" rx="1.3" fill="var(--color-brand)" />
      <circle cx="8" cy="15.2" r="1.3" fill="var(--color-brand)" />
      <circle cx="16" cy="15.2" r="1.3" fill="var(--color-brand)" />
      <rect x="5.6" y="18.4" width="3.2" height="3.2" rx="1.1" fill="currentColor" />
      <rect x="15.2" y="18.4" width="3.2" height="3.2" rx="1.1" fill="currentColor" />
    </svg>
  </span>
)
