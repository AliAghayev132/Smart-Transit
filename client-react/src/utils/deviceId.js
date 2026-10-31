/**
 * Anonim cihaz identifikatoru (crowdsourcing spam qorunması və "Gedirəm" niyyətləri üçün).
 * Şəxsi məlumat deyil — brauzerdə təsadüfi yaradılır.
 */
export const getDeviceId = () => {
  try {
    let id = localStorage.getItem('st_device_id')
    if (!id) {
      id = crypto.randomUUID?.() || `d-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('st_device_id', id)
    }
    return id
  } catch {
    return `d-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}
