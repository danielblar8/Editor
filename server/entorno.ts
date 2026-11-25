import type { Usuario } from '../src/lib/cuentasTipos.ts'

/**
 * Variables que el middleware de sesión deja disponibles en el contexto Hono.
 */
export type VariablesApi = {
  usuario: Usuario
}
