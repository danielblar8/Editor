import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { PoolClient } from 'pg'
import { cerrarPool, mensajeErrorConexion, obtenerPool } from '../server/db.ts'
import { ErrorConfiguracion } from '../server/errores.ts'

/**
 * Aplica db/schema.sql con un solo comando: `npm run db:init`.
 *
 * El script es intencionadamente pequeño: no crea la base de datos (eso requiere
 * permisos y datos que no están en DATABASE_URL), pero sí explica cómo crearla
 * cuando PostgreSQL responde 3D000.
 */
async function principal(): Promise<void> {
  const rutaEsquema = fileURLToPath(
    new URL('../db/schema.sql', import.meta.url),
  )

  let sql: string

  try {
    sql = await readFile(rutaEsquema, 'utf8')
  } catch {
    console.error(`No se pudo leer el esquema en ${rutaEsquema}.`)
    process.exitCode = 1
    return
  }

  let cliente: PoolClient | undefined

  try {
    const pool = obtenerPool()
    cliente = await pool.connect()

    try {
      await cliente.query('begin')
      await cliente.query(sql)
      await cliente.query('commit')
      console.log('Esquema aplicado correctamente: usuarios, sesiones y documentos.')
    } catch (error) {
      await cliente.query('rollback').catch(() => {
        // Si la conexión ya se perdió, no hay nada que revertir.
      })
      throw error
    }
  } catch (error) {
    if (error instanceof ErrorConfiguracion) {
      console.error(error.message)
    } else {
      console.error(`No se pudo aplicar el esquema: ${mensajeErrorConexion(error)}`)
      console.error(
        'Comprueba que PostgreSQL esté en marcha, que la base exista y que DATABASE_URL sea correcta.',
      )
    }

    process.exitCode = 1
  } finally {
    cliente?.release()
    await cerrarPool()
  }
}

await principal()
