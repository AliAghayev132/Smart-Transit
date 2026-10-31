// Routes
import { AppRouter } from '@routes'

// Styles
import 'leaflet/dist/leaflet.css'
import './App.css'

// Redux
import { store } from '@store'
import { Provider } from 'react-redux'

// SEO
import { HelmetProvider } from 'react-helmet-async'

// Contexts
import { SocketProvider, ThemeProvider, MapEngineProvider, TransitLiveProvider } from '@store/context'

// Provider order: SEO -> Redux -> Theme -> Socket (needs Redux auth) -> realtime state
// -> Map engine (Google / Leaflet fallback) -> Router
export const App = () => {
  return (
    <HelmetProvider>
      <Provider store={store}>
        <ThemeProvider>
          <SocketProvider>
            <TransitLiveProvider>
              <MapEngineProvider>
                <AppRouter />
              </MapEngineProvider>
            </TransitLiveProvider>
          </SocketProvider>
        </ThemeProvider>
      </Provider>
    </HelmetProvider>
  )
}
