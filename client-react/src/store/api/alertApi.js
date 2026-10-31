import { baseApi, unwrap } from './baseApi'

// Operator xəbərdarlıqları — server /api/alerts (operator/admin)
export const alertApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /alerts?status=&routeId=
    getAlerts: builder.query({
      query: (params = {}) => ({ url: '/alerts', params }),
      transformResponse: (res) => res.data.alerts,
      providesTags: (result) =>
        result
          ? [...result.map((a) => ({ type: 'Alert', id: a._id })), { type: 'Alert', id: 'LIST' }]
          : [{ type: 'Alert', id: 'LIST' }],
    }),

    // GET /alerts/:id -> { alert, commands }
    getAlert: builder.query({
      query: (id) => `/alerts/${id}`,
      transformResponse: unwrap,
      providesTags: (r, e, id) => [{ type: 'Alert', id }],
    }),

    // GET /alerts/:id/recommendation -> AI izahlı tövsiyə + əmr mətni
    getAlertRecommendation: builder.query({
      query: (id) => `/alerts/${id}/recommendation`,
      transformResponse: unwrap,
    }),

    // PATCH /alerts/:id { action, count?, note? }
    alertAction: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/alerts/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, { id }) => [{ type: 'Alert', id }, { type: 'Alert', id: 'LIST' }, 'Dispatch'],
    }),
  }),
})

export const {
  useGetAlertsQuery,
  useGetAlertQuery,
  useGetAlertRecommendationQuery,
  useLazyGetAlertRecommendationQuery,
  useAlertActionMutation,
} = alertApi
