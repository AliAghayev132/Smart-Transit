import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { Modal, Button, Select, Input, Textarea } from '@components/ui'
import { useGetDispatchTemplatesQuery, useCreateDispatchCommandMutation } from '@store/api'
import { toast } from '@utils'

const fill = (tpl, values) =>
  (tpl?.text || '').replace(/\{(\w+)\}/g, (_, k) => (values[k] != null && values[k] !== '' ? String(values[k]) : `{${k}}`)).replace(/\.\./g, '.')

/**
 * Dispetçer əmri şablonları: şablon seç → parametrləri doldur → mətni redaktə et → göndər.
 * Şablonlar serverdən cari dildə gəlir (Accept-Language). Qısa yol: C
 */
export const DispatchModal = ({ state, routes = [], onClose }) => {
  const { t } = useTranslation('operator')
  const { data: templates = [] } = useGetDispatchTemplatesQuery(undefined, { skip: !state.open })
  const [createCommand, { isLoading }] = useCreateDispatchCommandMutation()
  const [form, setForm] = useState(() => ({ routeId: state.routeId || '', type: state.type || 'RESERVE_RELEASE', params: { count: 1, minutes: 30, ...state.params } }))
  const [text, setText] = useState(null)

  const route = routes.find((r) => r.id === form.routeId)
  const tpl = templates.find((x) => x.type === form.type)
  const auto = useMemo(() => fill(tpl, { route: route?.number, ...form.params }), [tpl, route, form.params])

  const setParam = (k, v) => {
    setForm((f) => ({ ...f, params: { ...f.params, [k]: v } }))
    setText(null)
  }

  const submit = async () => {
    try {
      await createCommand({ routeId: form.routeId, alertId: state.alertId, type: form.type, params: form.params, text: text ?? auto }).unwrap()
      toast.success(t('dispatch.sent'))
      onClose()
    } catch (err) {
      toast.error(err?.data?.message || t('dispatch.failed'))
    }
  }

  const routeOptions = routes.map((r) => ({ value: r.id, label: `№${r.number} ${r.name}` }))

  return (
    <Modal isOpen={state.open} onClose={onClose} title={t('dispatch.title')} size="md">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            id="dm-route"
            label={t('dispatch.route')}
            value={form.routeId}
            onChange={(e) => {
              setForm((f) => ({ ...f, routeId: e.target.value }))
              setText(null)
            }}
            placeholder={t('dispatch.chooseRoute')}
            options={routeOptions}
          />
          <Select
            id="dm-template"
            label={t('dispatch.template')}
            value={form.type}
            onChange={(e) => {
              setForm((f) => ({ ...f, type: e.target.value }))
              setText(null)
            }}
            placeholder={t('dispatch.chooseTemplate')}
            options={templates.map((x) => ({ value: x.type, label: x.title || t(`dispatch.types.${x.type}`, { defaultValue: x.type }) }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {tpl?.fields.includes('count') && (
            <Input id="dm-count" label={t('dispatch.count')} type="number" min={1} max={5} value={form.params.count ?? 1} onChange={(e) => setParam('count', Number(e.target.value))} />
          )}
          {tpl?.fields.includes('minutes') && (
            <Input id="dm-minutes" label={t('dispatch.minutes')} type="number" min={5} value={form.params.minutes ?? 30} onChange={(e) => setParam('minutes', Number(e.target.value))} />
          )}
          {tpl?.fields.includes('stop') && (
            <Select
              id="dm-stop"
              label={t('dispatch.stop')}
              value={form.params.stop || ''}
              onChange={(e) => setParam('stop', e.target.value)}
              placeholder={t('dispatch.chooseStop')}
              options={(route?.stops || []).map((s) => ({ value: s.name, label: s.name }))}
            />
          )}
          {tpl?.fields.includes('sourceRoute') && (
            <Select
              id="dm-source"
              label={t('dispatch.sourceRoute')}
              value={form.params.sourceRoute || ''}
              onChange={(e) => setParam('sourceRoute', e.target.value)}
              placeholder={t('dispatch.chooseRoute')}
              options={routes.filter((r) => r.id !== form.routeId).map((r) => ({ value: r.number, label: `№${r.number} ${r.name}` }))}
            />
          )}
        </div>
        <Textarea id="dm-text" label={t('dispatch.text')} rows={4} value={text ?? auto} onChange={(e) => setText(e.target.value)} placeholder={t('dispatch.textPlaceholder')} />
        {tpl?.createsReserve && <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">{t('dispatch.createsReserve')}</p>}
      </div>
      <Modal.Footer className="mt-5">
        <Button variant="secondary" onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>
        <Button onClick={submit} disabled={isLoading || !form.routeId || !(text ?? auto).trim()} leftIcon={<Send className="h-4 w-4" />}>
          {t('dispatch.send')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
