import type { TipoDocumentoId } from './tiposDocumento'
import { obtenerTipoDocumento } from './tiposDocumento'
import type { Observacion, SeccionRevision } from './revisionTipos'
import {
  detectarSeccion,
  esSeveridad,
  ETIQUETAS_SECCION,
  ETIQUETAS_TIPO_PROBLEMA,
  LIMITE_CARACTERES_TEXTO,
  TIPOS_PROBLEMA,
} from './revisionTipos'

export type AutorMensaje = 'usuario' | 'tutor'

/**
 * `bienvenida` y `aviso` permiten que la interfaz distinga los mensajes
 * automáticos del tutor sin depender de su texto. `bienvenida` también se usa
 * para actualizar el saludo cuando cambia el tipo antes de conversar.
 * `revision` identifica las tarjetas con una observación estructurada.
 */
export type VarianteMensaje = 'normal' | 'bienvenida' | 'aviso' | 'revision'

export type MensajeChat = {
  id: string
  autor: AutorMensaje
  texto: string
  creadoEn: string
  variante: VarianteMensaje
  observacion?: Observacion
  /**
   * Agrupa los mensajes que devolvió una misma revisión. Los resaltados del
   * editor salen solo de la última revisión; las tarjetas anteriores quedan
   * como historial sin pintar el documento. Los errores no llevan este campo.
   */
  idRevision?: string
  /**
   * ID persistente del bloque al que se refiere la observación. Se resuelve
   * en el momento de la petición, con la misma lista de bloques que se envió al
   * backend. `null` si no se pudo resolver.
   */
  parrafoId?: string | null
}

export type PeticionTutor = {
  mensaje: string
  tipoDocumento: TipoDocumentoId
  texto: string
}

export type RespuestaTutor = {
  seccion: SeccionRevision
  observaciones: Observacion[]
}

export class ErrorTutor extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorTutor'
  }
}

const TIEMPO_MAXIMO_REVISION_MS = 60_000
const TIPOS_PROBLEMA_VALIDOS = new Set<string>(TIPOS_PROBLEMA)

function crearMensaje(
  autor: AutorMensaje,
  texto: string,
  variante: VarianteMensaje = 'normal',
): MensajeChat {
  return {
    id: crypto.randomUUID(),
    autor,
    texto,
    creadoEn: new Date().toISOString(),
    variante,
  }
}

export function crearMensajeUsuario(texto: string): MensajeChat {
  return crearMensaje('usuario', texto)
}

export function crearMensajeTutor(texto: string): MensajeChat {
  return crearMensaje('tutor', texto)
}

export function crearMensajeDocumentoVacio(): MensajeChat {
  return crearMensajeTutor(
    'Tu documento está vacío. Escribe al menos un párrafo antes de pedir una revisión.',
  )
}

export function crearMensajeTextoLargo(): MensajeChat {
  return crearMensajeTutor(
    `El texto es demasiado largo para una revisión (máximo ${LIMITE_CARACTERES_TEXTO.toLocaleString('es-ES')} caracteres). Divide el documento o revisa una sección más corta.`,
  )
}

export function crearMensajeObservacion(
  observacion: Observacion,
  idsParrafos: readonly (string | null)[] = [],
  idRevision: string = crypto.randomUUID(),
): MensajeChat {
  const texto = `Párrafo ${observacion.parrafo_id} · ${ETIQUETAS_TIPO_PROBLEMA[observacion.tipo_problema]}\n${observacion.observacion}\nPregunta guía: ${observacion.pregunta_guia}`

  return {
    ...crearMensaje('tutor', texto, 'revision'),
    idRevision,
    observacion,
    parrafoId: idsParrafos[observacion.parrafo_id - 1] ?? null,
  }
}

/**
 * Convierte la salida del backend en mensajes del chat. Una revisión sin
 * problemas no inventa observaciones: lo dice con un mensaje normal.
 *
 * `idsParrafos` es la foto tomada al enviar la petición: el índice
 * `parrafo_id - 1` del servidor corresponde al mismo bloque del cliente.
 *
 * Todos los mensajes de la respuesta comparten `idRevision`, incluido el de
 * «sin problemas», para que el editor sepa cuál es la revisión más reciente.
 */
export function crearMensajesRevision(
  seccion: SeccionRevision,
  observaciones: Observacion[],
  idsParrafos: readonly (string | null)[] = [],
): MensajeChat[] {
  const idRevision = crypto.randomUUID()

  if (observaciones.length === 0) {
    return [
      {
        ...crearMensajeTutor(
          `Revisé ${ETIQUETAS_SECCION[seccion]} y no encontré problemas de estructura o coherencia. Si quieres, puedo revisar otra parte.`,
        ),
        idRevision,
      },
    ]
  }

  return observaciones.map((observacion) =>
    crearMensajeObservacion(observacion, idsParrafos, idRevision),
  )
}

export function crearMensajeBienvenida(
  tipoDocumento: TipoDocumentoId,
): MensajeChat {
  const { nombre } = obtenerTipoDocumento(tipoDocumento)

  return crearMensaje(
    'tutor',
    `Hola, soy tu tutor. Puedo revisar la estructura y la coherencia de tu ${nombre} y darte observaciones sin reescribir tu texto. Puedes empezar con «Revisa mi introducción».`,
    'bienvenida',
  )
}

export function crearAvisoCambioTipo(
  tipoDocumento: TipoDocumentoId,
): MensajeChat {
  const { nombre } = obtenerTipoDocumento(tipoDocumento)

  return crearMensaje(
    'tutor',
    `Tipo de documento actualizado a «${nombre}». Tendré en cuenta sus criterios en la próxima revisión.`,
    'aviso',
  )
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

function esCadenaOpcional(valor: unknown): boolean {
  return valor === undefined || (typeof valor === 'string' && valor.length > 0)
}

function esObservacion(valor: unknown): valor is Observacion {
  if (!esObjeto(valor)) return false

  return (
    typeof valor.parrafo_id === 'number' &&
    Number.isInteger(valor.parrafo_id) &&
    valor.parrafo_id > 0 &&
    typeof valor.tipo_problema === 'string' &&
    TIPOS_PROBLEMA_VALIDOS.has(valor.tipo_problema) &&
    typeof valor.observacion === 'string' &&
    valor.observacion.length > 0 &&
    typeof valor.pregunta_guia === 'string' &&
    valor.pregunta_guia.length > 0 &&
    esCadenaOpcional(valor.criterio_id) &&
    (valor.severidad === undefined || esSeveridad(valor.severidad)) &&
    esCadenaOpcional(valor.origen)
  )
}

function esRespuestaRevision(
  datos: Record<string, unknown>,
): datos is Record<string, unknown> & { observaciones: unknown[] } {
  return (
    Array.isArray(datos.observaciones) &&
    (datos.mapa === undefined || esObjeto(datos.mapa)) &&
    (datos.metricas === undefined || esObjeto(datos.metricas))
  )
}

function mensajeDeError(estado: number, datos: unknown): string {
  const codigo =
    esObjeto(datos) && typeof datos.codigo === 'string' ? datos.codigo : null

  switch (codigo) {
    case 'texto_vacio':
      return 'Tu documento está vacío. Escribe al menos un párrafo antes de pedir una revisión.'
    case 'texto_demasiado_largo':
      return `El texto es demasiado largo para una revisión (máximo ${LIMITE_CARACTERES_TEXTO.toLocaleString('es-ES')} caracteres). Divide el documento o revisa una sección más corta.`
    case 'cuota_agotada':
      return 'Se agotó la cuota gratuita de Gemini o hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.'
    case 'configuracion':
      return 'El tutor no está configurado correctamente. Revisa GEMINI_API_KEY y GEMINI_MODEL en el servidor.'
    case 'respuesta_invalida':
      return 'El tutor devolvió una respuesta que no pude interpretar. Inténtalo de nuevo.'
    case 'servicio_no_disponible':
      return 'El servicio de Gemini está experimentando mucha demanda. Inténtalo de nuevo en unos minutos.'
    case 'tiempo_agotado':
      return 'La revisión tardó demasiado. Inténtalo de nuevo.'
    case 'sin_conexion':
      return 'No se pudo conectar con el tutor. Comprueba que el servidor esté en marcha e inténtalo de nuevo.'
    case 'api_gemini':
      return 'La API de Gemini no pudo completar la revisión. Inténtalo de nuevo.'
    case 'peticion_invalida':
      return 'La solicitud de revisión no es válida. Recarga la página e inténtalo de nuevo.'
    case 'error_interno':
      return 'Ocurrió un error en el servidor del tutor. Inténtalo de nuevo.'
  }

  if (estado === 413) {
    return `El texto es demasiado largo para una revisión (máximo ${LIMITE_CARACTERES_TEXTO.toLocaleString('es-ES')} caracteres).`
  }
  if (estado === 429) {
    return 'Se agotó la cuota gratuita de Gemini o hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.'
  }
  if (estado >= 500) {
    return 'No se pudo conectar con el tutor. Comprueba que el servidor esté en marcha e inténtalo de nuevo.'
  }
  if (estado === 400) {
    return 'La solicitud de revisión no es válida. Recarga la página e inténtalo de nuevo.'
  }

  return 'No se pudo obtener la revisión. Inténtalo de nuevo.'
}

/**
 * Pide una revisión al backend. El editor solo se lee: esta función no recibe
 * el editor ni puede modificar el documento. Gemini nunca se llama desde aquí.
 */
export async function responderTutor({
  mensaje,
  tipoDocumento,
  texto,
}: PeticionTutor): Promise<RespuestaTutor> {
  const seccion = detectarSeccion(mensaje)
  let respuesta: Response

  try {
    respuesta = await fetch('/api/revisar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, tipoDocumento, seccion }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_REVISION_MS),
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new ErrorTutor('La revisión tardó demasiado. Inténtalo de nuevo.')
    }

    throw new ErrorTutor(
      'No se pudo conectar con el tutor. Comprueba que el servidor esté en marcha e inténtalo de nuevo.',
    )
  }

  let datos: unknown = null
  try {
    datos = await respuesta.json()
  } catch {
    datos = null
  }

  if (!respuesta.ok) {
    throw new ErrorTutor(mensajeDeError(respuesta.status, datos))
  }

  if (!esObjeto(datos) || !esRespuestaRevision(datos)) {
    throw new ErrorTutor(
      'El tutor devolvió una respuesta que no pude interpretar. Inténtalo de nuevo.',
    )
  }

  const observaciones: Observacion[] = []
  for (const observacion of datos.observaciones) {
    if (!esObservacion(observacion)) {
      throw new ErrorTutor(
        'El tutor devolvió una respuesta que no pude interpretar. Inténtalo de nuevo.',
      )
    }
    observaciones.push(observacion)
  }

  return { seccion, observaciones }
}
