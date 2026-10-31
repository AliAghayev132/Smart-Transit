import { formatDistanceToNowStrict, format, isValid } from 'date-fns'
import { az, enGB, ru } from 'date-fns/locale'
import i18n, { currentLang, currentLocale } from '@/lib/i18n'

const DATE_LOCALES = { az, en: enGB, ru }

/** Cari dilə uyğun date-fns locale */
export const dateLocale = () => DATE_LOCALES[currentLang()] || az

const toDate = (value) => (value instanceof Date ? value : new Date(value))

/** Saniyə → dəqiqə (min 1) */
export const fmtMin = (sec) => Math.max(1, Math.round(sec / 60))

/** ETA saniyə → "Gəlir" / "5 dəq" (cari dildə) */
export const fmtEta = (sec) => (sec <= 30 ? i18n.t('common:time.arriving') : i18n.t('common:time.min', { count: fmtMin(sec) }))

/** Rəqəm — cari dilin formatı ilə */
export const fmtNum = (n, opts) => (n == null ? '' : Number(n).toLocaleString(currentLocale(), opts))

export const fmtDist = (m) =>
  m >= 1000
    ? i18n.t('common:dist.km', { n: fmtNum(m / 1000, { maximumFractionDigits: 1 }) })
    : i18n.t('common:dist.m', { n: Math.round(m) })

/** HH:mm (hər üç dildə 24 saat) */
export const fmtTime = (value) => {
  const d = toDate(value)
  return isValid(d) ? format(d, 'HH:mm') : ''
}

/** "3 dəqiqə əvvəl" / "3 minutes ago" / "3 минуты назад" */
export const fmtAgo = (value) => {
  if (!value) return '—'
  const d = toDate(value)
  if (!isValid(d)) return '—'
  if (Date.now() - d.getTime() < 45000) return i18n.t('common:status.justNow')
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: dateLocale() })
}

/** Azərbaycan hərflərinə həssas olmayan axtarış üçün normallaşdırma ("genclik" → "Gənclik") */
export const normalizeAz = (s) =>
  (s || '')
    .toLocaleLowerCase('az')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
