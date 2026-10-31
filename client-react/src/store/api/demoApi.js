import { baseApi, unwrap } from './baseApi'

// Test/demo alətləri — server /api/demo (DEMO_ENABLED, operator)
export const demoApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    demoSurge: builder.mutation({
      query: (body) => ({ url: '/demo/surge', method: 'POST', body }),
      transformResponse: unwrap,
    }),
    demoRandom: builder.mutation({
      query: (count = 40) => ({ url: '/demo/random', method: 'POST', body: { count } }),
      transformResponse: unwrap,
    }),
    demoPresence: builder.mutation({
      query: (count = 40) => ({ url: '/demo/presence', method: 'POST', body: { count } }),
      transformResponse: unwrap,
    }),
    demoIntents: builder.mutation({
      query: (body) => ({ url: '/demo/intents', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Demand'],
    }),
    getHealth: builder.query({
      query: () => '/health',
      transformResponse: unwrap,
    }),
  }),
})

export const {
  useDemoSurgeMutation,
  useDemoRandomMutation,
  useDemoPresenceMutation,
  useDemoIntentsMutation,
  useGetHealthQuery,
} = demoApi
