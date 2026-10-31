// React Router
import { Route, Routes } from 'react-router'

// Layouts
import { DashboardLayout } from '@layouts'

// Components
import { ProtectedRoute } from '@components'

// Constants
import { operatorRoles } from '@constants'

// Pages
import { MapPage, RoutesPage, AlertsPage, ReportsPage } from '@pages/dashboard'
import { NotFoundPage } from '@pages/public'

export const DashboardRouter = () => (
  <Routes>
    {/* /dashboard/* yalnız operator və admin üçündür */}
    <Route
      path="/"
      element={
        <ProtectedRoute allowedRoles={operatorRoles}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<MapPage />} />
      <Route path="routes" element={<RoutesPage />} />
      <Route path="alerts" element={<AlertsPage />} />
      <Route path="reports" element={<ReportsPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
)
