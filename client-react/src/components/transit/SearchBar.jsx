/**
 * Haradan → Haraya axtarış kartı (Six-O).
 * Autocomplete: Google Places (New) → fallback Photon (OSM) + öz dayanacaqlarımız.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { ArrowUpDown, Crosshair, LocateFixed, MapPin, Bus, X } from 'lucide-react'
import { useMapEngine } from '@store/context'
import { googleResolve, googleSuggest, photonSearch, searchStops, getPosition } from '@services'

const ICONS = { me: LocateFixed, pick: Crosshair, stop: Bus, google: MapPin, osm: MapPin }

const PlaceField = ({ label, dot, value, onSelect, routes, onPick, picking }) => {
  const { t } = useTranslation('passenger')
  const listId = useId()
  const engine = useMapEngine()
  const placesLib = engine?.placesLib
  const [text, setText] = useState(value?.name || '')
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState([])
  const [status, setStatus] = useState('')
  const [active, setActive] = useState(0)
  const token = useRef(null)
  const boxRef = useRef(null)

  // Seçilmiş dəyər xaricdən dəyişəndə mətni sinxronlaşdır (render zamanı — effektsiz)
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value?.name || '')
  }

  // Uzaq axtarış (Google və ya Photon) — 250 ms debounce
  useEffect(() => {
    const q = text.trim()
    if (!open || q.length < 3 || q === value?.name) return undefined
    const ctrl = new AbortController()
    const tm = setTimeout(async () => {
      try {
        if (placesLib) {
          token.current = token.current || new placesLib.AutocompleteSessionToken()
          setRemote(await googleSuggest(placesLib, q, token.current))
        } else {
          setRemote(await photonSearch(q, ctrl.signal))
        }
        setStatus('')
      } catch (e) {
        if (e.name === 'AbortError') return
        try {
          setRemote(placesLib ? await photonSearch(q, ctrl.signal) : [])
          if (!placesLib) setStatus('search.unavailable')
        } catch {
          setStatus('search.unavailable')
        }
      }
    }, 250)
    return () => {
      clearTimeout(tm)
      ctrl.abort()
    }
  }, [text, open, placesLib, value])

  const items = useMemo(() => {
    const list = [{ id: 'me', name: t('search.myLocation'), secondary: t('search.gps'), source: 'me' }]
    const typing = text.trim() && text !== value?.name
    if (typing) list.push(...searchStops(text, routes), ...(text.trim().length >= 3 ? remote : []))
    list.push({ id: 'pick', name: t('search.pickOnMap'), secondary: t('search.tapMap'), source: 'pick' })
    return list
  }, [text, routes, remote, value, t])

  useEffect(() => {
    const h = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const choose = async (it) => {
    setOpen(false)
    setStatus('')
    if (it.source === 'pick') return onPick()
    if (it.source === 'me') {
      setStatus('search.locating')
      const p = await getPosition(8000)
      setStatus(p ? '' : window.isSecureContext ? 'search.gpsDenied' : 'search.gpsInsecure')
      if (p) onSelect({ lat: p.lat, lng: p.lng, name: t('search.myLocation') })
      return
    }
    if (it.source === 'google') {
      try {
        const r = await googleResolve(it)
        token.current = null
        return onSelect(r)
      } catch {
        return setStatus('search.placeFailed')
      }
    }
    onSelect({ lat: it.lat, lng: it.lng, name: it.name })
  }

  const onKey = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) return setOpen(true)
    if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
    else if (e.key === 'Enter' && items[active]) choose(items[active])
    else if (e.key === 'Escape') setOpen(false)
    else return
    e.preventDefault()
  }

  return (
    <div className="relative" ref={boxRef}>
      <span
        className={clsx('absolute left-3.5 top-[17px] z-10 h-3 w-3 rounded-full ring-4', dot === 'from' ? 'bg-[#0e9f5b] ring-[#0e9f5b]/20' : 'bg-[#e5202e] ring-[#e5202e]/20')}
        aria-hidden
      />
      <input
        value={text}
        placeholder={picking ? t('search.tapMapNow') : label}
        onFocus={(e) => {
          setOpen(true)
          setActive(0)
          e.target.select()
        }}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={onKey}
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={clsx(
          'h-12 w-full rounded-2xl border-2 bg-raised pl-10 pr-10 text-base font-bold text-ink outline-none transition-colors placeholder:font-semibold',
          'focus:border-brand focus:bg-surface',
          picking ? 'border-brand' : 'border-transparent'
        )}
      />
      {value && (
        <button
          className="absolute right-2.5 top-3 grid h-6 w-6 place-items-center rounded-full text-ink-faint hover:bg-line hover:text-ink"
          title={t('common:actions.clear')}
          aria-label={t('common:actions.clear')}
          onClick={() => onSelect(null)}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {open && (
        <ul id={listId} className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1500] max-h-80 overflow-y-auto rounded-2xl bg-surface p-1.5 shadow-float" role="listbox">
          {items.map((it, i) => {
            const Icon = ICONS[it.source]
            return (
              <li
                key={it.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(it)
                }}
                onMouseEnter={() => setActive(i)}
                className={clsx('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', i === active && 'bg-raised')}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-ink-soft">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{it.name}</span>
                  {it.secondary && <span className="block truncate text-xs text-ink-soft">{it.secondary}</span>}
                </span>
              </li>
            )
          })}
          <li className="px-3 pb-1 pt-1.5 text-right text-[11px] font-semibold text-ink-faint" aria-hidden>
            {placesLib ? 'Google Places' : 'OpenStreetMap · Photon'}
          </li>
        </ul>
      )}
      {status && <p className="mt-1.5 pl-10 text-xs font-bold text-warn">{t(status)}</p>}
    </div>
  )
}

export const SearchBar = ({ from, to, setFrom, setTo, routes, picking, setPicking }) => {
  const { t } = useTranslation('passenger')
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
        <span className="pointer-events-none absolute bottom-[26px] left-[19px] top-[26px] z-10 border-l-2 border-dotted border-ink-faint/60" aria-hidden />
        <PlaceField label={t('common:map.from')} dot="from" value={from} onSelect={setFrom} routes={routes} picking={picking === 'from'} onPick={() => setPicking('from')} />
        <PlaceField label={t('common:map.to')} dot="to" value={to} onSelect={setTo} routes={routes} picking={picking === 'to'} onPick={() => setPicking('to')} />
      </div>
      <button
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised text-ink-soft transition-colors hover:text-brand"
        title={t('common:actions.swap')}
        aria-label={t('common:actions.swap')}
        onClick={() => {
          setFrom(to)
          setTo(from)
        }}
      >
        <ArrowUpDown className="h-5 w-5" />
      </button>
    </div>
  )
}
