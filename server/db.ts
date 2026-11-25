import { Pool } from 'pg'
import type { QueryResult, QueryResultRow } from 'pg'
import { ErrorBaseDatos, ErrorConfiguracion } from './errores.ts'

/**
 * Acceso único a PostgreSQL.
 *
 * El pool se crea de forma perezosa: si `DATABASE_URL` falta o el servicio no
 * está disponible, importar este módulo no tumba el servidor. Las rutas
 * responden con un error claro (`base_datos_no_disponible`) en el momento de
 * usar la base.
 */
let pool: Pool | null = null

function obtenerUrlBaseDatos(): string {
  const url = process.env.DATABASE_URL?.trim()

  if (!url) {
    throw new ErrorConfiguracion(
      'Falta DATABASE_URL en el entorno. Copia .env.example a .env y configura la conexión con PostgreSQL.',
    )
  }

  return url
}

export function obtenerPool(): Pool {
  if (pool) return pool

  pool = new Pool({
    connectionString: obtenerUrlBaseDatos(),
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  })

  pool.on('error', (error) => {
    console.error(
      '[db] Error en una conexión inactiva de PostgreSQL:',
      error.message,
    )
  })

  return pool
}

export function codigoPostgres(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code
  }

  return null
}

export function esCodigoPostgres(error: unknown, codigo: string): boolean {
  return codigoPostgres(error) === codigo
}

const CODIGOS_CONEXION = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  '08001',
  '08006',
  '28000',
  '28P01',
  '3D000',
  '42P01',
  '53300',
  '57P03',
])

function esErrorConexion(error: unknown): boolean {
  const codigo = codigoPostgres(error)
  return codigo !== null && CODIGOS_CONEXION.has(codigo)
}

/**
 * Mensaje público para fallos de conexión. No incluye usuario, contraseña ni
 * la cadena de conexión.
 */
export function mensajeErrorConexion(error: unknown): string {
  switch (codigoPostgres(error)) {
    case '3D000':
      return 'La base de datos indicada en DATABASE_URL no existe. Créala y ejecuta npm run db:init.'
    case '28P01':
    case '28000':
      return 'PostgreSQL rechazó las credenciales de DATABASE_URL. Revisa el usuario y la contraseña.'
    case '42P01':
      return 'Faltan las tablas en la base de datos. Ejecuta npm run db:init para aplicar el esquema.'
    case '53300':
      return 'PostgreSQL ha alcanzado el máximo de conexiones. Cierra otras conexiones e inténtalo de nuevo.'
    case '57P03':
      return 'PostgreSQL todavía no acepta conexiones. Espera unos segundos e inténtalo de nuevo.'
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'EHOSTUNREACH':
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
    case 'EAI_AGAIN':
    case '08001':
    case '08006':
      return 'No se pudo conectar con PostgreSQL. Comprueba que el servicio esté en marcha y que DATABASE_URL sea correcto.'
    default:
      return 'No se pudo acceder a la base de datos. Comprueba DATABASE_URL y el estado de PostgreSQL.'
  }
}

/**
 * Ejecuta una consulta parametrizada y traduce solo los fallos de conexión.
 *
 * Los errores de negocio (por ejemplo, una clave duplicada) se propagan tal
 * cual para que la ruta decida el código y el estado HTTP.
 */
export async function consultar<T extends QueryResultRow>(
  texto: string,
  valores?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await obtenerPool().query<T>(texto, valores)
  } catch (error) {
    if (esErrorConexion(error)) {
      throw new ErrorBaseDatos(mensajeErrorConexion(error))
    }

    throw error
  }
}

/**
 * Comprueba que PostgreSQL responde. Se usa en `/api/salud/db` y al arrancar.
 */
export async function comprobarConexion(): Promise<void> {
  try {
    await obtenerPool().query('select 1')
  } catch (error) {
    if (error instanceof ErrorConfiguracion) throw error
    throw new ErrorBaseDatos(mensajeErrorConexion(error))
  }
}

/**
 * Cierra el pool. Se llama al terminar el servidor o las pruebas.
 */
export async function cerrarPool(): Promise<void> {
  if (!pool) return

  const actual = pool
  pool = null
  await actual.end()
}
