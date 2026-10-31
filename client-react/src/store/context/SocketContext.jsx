/* This file intentionally exports a hook (useSocket) alongside the provider,
   and the connection effect drives an external system (Socket.IO) so it must
   call setState synchronously to store/tear down the socket instance. */
/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { useSelector } from 'react-redux'
import { SERVER_URL } from '@/lib/variables'

const SocketContext = createContext(null)

// Bütün tətbiqə tək Socket.IO bağlantısı.
// Sərnişinlər anonim olduğu üçün token olmadan da ("guest")
// qoşulur. Login olduqda (operator) bağlantı token ilə yenidən qurulur və server
// onu `operators` otağına əlavə edir (alert:*, dispatch:* hadisələri).
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const { accessToken } = useSelector((state) => state.auth)
  const reconnectAttempts = useRef(0)

  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      auth: accessToken ? { token: accessToken } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    newSocket.on('connect', () => {
      setIsConnected(true)
      reconnectAttempts.current = 0
    })
    newSocket.on('disconnect', () => setIsConnected(false))
    newSocket.on('connect_error', () => {
      reconnectAttempts.current++
    })

    setSocket(newSocket)
    return () => {
      newSocket.disconnect()
      setIsConnected(false)
    }
  }, [accessToken])

  // ---- Generic room helpers ----
  const joinRoom = useCallback(
    (roomId) => {
      if (socket && isConnected) socket.emit('join:room', roomId)
    },
    [socket, isConnected]
  )

  const leaveRoom = useCallback(
    (roomId) => {
      if (socket && isConnected) socket.emit('leave:room', roomId)
    },
    [socket, isConnected]
  )

  const value = { socket, isConnected, joinRoom, leaveRoom }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export default SocketContext
