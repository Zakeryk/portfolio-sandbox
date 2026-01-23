import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

// dev launcher stop handler
function devStopPlugin() {
  return {
    name: 'dev-stop',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/__stop__') {
          fs.writeFileSync('/tmp/fincraft-stop', 'stop')
          res.end('stopping...')
          setTimeout(() => process.exit(0), 500)
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devStopPlugin()],
})
