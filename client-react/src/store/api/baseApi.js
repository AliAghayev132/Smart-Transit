// RTK Query
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// Config
import { API_URL } from '@/lib/variables'
import { currentLang } from '@/lib/i18n'

// ============ BASE QUERY ============
// All endpoints are injected against this base query. It attaches the access
// token from the auth slice unless an Authorization header is already set
// (e.g. a one-off reset token during password reset).
const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    // Server mesajları (xəta, təsdiq, AI cavabı) seçilmiş dildə qaytarılır
    headers.set('Accept-Language', currentLang())
    if (!headers.get('Authorization')) {
      const token = getState().auth?.accessToken
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }
    return headers
  },
})

// ============ REAUTH WRAPPER ============
// On a 401 we attempt a single token refresh using the stored refresh token.
// If refresh succeeds we replay the original request; otherwise we log out.
const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions)

  if (result?.error?.status === 401) {
    const refreshToken = api.getState().auth?.refreshToken

    if (refreshToken) {
      const refreshResult = await baseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          headers: { Authorization: `Bearer ${refreshToken}` },
        },
        api,
        extraOptions
      )

      if (refreshResult?.data) {
        // Server envelope: { success, message, data: { tokens } }
        api.dispatch({
          type: 'auth/setTokens',
          payload: refreshResult.data.data.tokens,
        })
        result = await baseQuery(args, api, extraOptions)
      } else {
        api.dispatch({ type: 'auth/logout' })
      }
    } else {
      api.dispatch({ type: 'auth/logout' })
    }
  }

  return result
}

// ============ API INSTANCE ============
// Endpoints are injected from feature files (authApi, transitApi, alertApi, ...).
// Server envelope: { success, message?, data } — feature endpoints unwrap `data`
// with `transformResponse: unwrap`.
export const unwrap = (res) => res?.data

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  // Localized: server tərəfindən seçilmiş dildə qaytarılan cavablar — dil dəyişəndə yenilənir (store/index.js)
  tagTypes: ['User', 'Auth', 'Route', 'Alert', 'Dispatch', 'Demand', 'Report', 'Localized'],
  endpoints: () => ({}),
})
