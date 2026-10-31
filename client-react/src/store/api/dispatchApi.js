import { baseApi, unwrap } from './baseApi'

// Dispetçer əmrləri və tövsiyələr — server /api/dispatch (operator/admin)
export const dispatchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDispatchTemplates: builder.query({
      query: () => '/dispatch/templates',
      transformResponse: (res) => res.data.templates,
    }),

    // GET /dispatch/recommend/:routeId -> { context, recommendation }
    getDispatchRecommendation: builder.query({
      query: (routeId) => `/dispatch/recommend/${routeId}`,
      transformResponse: unwrap,
    }),

    getDispatchCommands: builder.query({
      query: (params = {}) => ({ url: '/dispatch/commands', params }),
      transformResponse: (res) => res.data.commands,
      providesTags: ['Dispatch'],
    }),

    previewDispatchCommand: builder.mutation({
      query: (body) => ({ url: '/dispatch/preview', method: 'POST', body }),
      transformResponse: (res) => res.data.text,
    }),

    createDispatchCommand: builder.mutation({
      query: (body) => ({ url: '/dispatch/commands', method: 'POST', body }),
      transformResponse: unwrap,
      invalidatesTags: ['Dispatch', { type: 'Alert', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetDispatchTemplatesQuery,
  useGetDispatchRecommendationQuery,
  useGetDispatchCommandsQuery,
  usePreviewDispatchCommandMutation,
  useCreateDispatchCommandMutation,
} = dispatchApi
