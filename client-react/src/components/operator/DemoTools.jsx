import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import { Button, Select } from '@components/ui'
import { useDemoSurgeMutation, useDemoRandomMutation, useDemoPresenceMutation, useDemoIntentsMutation } from '@store/api'
import { toast } from '@utils'

/** Real data olmadan sistemi sınamaq üçün alətlər (DEMO_ENABLED) */
export const DemoTools = ({ routes = [] }) => {
  const { t } = useTranslation('operator')
  const [routeId, setRouteId] = useState('')
  const [surge] = useDemoSurgeMutation()
  const [random] = useDemoRandomMutation()
  const [presence] = useDemoPresenceMutation()
  const [intents] = useDemoIntentsMutation()

  const run = async (p) => {
    try {
      const r = await p.unwrap()
      toast.success(t('demo.inserted', { count: r.inserted }))
    } catch (err) {
      toast.error(err?.data?.message || t('demo.failed'))
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border-2 border-dashed border-line p-3.5">
      <p className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink-soft">
        <FlaskConical className="h-4 w-4" /> {t('demo.title')}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="secondary" className="h-auto min-h-8 py-1.5" onClick={() => run(random(40))}>
          {t('demo.reports40')}
        </Button>
        <Button size="sm" variant="secondary" className="h-auto min-h-8 py-1.5" onClick={() => run(presence(40))}>
          {t('demo.presence40')}
        </Button>
      </div>
      <Select value={routeId} onChange={(e) => setRouteId(e.target.value)} placeholder={t('demo.chooseRoute')} options={routes.map((r) => ({ value: r.id, label: `№${r.number} ${r.name}` }))} />
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="danger" className="h-auto min-h-8 py-1.5" disabled={!routeId} onClick={() => run(surge({ routeId, count: 5 }))}>
          {t('demo.surge')}
        </Button>
        <Button size="sm" variant="outline" className="h-auto min-h-8 py-1.5" onClick={() => run(intents({ routeId: routeId || undefined, count: 20 }))}>
          {t('demo.intents20')}
        </Button>
      </div>
    </div>
  )
}
