import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Swal from 'sweetalert2'
import { ArrowLeft, BusFront } from 'lucide-react'

import { SEO, Button, Input, Card, ThemeToggle, LanguageSwitcher } from '@components'
import { useLoginMutation } from '@store/api'
import { setCredentials } from '@store/slices/authSlice'
import { operatorRoles } from '@constants'

/** Dispetçer / operator girişi (operatorlar admin tərəfindən yaradılır, qeydiyyat yoxdur) */
export const LoginPage = () => {
  const { t } = useTranslation('operator')
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const [login, { isLoading }] = useLoginMutation()

  const [form, setForm] = useState({ email: '', password: '' })
  const from = location.state?.from?.pathname || '/dashboard'

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Server envelope: { success, message, data: { user, tokens } }
      const res = await login(form).unwrap()
      if (!operatorRoles.includes(res.data.user.role)) {
        Swal.fire({ icon: 'warning', title: t('login.noAccessTitle'), text: t('login.noAccessText'), confirmButtonText: t('common:actions.close') })
        return
      }
      dispatch(setCredentials(res.data))
      navigate(from, { replace: true })
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('login.failedTitle'), text: err?.data?.message || t('login.failedText'), confirmButtonText: t('common:actions.close') })
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4 py-20">
      <SEO title={t('login.title')} path="/login" noindex />
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md" padding="lg">
        <div className="mb-7">
          <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-black text-ink">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-on-brand">
              <BusFront className="h-5 w-5" />
            </span>
            Smart Transit
          </Link>
          <h1 className="mt-6 text-3xl font-black leading-tight tracking-tight text-ink">{t('login.title')}</h1>
          <p className="mt-1.5 text-ink-soft">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="login-email" label={t('login.email')} type="email" name="email" autoComplete="username" value={form.email} onChange={handleChange} placeholder="operator@example.com" required autoFocus />
          <Input id="login-password" label={t('login.password')} type="password" name="password" autoComplete="current-password" value={form.password} onChange={handleChange} placeholder="••••••••" required />
          <Button type="submit" size="lg" fullWidth disabled={isLoading}>
            {isLoading ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>

        <p className="mt-6 text-sm">
          <Link to="/" className="inline-flex items-center gap-1.5 font-bold text-brand hover:underline">
            <ArrowLeft className="h-4 w-4" /> {t('login.back')}
          </Link>
        </p>
      </Card>
    </div>
  )
}
