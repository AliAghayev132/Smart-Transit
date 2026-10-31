import { useEffect, useState } from 'react'

/** Hər `ms` millisaniyədən bir yenilənən "indi" — nisbi vaxt mətnləri üçün */
export const useNow = (ms = 15000) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export default useNow
