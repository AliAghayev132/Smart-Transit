import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SEO } from '@components'

export const NotFoundPage = () => {
  const { t } = useTranslation('operator')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <SEO title={t('notFound.seo')} noindex />
      <p className="text-hero text-brand">404</p>
      <h1 className="mt-5 text-title text-ink">{t('notFound.title')}</h1>
      <p className="mt-2 max-w-md text-ink-soft">{t('notFound.text')}</p>
      <Link to="/" className="mt-7 inline-flex h-12 items-center rounded-full bg-brand px-6 font-bold text-on-brand transition-[filter] hover:brightness-110">
        {t('notFound.home')}
      </Link>
    </div>
  )
}
