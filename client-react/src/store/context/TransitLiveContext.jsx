/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSocket } from './SocketContext'
import { useGetCrowdQuery, useGetDensityLiveQuery } from '@store/api'

const TransitLiveContext = createContext(null)

/**
 * Real-vaxt transit vəziyyəti (bütün ağac üçün TƏK abunə):
 *  buses   — avtobus mövqeləri       (socket "buses:update")
 *  crowd   — crowdsourcing sıxlığı   (socket "crowd:update", ilkin: GET /analytics/crowd)
 *  density — canlı istifadəçilər (B) (socket "density:update", ilkin: GET /density/live)
 */
export const TransitLiveProvider = ({ children }) => {
  const { socket, isConnected } = useSocket()
  const [buses, setBuses] = useState([])
  const [crowdLive, setCrowd] = useState(null)
  const [densityLive, setDensity] = useState(null)
  const { data: crowdSeed } = useGetCrowdQuery()
  const { data: densitySeed } = useGetDensityLiveQuery()

  useEffect(() => {
    if (!socket) return
    socket.on('buses:update', setBuses)
    socket.on('crowd:update', setCrowd)
    socket.on('density:update', setDensity)
    return () => {
      socket.off('buses:update', setBuses)
      socket.off('crowd:update', setCrowd)
      socket.off('density:update', setDensity)
    }
  }, [socket])

  const value = useMemo(
    () => ({ buses, crowd: crowdLive || crowdSeed || null, density: densityLive || densitySeed || null, isConnected }),
    [buses, crowdLive, crowdSeed, densityLive, densitySeed, isConnected]
  )
  return <TransitLiveContext.Provider value={value}>{children}</TransitLiveContext.Provider>
}

export const useTransitLiveContext = () => {
  const ctx = useContext(TransitLiveContext)
  if (!ctx) throw new Error('useTransitLive must be used within a TransitLiveProvider')
  return ctx
}
