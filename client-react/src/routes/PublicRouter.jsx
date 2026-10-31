// React Router
import { Route, Routes } from 'react-router'

// Layouts
import { PublicLayout } from '@layouts'

// Pages
import { HomePage, LoginPage, NotFoundPage } from '@pages/public'

export const PublicRouter = () => (
  <Routes>
    {/* Sərnişin tətbiqi */}
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} />
    </Route>

    {/* Operator girişi (qeydiyyat yoxdur — operatorları admin yaradır) */}
    <Route path="/login" element={<LoginPage />} />

    {/* 404 */}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
)
