import { useEffect, useRef, useState } from 'react'
import { useSocket } from '@store/context'

/**
 * Yanaşma B: canlı lokasiyanı anonim paylaşmaq (yalnız istifadəçi açdıqda).
 * Mövqe ~10 san-dən bir göndərilir; söndürüldükdə serverdən dərhal silinir.
 * state: off | waiting | on | denied | unsupported | insecure
 */
export const useLiveLocationShare = (enabled, intervalMs = 10000) => {
  const { socket } = useSocket()
  const [state, setState] = useState('off')
  const lastSent = useRef(0)
  const lastPos = useRef(null)

  // Effekt xarici sistemi (Geolocation + Socket.IO) idarə edir; vəziyyət sinxron yenilənir
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!socket) return
    if (!enabled) {
      setState('off')
      socket.emit('presence:stop')
      return
    }
    if (!window.isSecureContext) return setState('insecure')
    if (!navigator.geolocation) return setState('unsupported')

    setState('waiting')
    const send = (p, force = false) => {
      const now = Date.now()
      if (!force && now - lastSent.current < intervalMs) return
      lastSent.current = now
      socket.emit('presence:update', p)
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, speed: pos.coords.speed }
        lastPos.current = p
        setState('on')
        send(p)
      },
      (err) => setState(err.code === 1 ? 'denied' : 'waiting'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    // Hərəkətsiz olsa belə mövqeyi aktiv saxla (server TTL 90 san)
    const keepAlive = setInterval(() => lastPos.current && send(lastPos.current, true), intervalMs * 3)
    const onReconnect = () => lastPos.current && send(lastPos.current, true)
    socket.on('connect', onReconnect)
    return () => {
      navigator.geolocation.clearWatch(id)
      clearInterval(keepAlive)
      socket.off('connect', onReconnect)
      socket.emit('presence:stop')
    }
  }, [enabled, intervalMs, socket])
  /* eslint-enable react-hooks/set-state-in-effect */

  return { state }
}

export default useLiveLocationShare
