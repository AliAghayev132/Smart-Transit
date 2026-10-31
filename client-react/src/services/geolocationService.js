/** Brauzerdən birdəfəlik GPS mövqeyi (icazə verilməsə və ya dəstəklənməsə null) */
export const getPosition = (timeout = 6000) =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    )
  })

/** GPS yalnız HTTPS və ya localhost-da işləyir */
export const isGeoAvailable = () => typeof window !== 'undefined' && window.isSecureContext && !!navigator.geolocation
