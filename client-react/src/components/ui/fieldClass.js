import { clsx } from 'clsx'

/** Forma sahələri üçün ümumi siniflər (Input / Select / Textarea) */
export const fieldClass = (error) =>
  clsx(
    'w-full rounded-2xl border bg-surface px-4 py-2.5 text-ink outline-none transition-[border-color,box-shadow]',
    'focus:border-brand focus:ring-4 focus:ring-brand/20',
    'disabled:cursor-not-allowed disabled:bg-raised',
    error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line'
  )
