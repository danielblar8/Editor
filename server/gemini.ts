import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  APICallError,
  NoObjectGeneratedError,
  Output,
  TypeValidationError,
  generateText,
} from 'ai'
import type { TipoDocumentoId } from '../src/lib/tiposDocumento.ts'
import type {
  Observacion,
  SeccionRevision,
} from '../src/lib/revisionTipos.ts'
import { esquemaObservacion, esquemaObservaciones } from './esquema.ts'
import { construirPromptRevision } from './prompts.ts'

export type EstadoErrorRevision = 400 | 413 | 429 | 500 | 502 | 503 | 504

export class ErrorRevision extends Error {
  readonly codigo: string
  readonly estado: EstadoErrorRevision

  constructor(
    codigo: string,
    estado: EstadoErrorRevision,
    mensaje: string,
    options?: { cause?: unknown },
  ) {
    super(mensaje, options)
    this.name = 'ErrorRevision'
    this.codigo = codigo
    this.estado = estado
  }
}

function leerVariable(nombre: string): string {
  const valor = process.env[nombre]?.trim()
  if (!valor) {
    throw new ErrorRevision(
      'configuracion',
      500,
      `Falta la variable de entorno ${nombre} en el servidor. Revisa el archivo .env (toma como referencia .env.example).`,
    )
  }
  return valor
}

function dividirParrafos(texto: string): string[] {
  return texto
    .split(/\r?\n\s*\r?\n/)
    .map((parrafo) => parrafo.trim())
    .filter((parrafo) => parrafo.length > 0)
}

function traducirError(error: unknown): ErrorRevision {
  if (error instanceof ErrorRevision) return error

  if (
    NoObjectGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error)
  ) {
    return new ErrorRevision(
      'respuesta_invalida',
      502,
      'El tutor devolvió una respuesta que no cumple el esquema esperado. Inténtalo de nuevo.',
      { cause: error },
    )
  }

  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      return new ErrorRevision(
        'cuota_agotada',
        429,
        'Se agotó la cuota gratuita de Gemini o hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
        { cause: error },
      )
    }

    if (
      error.statusCode === 400 ||
      error.statusCode === 401 ||
      error.statusCode === 403 ||
      error.statusCode === 404
    ) {
      console.error(
        `[gemini] Error de configuración o modelo (${error.statusCode ?? 'sin estado'}).`,
      )
      return new ErrorRevision(
        'configuracion',
        500,
        'El tutor no está configurado correctamente. Revisa GEMINI_API_KEY y GEMINI_MODEL en el servidor.',
        { cause: error },
      )
    }

    if (
      error.statusCode === 500 ||
      error.statusCode === 502 ||
      error.statusCode === 503 ||
      error.statusCode === 504
    ) {
      console.error(
        `[gemini] Servicio no disponible (${error.statusCode ?? 'sin estado'}).`,
      )
      return new ErrorRevision(
        'servicio_no_disponible',
        503,
        'El servicio de Gemini está experimentando mucha demanda. Inténtalo de nuevo en unos minutos.',
        { cause: error },
      )
    }

    console.error(
      `[gemini] Error de API (${error.statusCode ?? 'sin estado'}).`,
    )
    return new ErrorRevision(
      'api_gemini',
      502,
      'La API de Gemini no pudo completar la revisión. Inténtalo de nuevo.',
      { cause: error },
    )
  }

  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    console.error('[gemini] Tiempo de espera agotado.')
    return new ErrorRevision(
      'tiempo_agotado',
      504,
      'La revisión tardó demasiado. Inténtalo de nuevo.',
      { cause: error },
    )
  }

  console.error('[gemini] Error inesperado al llamar a Gemini.')
  return new ErrorRevision(
    'sin_conexion',
    503,
    'No se pudo conectar con Gemini. Comprueba la conexión e inténtalo de nuevo.',
    { cause: error },
  )
}

export async function revisarConGemini({
  texto,
  tipoDocumento,
  seccion,
}: {
  texto: string
  tipoDocumento: TipoDocumentoId
  seccion: SeccionRevision
}): Promise<Observacion[]> {
  const apiKey = leerVariable('GEMINI_API_KEY')
  const modelo = leerVariable('GEMINI_MODEL')
  const parrafos = dividirParrafos(texto)

  console.log(
    `[revisar] Inicio modelo=${modelo} tipo=${tipoDocumento} seccion=${seccion} parrafos=${parrafos.length} caracteres=${texto.length}`,
  )

  const proveedor = createGoogleGenerativeAI({ apiKey })
  const { system, prompt } = construirPromptRevision({
    tipoDocumento,
    seccion,
    parrafos,
  })

  let resultado
  try {
    resultado = await generateText({
      model: proveedor(modelo),
      system,
      prompt,
      output: Output.array({
        element: esquemaObservacion,
        name: 'observaciones',
        description:
          'Lista de problemas de estructura y coherencia detectados en el documento.',
      }),
      temperature: 0.2,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(45_000),
    })
  } catch (error) {
    throw traducirError(error)
  }

  // Validación local redundante: el SDK ya valida, pero la API nunca devuelve
  // datos que no hayan pasado por Zod.
  const validacion = esquemaObservaciones.safeParse(resultado.output)
  if (!validacion.success) {
    throw new ErrorRevision(
      'respuesta_invalida',
      502,
      'El tutor devolvió una respuesta que no cumple el esquema esperado. Inténtalo de nuevo.',
      { cause: validacion.error },
    )
  }

  const observaciones = validacion.data
  const fueraDeRango = observaciones.filter(
    (observacion) =>
      observacion.parrafo_id < 1 || observacion.parrafo_id > parrafos.length,
  )

  if (fueraDeRango.length > 0) {
    throw new ErrorRevision(
      'respuesta_invalida',
      502,
      'El tutor citó párrafos que no existen en el documento. Inténtalo de nuevo.',
    )
  }

  console.log(`[revisar] Completado observaciones=${observaciones.length}`)

  return observaciones
}
