/**
 * Transit Chatbot — sərnişin sual-cavab köməkçisi.
 * Server AI (OpenRouter + tool calling) ilə real-vaxt datanı alətlər vasitəsilə alır;
 * AI açarı yoxdursa qayda əsaslı cavab verir. Cavab dili — seçilmiş interfeys dili.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Send, X, Sparkles } from 'lucide-react'
import { useSendChatMutation, useGetAiStatusQuery } from '@store/api'

export const TransitChatbot = () => {
  const { t } = useTranslation('passenger')
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [sendChat, { isLoading }] = useSendChatMutation()
  const { data: ai } = useGetAiStatusQuery(undefined, { skip: !open })
  const endRef = useRef(null)
  const suggestions = t('chat.suggestions', { returnObjects: true })

  // Qeyd: yeni brauzerlərdə scrollIntoView Promise qaytarır — effekt heç nə qaytarmamalıdır
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || isLoading) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    try {
      const res = await sendChat(next.filter((m) => !m.error).map(({ role, content: c }) => ({ role, content: c }))).unwrap()
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, source: res.source }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: err?.data?.message || t('chat.failed'), error: true }])
    }
  }

  const bubble = (m) =>
    clsx(
      'max-w-[85%] whitespace-pre-line rounded-[20px] px-3.5 py-2.5 text-sm font-semibold leading-relaxed',
      m.role === 'user'
        ? 'rounded-br-md bg-brand text-on-brand'
        : m.error
          ? 'rounded-bl-md bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-surface))] text-danger'
          : 'rounded-bl-md bg-raised text-ink'
    )

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed right-3 top-[72px] z-[1200] grid h-12 w-12 place-items-center rounded-full bg-brand text-on-brand shadow-float transition-transform hover:-translate-y-0.5 lg:bottom-5 lg:right-5 lg:top-auto lg:h-14 lg:w-14"
        aria-label={open ? t('common:actions.close') : t('chat.open')}
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t('chat.title')}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 bottom-3 top-[132px] z-[1200] flex flex-col overflow-hidden rounded-sheet bg-surface text-ink shadow-float lg:inset-x-auto lg:bottom-24 lg:right-5 lg:top-auto lg:h-[min(540px,calc(100dvh-8rem))] lg:w-[390px]"
          >
            <div className="px-5 pb-3 pt-4">
              <p className="text-lg font-black">{t('chat.title')}</p>
              <p className="flex items-center gap-1 text-xs font-bold text-ink-soft">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {ai?.enabled ? t('chat.aiMode', { model: ai.model }) : t('chat.rulesMode')}
              </p>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-3" aria-live="polite">
              <div className="flex justify-start">
                <div className={bubble({ role: 'assistant' })}>{t('chat.greeting')}</div>
              </div>
              {messages.map((m, i) => (
                <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={bubble(m)}>{m.content}</div>
                </div>
              ))}
              {isLoading && <div className="w-16 rounded-[20px] bg-raised px-3 py-2 text-sm text-ink-faint">…</div>}
              <div ref={endRef} />
            </div>
            {messages.length === 0 && Array.isArray(suggestions) && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full bg-raised px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-brand">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex gap-2 border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chat.placeholder')}
                aria-label={t('chat.placeholder')}
                className="h-11 min-w-0 flex-1 rounded-full bg-raised px-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-brand/20"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label={t('common:actions.send')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
