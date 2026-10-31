// Redux Toolkit
import { createSlice } from '@reduxjs/toolkit'

// ============ LOCAL STORAGE HELPERS ============
// Auth state is mirrored into localStorage so a page refresh keeps the session.
const getStoredAuth = () => {
  try {
    const stored = localStorage.getItem('auth')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const persist = (state) => {
  localStorage.setItem(
    'auth',
    JSON.stringify({
      user: state.user,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      role: state.role,
    })
  )
}

const storedAuth = getStoredAuth()

const initialState = {
  user: storedAuth?.user || null,
  accessToken: storedAuth?.accessToken || null,
  refreshToken: storedAuth?.refreshToken || null,
  isAuthenticated: !!storedAuth?.accessToken,
  role: storedAuth?.role || null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Called after login / verify-otp. Server envelope data = { user, tokens }.
    setCredentials: (state, action) => {
      const { user, tokens } = action.payload
      state.user = user
      state.accessToken = tokens.accessToken
      state.refreshToken = tokens.refreshToken
      state.isAuthenticated = true
      state.role = user?.role || null
      persist(state)
    },
    // Called by the reauth wrapper after a successful token refresh.
    setTokens: (state, action) => {
      const { accessToken, refreshToken } = action.payload
      state.accessToken = accessToken
      state.refreshToken = refreshToken
      persist(state)
    },
    // Merge partial user changes (e.g. after updating the profile).
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload }
      state.role = state.user?.role || state.role
      persist(state)
    },
    // Clear everything and drop the persisted session.
    logout: (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.role = null
      localStorage.removeItem('auth')
    },
  },
})

export const { setCredentials, setTokens, updateUser, logout } = authSlice.actions
export default authSlice.reducer
