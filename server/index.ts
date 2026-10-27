import { serve } from '@hono/node-server'
import { app } from './app.ts'

const puerto = Number(process.env.PORT ?? '3001')

if (!Number.isInteger(puerto) || puerto <= 0 || puerto > 65_535) {
  console.error('PORT no es válido. Debe ser un número entero entre 1 y 65535.')
  process.exit(1)
}

serve({ fetch: app.fetch, port: puerto }, (info) => {
  console.log(`API del tutor en http://localhost:${info.port}`)
})
