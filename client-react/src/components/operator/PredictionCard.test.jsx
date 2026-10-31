import { describe, expect, test, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import i18n from '@/lib/i18n'

const state = { data: null, isFetching: false, error: null, calls: [] }
vi.mock('@store/api', () => ({
  useGetPredictionQuery: (arg) => {
    state.calls.push(arg)
    return { data: state.data, isFetching: state.isFetching, error: state.error }
  },
}))

const { PredictionCard } = await import('./PredictionCard')

const r5 = { routeId: 'r5', number: '5', color: '#db2777', name: 'Xətt 5' }
const r8 = { routeId: 'r8', number: '8', color: '#2563eb', name: 'Xətt 8' }
const sample = {
  source: 'gemini',
  generatedAt: '2026-10-31T10:00:00Z',
  summary: 'Axşam pikində №5 sıxlaşacaq.',
  weather: { condition: 'rain', tempC: 11.6 },
  traffic: { level: 'heavy', source: 'gps', avgSpeedKmh: 14.2 },
  peakHours: { source: 'history', hours: [{ hour: 8 }, { hour: 18 }] },
  spikes: [{ ...r5, inMin: 40, loadPct: 112, level: 'high', confidence: 0.7, reason: 'Pik + yağış' }],
  reallocations: [
    { from: r8, to: r5, buses: 1, inMin: 10, reason: '№8 boşdur' },
    { from: null, to: r5, buses: 2, inMin: 0, reason: 'Park' },
  ],
  risks: ['<img src=x onerror=alert(1)>'],
}

beforeEach(() => {
  Object.assign(state, { data: null, isFetching: false, error: null, calls: [] })
})

describe('PredictionCard (Gemini proqnozu)', () => {
  test('hazırlanır → xəta mətnləri', () => {
    const { rerender } = render(<PredictionCard />)
    expect(screen.getByText('Proqnoz hazırlanır…')).toBeTruthy()
    state.error = { status: 500 }
    rerender(<PredictionCard />)
    expect(screen.getByText(/Proqnoz alınmadı/)).toBeTruthy()
  })

  test('sıçrayış, yerdəyişmə, hava, tıxac və mənbə göstərilir', () => {
    state.data = sample
    render(<PredictionCard routes={[{ id: 'r5' }, { id: 'r8' }]} />)
    expect(screen.getByText('Gemini')).toBeTruthy()
    expect(screen.getByText(/Yağış, 12°C/)).toBeTruthy()
    expect(screen.getByText('sıx')).toBeTruthy()
    expect(screen.getByText('~40 dəq sonra')).toBeTruthy()
    expect(screen.getByText('Ehtiyat park')).toBeTruthy()
    expect(screen.getByText('2 avtobus')).toBeTruthy()
    expect(screen.getByText(/Pik saatlar: 08:00, 18:00/)).toBeTruthy()
  })

  test('model mətni HTML kimi icra olunmur (XSS)', () => {
    state.data = sample
    const { container } = render(<PredictionCard />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy()
  })

  test('xəttə klik → onSelectRoute; yenilə → keşsiz sorğu', () => {
    state.data = { ...sample, source: 'rules', fallback: true }
    const onSelectRoute = vi.fn()
    render(<PredictionCard routes={[{ id: 'r5' }, { id: 'r8' }]} onSelectRoute={onSelectRoute} />)
    expect(screen.getByText('Baza modeli')).toBeTruthy()
    expect(screen.getByText(/Gemini cavab vermədi/)).toBeTruthy()
    fireEvent.click(screen.getAllByLabelText('№8')[0])
    expect(onSelectRoute).toHaveBeenCalledWith({ id: 'r8' })
    fireEvent.click(screen.getByLabelText('Proqnozu yenilə'))
    expect(state.calls.at(-1)).toBe(1)
  })

  test('rus dili: cəm formaları', async () => {
    await act(() => i18n.changeLanguage('ru'))
    state.data = sample
    render(<PredictionCard />)
    expect(screen.getByText('2 автобуса')).toBeTruthy()
    expect(screen.getByText('1 автобус')).toBeTruthy()
    expect(screen.getByText('через ~40 мин')).toBeTruthy()
  })
})
