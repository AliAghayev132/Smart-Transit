import { describe, expect, test } from 'vitest'
import i18n from '@/lib/i18n'
import { fmtEta, fmtDist, fmtMin, fmtTime, normalizeAz, routeShade } from '@utils'

describe('fmtEta — üç dildə və cəm formaları', () => {
  test('30 saniyə və az → «gəlir»', async () => {
    expect(fmtEta(10)).toBe('Gəlir')
    await i18n.changeLanguage('en')
    expect(fmtEta(30)).toBe('Arriving')
  })

  test('dəqiqələr', async () => {
    expect(fmtEta(300)).toBe('5 dəq')
    await i18n.changeLanguage('ru')
    expect(fmtEta(300)).toBe('5 мин')
    expect(i18n.t('time.minutes', { count: 1 })).toBe('1 минута')
    expect(i18n.t('time.minutes', { count: 3 })).toBe('3 минуты')
    expect(i18n.t('time.minutes', { count: 5 })).toBe('5 минут')
    expect(i18n.t('time.minutes', { count: 21 })).toBe('21 минута')
    await i18n.changeLanguage('en')
    expect(i18n.t('time.minutes', { count: 1 })).toBe('1 minute')
    expect(i18n.t('time.minutes', { count: 2 })).toBe('2 minutes')
  })

  test('fmtMin minimum 1 dəqiqədir', () => {
    expect(fmtMin(0)).toBe(1)
    expect(fmtMin(89)).toBe(1)
    expect(fmtMin(91)).toBe(2)
  })
})

describe('digər formatlar', () => {
  test('məsafə', async () => {
    expect(fmtDist(350)).toBe('350 m')
    expect(fmtDist(1500)).toMatch(/^1[.,]5 km$/)
    await i18n.changeLanguage('ru')
    expect(fmtDist(350)).toBe('350 м')
  })

  test('saat HH:mm, səhv tarix → boş', () => {
    expect(fmtTime(new Date(2026, 9, 31, 9, 5))).toBe('09:05')
    expect(fmtTime('not-a-date')).toBe('')
  })

  test('Azərbaycan hərflərinə həssas olmayan axtarış', () => {
    expect(normalizeAz('Gənclik')).toBe(normalizeAz('genclik'))
    expect(normalizeAz('Koroğlu')).toBe('koroglu')
  })

  test('xətt rəngi tündləşdirilir (ağ mətn üçün)', () => {
    expect(routeShade('#ea580c')).toContain('color-mix')
  })
})
