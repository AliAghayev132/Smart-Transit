// Redux Toolkit
import { createSlice } from '@reduxjs/toolkit'

// ============ LOCAL STORAGE ============
// Xəritə qatlarının seçimi yadda saxlanılır (operator rahatlığı)
const getStoredLayers = () => {
  try {
    return JSON.parse(localStorage.getItem('st_layers')) || null
  } catch {
    return null
  }
}

const initialState = {
  selectedRouteId: null,
  selectedAlertId: null,
  layers: getStoredLayers() || { segments: true, reports: true, density: true, demand: true },
  shortcutsOpen: false,
  // Dispetçer əmri pəncərəsi
  dispatch: { open: false, routeId: null, alertId: null, type: 'RESERVE_RELEASE', params: {}, text: '' },
  // Yeni xəbərdarlıq banneri
  banner: null,
}

const operatorSlice = createSlice({
  name: 'operator',
  initialState,
  reducers: {
    selectRoute: (state, action) => {
      state.selectedRouteId = action.payload
    },
    selectAlert: (state, action) => {
      const alert = action.payload
      state.selectedAlertId = alert?._id || null
      if (alert?.route?._id) state.selectedRouteId = alert.route._id
    },
    toggleLayer: (state, action) => {
      state.layers[action.payload] = !state.layers[action.payload]
      try {
        localStorage.setItem('st_layers', JSON.stringify(state.layers))
      } catch {
        /* ignore */
      }
    },
    setShortcutsOpen: (state, action) => {
      state.shortcutsOpen = action.payload
    },
    openDispatch: (state, action) => {
      state.dispatch = { ...initialState.dispatch, ...action.payload, open: true }
    },
    closeDispatch: (state) => {
      state.dispatch = { ...initialState.dispatch }
    },
    showBanner: (state, action) => {
      state.banner = action.payload
    },
    hideBanner: (state) => {
      state.banner = null
    },
  },
})

export const {
  selectRoute,
  selectAlert,
  toggleLayer,
  setShortcutsOpen,
  openDispatch,
  closeDispatch,
  showBanner,
  hideBanner,
} = operatorSlice.actions
export default operatorSlice.reducer
