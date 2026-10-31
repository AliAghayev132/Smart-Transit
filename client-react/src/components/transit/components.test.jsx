import { describe, expect, test } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import i18n from '@/lib/i18n'
import { DepartureCards } from './DepartureCards'
import { CrowdBadge } from './CrowdBadge'
import { LanguageSwitcher } from '../LanguageSwitcher'

const items = [
  { busId: 'b1', etaSec: 20, crowd: { level: 'high' } },
  { busId: 'b2', etaSec: 300, crowd: { level: 'low' } },
  { busId: 'b3', etaSec: 1260, crowd: { level: 'mid' }, isReserve: true },
]

describe('DepartureCards (Six-O gəliş kartları)', () => {
  test('iri dəqiqə, «İndi», ehtiyat nişanı və əlçatan ad', () => {
    render(<DepartureCards items={items} color="#2563eb" />)
    expect(screen.getAllByText('İndi').length).toBeGreaterThan(0)
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('21')).toBeTruthy()
    expect(screen.getByText('Ehtiyat')).toBeTruthy()
    expect(screen.getByLabelText(/5 dəqiqə, Az sıxlıq/)).toBeTruthy()
  })

  test('rus dilində cəm formaları', async () => {
    await act(() => i18n.changeLanguage('ru'))
    render(<DepartureCards items={items} color="#2563eb" />)
    expect(screen.getByText('минут')).toBeTruthy()
    expect(screen.getByText('минута')).toBeTruthy()
  })

  test('boş siyahı → heç nə render olunmur', () => {
    const { container } = render(<DepartureCards items={[]} color="#000" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('CrowdBadge', () => {
  test('səviyyə və doluluq faizi', () => {
    render(<CrowdBadge level="high" pct={102} />)
    expect(screen.getByText('Yüksək')).toBeTruthy()
    expect(screen.getByText('102%')).toBeTruthy()
  })

  test('naməlum səviyyədə faiz göstərilmir', () => {
    render(<CrowdBadge level="weird" pct={50} />)
    expect(screen.getByText('Məlumat yoxdur')).toBeTruthy()
    expect(screen.queryByText('50%')).toBeNull()
  })
})

describe('LanguageSwitcher', () => {
  test('dil dəyişir, <html lang> və seçim yadda saxlanılır', async () => {
    render(<LanguageSwitcher />)
    await act(async () => fireEvent.click(screen.getByRole('radio', { name: 'RU' })))
    expect(i18n.resolvedLanguage).toBe('ru')
    expect(document.documentElement.lang).toBe('ru')
    expect(localStorage.getItem('st_lang')).toBe('ru')
    expect(screen.getByRole('radio', { name: 'RU' }).getAttribute('aria-checked')).toBe('true')
  })
})
