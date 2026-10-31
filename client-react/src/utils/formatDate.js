import { format, formatDistanceToNow, isValid } from 'date-fns'
import { dateLocale } from './format'

const toDate = (value) => (value instanceof Date ? value : new Date(value))

/** `DD.MM.YYYY` */
export const formatDate = (value) => {
  if (!value) return ''
  const date = toDate(value)
  return isValid(date) ? format(date, 'dd.MM.yyyy') : ''
}

/** `DD.MM.YYYY HH:mm` */
export const formatDateTime = (value) => {
  if (!value) return ''
  const date = toDate(value)
  return isValid(date) ? format(date, 'dd.MM.yyyy HH:mm') : ''
}

/** "3 saat əvvəl" — cari dildə */
export const formatRelative = (value) => {
  if (!value) return ''
  const date = toDate(value)
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true, locale: dateLocale() }) : ''
}
