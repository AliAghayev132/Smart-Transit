// Only AppRouter is exported here. PublicRouter and DashboardRouter are loaded
// lazily inside AppRouter, so re-exporting them statically would merge them back
// into the main chunk and defeat the code-splitting.
export { AppRouter } from './AppRouter'
