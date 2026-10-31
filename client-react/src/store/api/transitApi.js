import { baseApi, unwrap } from './baseApi'

// Xətlər, avtobuslar, ETA, crowdsourcing və analitika — server /api/routes, /reports, /analytics
export const transitApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /routes -> { routes }
    getRoutes: builder.query({
      query: () => '/routes',
      transformResponse: (res) => res.data.routes,
      providesTags: ['Route'],
    }),

    // GET /routes/:id/stops/:stopId/eta?limit -> { stop, arrivals } (hər iki istiqamət)
    getStopEta: builder.query({
      query: ({ routeId, stopId, limit }) => ({ url: `/routes/${routeId}/stops/${stopId}/eta`, params: limit ? { limit } : undefined }),
      transformResponse: unwrap,
    }),

    // GET /analytics/crowd (ilkin yükləmə; sonra socket "crowd:update")
    getCrowd: builder.query({
      query: () => '/analytics/crowd',
      transformResponse: unwrap,
    }),

    // POST /reports — sərnişin sıxlıq bildirişi
    createReport: builder.mutation({
      query: (body) => ({ url: '/reports', method: 'POST', body }),
    }),

    // GET /reports/recent?routeId= (operator)
    getRecentReports: builder.query({
      query: (params = {}) => ({ url: '/reports/recent', params }),
      transformResponse: (res) => res.data.reports,
      providesTags: ['Report'],
    }),

    // GET /analytics/heat?minutes= (operator)
    getHeat: builder.query({
      query: (minutes = 15) => ({ url: '/analytics/heat', params: { minutes } }),
      transformResponse: (res) => res.data.points,
      providesTags: ['Report'],
    }),

    // GET /analytics/forecast/:routeId
    getForecast: builder.query({
      query: (routeId) => `/analytics/forecast/${routeId}`,
      transformResponse: unwrap,
    }),

    // GET /analytics/forecast — bütün xətlər
    getForecastAll: builder.query({
      query: () => '/analytics/forecast',
      transformResponse: (res) => res.data.routes,
    }),

    // GET /analytics/predict — Gemini AI proqnozu (1–2 saat). nonce > 0 → keşi keçərək yenilə
    getPrediction: builder.query({
      query: (nonce = 0) => ({ url: '/analytics/predict', params: nonce ? { refresh: 1, n: nonce } : undefined }),
      transformResponse: unwrap,
      providesTags: ['Localized'],
    }),

    // GET /analytics/timeseries?hours=&bucket=&routeId=
    getTimeseries: builder.query({
      query: (params = {}) => ({ url: '/analytics/timeseries', params }),
      transformResponse: unwrap,
    }),

    // GET /density/live — Yanaşma B ilkin vəziyyət
    getDensityLive: builder.query({
      query: () => '/density/live',
      transformResponse: unwrap,
    }),
  }),
})

export const {
  useGetRoutesQuery,
  useGetStopEtaQuery,
  useGetCrowdQuery,
  useCreateReportMutation,
  useGetRecentReportsQuery,
  useGetHeatQuery,
  useGetForecastQuery,
  useGetForecastAllQuery,
  useGetTimeseriesQuery,
  useGetPredictionQuery,
  useGetDensityLiveQuery,
} = transitApi
