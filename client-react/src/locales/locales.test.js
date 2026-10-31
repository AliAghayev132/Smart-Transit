import { describe, expect, test } from 'vitest'

const files = import.meta.glob('./*/*.json', { eager: true, import: 'default' })
const LANGS = ['az', 'en', 'ru']
const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, `${p}${k}.`, out)
    else out[`${p}${k}`] = v
  }
  return out
}
const base = (k, all) => {
  const m = k.match(/_(one|few|many|other)$/)
  return m && `${k.slice(0, -m[0].length)}_other` in all ? k.slice(0, -m[0].length) : k
}

const namespaces = [...new Set(Object.keys(files).map((f) => f.split('/')[2]))]

describe.each(namespaces)('tərcümələr: %s', (ns) => {
  const data = Object.fromEntries(LANGS.map((l) => [l, flat(files[`./${l}/${ns}`])]))
  const keys = Object.fromEntries(LANGS.map((l) => [l, new Set(Object.keys(data[l]).map((k) => base(k, data[l])))]))

  test('hər üç dildə eyni açarlar', () => {
    expect([...keys.en].sort()).toEqual([...keys.az].sort())
    expect([...keys.ru].sort()).toEqual([...keys.az].sort())
  })

  test('boş tərcümə yoxdur, yer tutucular dillər arasında eynidir', () => {
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(data[l])) {
        if (typeof v === 'string') expect(v.trim(), `${l}:${k}`).not.toBe('')
      }
    }
    const vars = (s) => (typeof s === 'string' ? (s.match(/\{\{\w+\}\}/g) || []).sort().join() : '')
    for (const [k, v] of Object.entries(data.az)) {
      if (!(k in data.en)) continue
      expect(vars(data.en[k]), `en:${k}`).toBe(vars(v))
    }
  })

  test('rus dili cəm formaları tamdır', () => {
    for (const k of Object.keys(data.ru).filter((k) => k.endsWith('_one') && base(k, data.ru) !== k)) {
      const b = k.slice(0, -4)
      for (const f of ['_few', '_many', '_other']) expect(data.ru, `${b}${f}`).toHaveProperty([`${b}${f}`])
    }
  })
})
