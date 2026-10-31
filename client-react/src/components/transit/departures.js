/**
 * Dayanacaqdan verilmiş istiqamətdə yola düşəcək avtobuslar.
 * Başlanğıc terminalda avtobuslar əks istiqamətdən gəlib dönür — ona görə orada hamısı sayılır.
 */
export const directionDepartures = (arrivals = [], route, stopId, headsign) => {
  const stops = route?.stops || []
  const last = stops[stops.length - 1]
  const originId = headsign === last?.name ? stops[0]?.id : last?.id
  return stopId && stopId === originId ? arrivals : arrivals.filter((a) => a.headsign === headsign)
}
