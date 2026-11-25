import { serve } from '@hono/node-server'
import { app } from './app.ts'
import { cerrarPool, comprobarConexion } from './db.ts'

const puerto = Number(process.env.PORT ?? '3001')

if (!Number.isInteger(puerto) || puerto <= 0 || puerto > 65_535) {
  console.error('PORT no es válido. Debe ser un número entero entre 1 y 65535.')
  process.exit(1)
}

serve({ fetch: app.fetch, port: puerto }, (info) => {
  console.log(`API del tutor en http://localhost:${info.port}`)
})

// El servidor arranca aunque PostgreSQL no esté disponible: las rutas de
// cuentas y documentos responderán 503 con una pista clara.
comprobarConexion()
  .then(() => {
    console.log('[db] Conexión con PostgreSQL correcta.')
  })
  .catch((error: unknown) => {
    const mensaje =
      error instanceof Error ? error.message : 'Error desconocido de PostgreSQL.'
    console.error(`[db] ${mensaje}`)
  })

async function cerrarServidor(): Promise<void> {
  await cerrarPool().catch(() => {
    // El proceso va a terminar igualmente.
  })
  process.exit(0)
}

process.once('SIGINT', () => {
  void cerrarServidor()
})
process.once('SIGTERM', () => {
  void cerrarServidor()
})
