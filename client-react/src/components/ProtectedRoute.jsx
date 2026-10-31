// Redux
import { useSelector } from 'react-redux'

// React Router
import { Navigate, useLocation } from 'react-router'

/**
 * Route guard.
 *
 * - Redirects unauthenticated users to the login page.
 * - Optionally restricts access to a set of roles via `allowedRoles`.
 *
 * NOTE: If your app needs a "pending account" flow, add a status check here,
 * e.g. redirect users whose `status === 'pending'` to an onboarding page.
 */
export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, role } = useSelector((state) => state.auth)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return children
}
