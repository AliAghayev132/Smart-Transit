// React
import { lazy, Suspense } from 'react'

// React Router
import { Route, Routes, BrowserRouter } from 'react-router'

// Components
import { PageLoader } from '@components'

// Route groups are lazily loaded so each ships in its own chunk.
const PublicRouter = lazy(() => import('./PublicRouter').then((m) => ({ default: m.PublicRouter })))
const DashboardRouter = lazy(() => import('./DashboardRouter').then((m) => ({ default: m.DashboardRouter })))

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/*" element={<PublicRouter />} />
          <Route path="/dashboard/*" element={<DashboardRouter />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
