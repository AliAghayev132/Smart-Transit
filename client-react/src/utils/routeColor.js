/** Xətt rəngi → ağ mətn üçün kifayət qədər tünd fon (WCAG AA) */
export const routeShade = (color) => `color-mix(in srgb, ${color} 80%, #000)`

/** Xətt rənginin yumşaq fonu (çiplər) */
export const routeTint = (color) => `color-mix(in srgb, ${color} 14%, var(--color-surface))`
