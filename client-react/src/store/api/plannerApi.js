import { baseApi, unwrap } from './baseApi'

// Marşrut planlayıcı + Yanaşma A (proaktiv tələb) — server /api/plan, /intents, /demand
export const plannerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // POST /plan { from, to, prefer, deviceId } -> { itineraries, google }
    planTrip: builder.query({
      query: (body) => ({ url: '/plan', method: 'POST', body }),
      transformResponse: unwrap,
      providesTags: ['Localized'],
    }),

    // POST /intents — "Gedirəm"
    confirmTrip: builder.mutation({
      query: (body) => ({ url: '/intents', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Demand'],
    }),

    // DELETE /intents/:deviceId
    cancelTrip: builder.mutation({
      query: (deviceId) => ({ url: `/intents/${encodeURIComponent(deviceId)}`, method: 'DELETE' }),
      invalidatesTags: ['Demand'],
    }),

    // GET /demand/nearby?lat&lng&radius&deviceId
    getNearbyDemand: builder.query({
      query: (params) => ({ url: '/demand/nearby', params }),
      transformResponse: unwrap,
      providesTags: ['Demand'],
    }),

    // GET /demand/stops (operator)
    getDemandStops: builder.query({
      query: (params = {}) => ({ url: '/demand/stops', params }),
      transformResponse: unwrap,
      providesTags: ['Demand'],
    }),
  }),
})

export const {
  usePlanTripQuery,
  useConfirmTripMutation,
  useCancelTripMutation,
  useGetNearbyDemandQuery,
  useGetDemandStopsQuery,
} = plannerApi
