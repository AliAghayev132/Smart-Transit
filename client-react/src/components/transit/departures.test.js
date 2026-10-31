import { describe, expect, test } from 'vitest'
import { directionDepartures } from './departures'

const route = { stops: [{ id: 'a', name: 'Sahil m.' }, { id: 'b', name: '28 May m.' }, { id: 'c', name: 'Koroğlu m.' }] }
const arrivals = [
  { busId: '1', headsign: 'Koroğlu m.' },
  { busId: '2', headsign: 'Sahil m.' },
]

describe('istiqamət üzrə gəlişlər', () => {
  test('aralıq dayanacaqda yalnız həmin istiqamət', () => {
    expect(directionDepartures(arrivals, route, 'b', 'Koroğlu m.').map((a) => a.busId)).toEqual(['1'])
    expect(directionDepartures(arrivals, route, 'b', 'Sahil m.').map((a) => a.busId)).toEqual(['2'])
  })

  test('başlanğıc terminalda dönən avtobuslar da sayılır', () => {
    expect(directionDepartures(arrivals, route, 'a', 'Koroğlu m.')).toHaveLength(2)
    expect(directionDepartures(arrivals, route, 'c', 'Sahil m.')).toHaveLength(2)
  })

  test('boş giriş xəta vermir', () => {
    expect(directionDepartures(undefined, route, 'b', 'Sahil m.')).toEqual([])
    expect(directionDepartures(arrivals, undefined, 'b', 'X')).toEqual([])
  })
})
