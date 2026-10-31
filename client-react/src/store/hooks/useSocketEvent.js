import { useEffect } from 'react'
import { useSocket } from '@store/context'

/**
 * Socket hadisəsinə abunə (cleanup ilə). handler stabil olmalıdır (useCallback).
 */
export const useSocketEvent = (event, handler) => {
  const { socket } = useSocket()
  useEffect(() => {
    if (!socket || !handler) return
    socket.on(event, handler)
    return () => socket.off(event, handler)
  }, [socket, event, handler])
}

export default useSocketEvent
