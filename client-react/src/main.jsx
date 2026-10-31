// i18n ilk yüklənməlidir (dil + <html lang>)
import '@/lib/i18n'
import { createRoot } from 'react-dom/client'
import { App } from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
