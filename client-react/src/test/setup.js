// Vitest qurulumu: i18n işə salınır, hər test AZ dilində başlayır, DOM təmizlənir
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import i18n from '@/lib/i18n'

beforeEach(async () => {
  await i18n.changeLanguage('az')
})

afterEach(() => {
  cleanup()
})
