// Redux Toolkit
import { configureStore } from '@reduxjs/toolkit'

// API
import { baseApi } from './api/baseApi'
import i18n from '@/lib/i18n'

// Slices
import authReducer from './slices/authSlice'
import operatorReducer from './slices/operatorSlice'

// ============ STORE ============
export const store = configureStore({
  reducer: {
    // RTK Query cache reducer
    [baseApi.reducerPath]: baseApi.reducer,
    // Auth state (localStorage-backed)
    auth: authReducer,
    // Operator paneli UI vəziyyəti
    operator: operatorReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
})

// Dil dəyişəndə server tərəfindən lokallaşdırılan cavabları (AI xülasə, şablonlar, plan) yenidən istə
i18n.on('languageChanged', () => store.dispatch(baseApi.util.invalidateTags(['Localized'])))
