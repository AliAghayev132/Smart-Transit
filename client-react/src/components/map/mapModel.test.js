import { describe, expect, test } from 'vitest'
import { busMarkerHtml, heatBlobHtml } from './mapModel'

describe('xəritə HTML-i (Leaflet divIcon) — XSS qorunması', () => {
  test('xətt nömrəsi və rəng escape olunur', () => {
    const html = busMarkerHtml({ number: '<img src=x onerror=alert(1)>', color: '"><script>alert(1)</script>', level: 'high' })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;img')
  })

  test('doluluq nöqtələri səviyyəyə uyğundur, naməlum səviyyə → 0', () => {
    const on = (h) => (h.match(/class="on"/g) || []).length
    expect(on(busMarkerHtml({ number: '5', color: '#000', level: 'high' }))).toBe(3)
    expect(on(busMarkerHtml({ number: '5', color: '#000', level: 'low' }))).toBe(1)
    expect(on(busMarkerHtml({ number: '5', color: '#000', level: 'bogus' }))).toBe(0)
  })

  test('ehtiyat avtobus sinfi', () => {
    expect(busMarkerHtml({ number: '5', color: '#000', level: 'mid', reserve: true })).toContain('bus-mk reserve')
  })

  test('heatmap: yalnız rəqəmlər HTML-ə düşür', () => {
    const html = heatBlobHtml({ size: '20px;background:url(javascript:1)', opacity: 0.5, count: '<b>9</b>' })
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('javascript')
    expect(html).toContain('<span>0</span>')
  })
})
