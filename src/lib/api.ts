/**
 * Cliente HTTP mínimo para la API local.
 *
 * - Envía siempre la cookie de sesión (`credentials: same-origin`).
 * - No cachea documentos.
 * - Convierte respuestas de error en `ErrorApi` con el código del servidor.
 */
export class ErrorApi extends Error {
  readonly codigo: string
  readonly estado: number

  constructor(codigo: string, estado: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.codigo = codigo
    this.estado = estado
  }
}

/** La sesión falta o caducó: la interfaz debe volver a la pantalla de cuenta. */
export function esErrorNoAutenticado(error: unknown): boolean {
  return error instanceof ErrorApi && error.estado === 401
}

/** Usa el mensaje en español del servidor y deja un texto de respaldo. */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  return error instanceof ErrorApi ? error.message : porDefecto
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

export async function solicitarJson<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<T> {
  const cabeceras = new Headers(opciones.headers)

  if (opciones.body !== undefined && !cabeceras.has('Content-Type')) {
    cabeceras.set('Content-Type', 'application/json')
  }

  let respuesta: Response

  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      headers: cabeceras,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ErrorApi(
      'sin_conexion',
      0,
      'No se pudo conectar con el servidor. Comprueba que esté en marcha e inténtalo de nuevo.',
    )
  }

  let datos: unknown = null

  try {
    datos = await respuesta.json()
  } catch {
    if (respuesta.ok) {
      throw new ErrorApi(
        'respuesta_invalida',
        respuesta.status,
        'El servidor devolvió una respuesta que no se pudo interpretar.',
      )
    }
  }

  if (!respuesta.ok) {
    const codigo =
      esObjeto(datos) && typeof datos.codigo === 'string'
        ? datos.codigo
        : 'error_interno'
    const mensaje =
      esObjeto(datos) && typeof datos.mensaje === 'string'
        ? datos.mensaje
        : 'Ocurrió un error en el servidor. Inténtalo de nuevo.'

    throw new ErrorApi(codigo, respuesta.status, mensaje)
  }

  return datos as T
}
