import type { MiddlewareHandler } from 'hono'
import type { VariablesApi } from './entorno.ts'
import { MENSAJES_CUENTA } from '../src/lib/cuentasTipos.ts'
import { leerUsuarioSesion } from './sesiones.ts'

/**
 * Exige una sesión válida para las rutas de documentos.
 *
 * Si no hay cookie o la sesión caducó, responde 401 con un mensaje en español.
 */
export const requerirSesion: MiddlewareHandler<{
  Variables: VariablesApi
}> = async (c, next) => {
  const usuario = await leerUsuarioSesion(c)

  if (!usuario) {
    return c.json(
      {
        ok: false,
        codigo: 'no_autenticado',
        mensaje: MENSAJES_CUENTA.noAutenticado,
      },
      401,
    )
  }

  c.set('usuario', usuario)
  await next()
}
