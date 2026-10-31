/**
 * Çoxdillilik (AZ / EN / RU) — i18next + react-i18next.
 *
 * Tərcümələr: src/locales/<dil>/<namespace>.json
 *   common    — ümumi sözlər (sıxlıq, vaxt, düymələr, dil, tema, xəritə)
 *   passenger — sərnişin modulu
 *   operator  — dispetçer paneli
 * Cəm formaları: i18next v4 JSON (key_one / key_few / key_many / key_other) + Intl.PluralRules.
 * Dil seçimi: localStorage (st_lang) → brauzer dili → az.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import azCommon from '@/locales/az/common.json'
import azPassenger from '@/locales/az/passenger.json'
import azOperator from '@/locales/az/operator.json'
import enCommon from '@/locales/en/common.json'
import enPassenger from '@/locales/en/passenger.json'
import enOperator from '@/locales/en/operator.json'
import ruCommon from '@/locales/ru/common.json'
import ruPassenger from '@/locales/ru/passenger.json'
import ruOperator from '@/locales/ru/operator.json'

export const LANGS = [
  { code: 'az', short: 'AZ', name: 'Azərbaycanca', locale: 'az-Latn-AZ' },
  { code: 'en', short: 'EN', name: 'English', locale: 'en-GB' },
  { code: 'ru', short: 'RU', name: 'Русский', locale: 'ru-RU' },
]
export const LANG_CODES = LANGS.map((l) => l.code)
export const DEFAULT_LANG = 'az'
const STORAGE_KEY = 'st_lang'

const detect = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (LANG_CODES.includes(saved)) return saved
  } catch {
    /* ignore */
  }
  const nav = (navigator.languages || [navigator.language || '']).map((l) => String(l).slice(0, 2).toLowerCase())
  return nav.find((l) => LANG_CODES.includes(l)) || DEFAULT_LANG
}

const applyToDocument = (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
}

i18n.use(initReactI18next).init({
  resources: {
    az: { common: azCommon, passenger: azPassenger, operator: azOperator },
    en: { common: enCommon, passenger: enPassenger, operator: enOperator },
    ru: { common: ruCommon, passenger: ruPassenger, operator: ruOperator },
  },
  lng: detect(),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: LANG_CODES,
  ns: ['common', 'passenger', 'operator'],
  defaultNS: 'common',
  fallbackNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyToDocument(i18n.language)
i18n.on('languageChanged', applyToDocument)

/** Cari dil (az | en | ru) */
export const currentLang = () => (LANG_CODES.includes(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANG)
/** Intl locale (rəqəm / saat formatı) */
export const currentLocale = () => LANGS.find((l) => l.code === currentLang())?.locale || 'az-Latn-AZ'

export default i18n
