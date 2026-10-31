import { baseApi, unwrap } from './baseApi'

// AI — server /api/ai. Açar yoxdursa server qayda əsaslı cavab qaytarır (source: "rules").
export const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAiStatus: builder.query({
      query: () => '/ai/status',
      transformResponse: unwrap,
    }),

    // Operator: xətt üzrə AI xülasəsi
    getRouteSummary: builder.query({
      query: (routeId) => `/ai/summary/${routeId}`,
      transformResponse: unwrap,
      providesTags: ['Localized'],
    }),

    // Operator: tövsiyənin izahı + hazır əmr
    getDispatchAdvice: builder.query({
      query: (routeId) => `/ai/dispatch/${routeId}`,
      transformResponse: unwrap,
    }),

    // Sərnişin chatbot-u
    sendChat: builder.mutation({
      query: (messages) => ({ url: '/ai/chat', method: 'POST', body: { messages } }),
      transformResponse: unwrap,
    }),
  }),
})

export const {
  useGetAiStatusQuery,
  useGetRouteSummaryQuery,
  useLazyGetRouteSummaryQuery,
  useGetDispatchAdviceQuery,
  useLazyGetDispatchAdviceQuery,
  useSendChatMutation,
} = aiApi
