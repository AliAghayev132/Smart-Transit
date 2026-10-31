/**
 * Tərcümə yoxlaması: hər namespace üçün az / en / ru açar dəstləri eyni olmalıdır.
 * Cəm şəkilçiləri (_one/_few/_many/_other) bir açar sayılır; ru üçün _few və _many tələb olunur.
 *   npm run i18n:check
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = new URL('../src/locales/', import.meta.url).pathname
const LANGS = ['az', 'en', 'ru']
const PLURAL = /_(zero|one|two|few|many|other)$/
// Cəm açarı yalnız `_other` forması da olduqda sayılır (məs. kod adı `alert_min_one` cəm deyil)
const baseOf = (k, all) => {
  const m = k.match(PLURAL)
  if (!m) return k
  const base = k.slice(0, -m[0].length)
  return `${base}_other` in all ? base : k
}

const flat = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, `${prefix}${k}.`, out)
    else out[`${prefix}${k}`] = v
  }
  return out
}

let problems = 0
for (const ns of readdirSync(join(DIR, 'az')).filter((f) => f.endsWith('.json'))) {
  const sets = {}
  const raw = {}
  for (const l of LANGS) {
    raw[l] = flat(JSON.parse(readFileSync(join(DIR, l, ns), 'utf8')))
    sets[l] = new Set(Object.keys(raw[l]).map((k) => baseOf(k, raw[l])))
  }
  for (const l of LANGS) {
    for (const other of LANGS) {
      if (l === other) continue
      const missing = [...sets[l]].filter((k) => !sets[other].has(k))
      if (missing.length) {
        problems += missing.length
        console.log(`✗ ${ns}: ${other} dilində yoxdur → ${missing.join(', ')}`)
      }
    }
  }
  // Rus dili: cəm açarlarında _few və _many
  for (const k of Object.keys(raw.ru).filter((k) => k.endsWith('_one') && baseOf(k, raw.ru) !== k)) {
    const base = k.replace(/_one$/, '')
    for (const f of ['_few', '_many', '_other']) {
      if (!(base + f in raw.ru)) {
        problems++
        console.log(`✗ ${ns}: ru ${base}${f} yoxdur`)
      }
    }
  }
  console.log(`✓ ${ns}: ${sets.az.size} açar`)
}
process.exit(problems ? 1 : 0)
