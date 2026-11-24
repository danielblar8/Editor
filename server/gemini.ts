import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  APICallError,
  NoObjectGeneratedError,
  Output,
  TypeValidationError,
  generateText,
} from 'ai'
import type { SeccionRevision } from '../src/lib/revisionTipos.ts'
import {
  LIMITE_CARACTERES_TEXTO,
  PREGUNTAS_GUIA_FIJAS,
} from '../src/lib/revisionTipos.ts'
import type { TipoDocumentoId } from '../src/lib/tiposDocumento.ts'
import type { MapaDocumento } from './esquemaMapa.ts'
import {
  esquemaSalidaMapa,
  esquemaSalidaObservaciones,
  esquemaSalidaUnica,
} from './esquemaMapa.ts'
import {
  ETIQUETAS_ORIGEN_OBSERVACION,
  type ObservacionConOrigen,
  type ObservacionValidada,
  type OrigenObservacion,
} from './esquema.ts'
import { construirPromptMapa, construirPromptRevision } from './prompts.ts'
import type { MetricasDocumento } from './metricas.ts'
import { calcularMetricas } from './metricas.ts'
import { idsCriterios } from './rubricas/indice.ts'
import { ejecutarConReintento } from './reintento.ts'
import {
  CRITERIO_ESTRUCTURA_BASE,
  CRITERIO_ESTRUCTURA_DESARROLLO,
  CRITERIO_ESTRUCTURA_INCOMPLETO,
  LIMITE_CARACTERES_SECCION_PROMPT,
  MAX_LLAMADAS_POR_REVISION,
  REINTENTOS_POR_LLAMADA,
  TIEMPO_MAPA_MS,
  TIEMPO_TOTAL_SERVIDOR_MS,
} from './umbrales.ts'
import {
  crearObservacionDocumentoIncompleto,
  deduplicarObservaciones,
  normalizarMapa,
  tokensDe,
  verificarDocumento,
  type ObservacionDeterminista,
} from './verificacion.ts'

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

export type UsoGemini = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type ResultadoRevision = {
  observaciones: ObservacionConOrigen[]
  mapa: MapaDocumento
  metricas: MetricasDocumento
  uso?: UsoGemini
}

const EXPRESION_PREGUNTA_PROHIBIDA = /redact|escrib|reescrib|reformul/i

export function debeOmitirModelo({
  tipoDocumento,
  seccion,
  totalParrafos,
  sinEstructura,
}: {
  tipoDocumento: TipoDocumentoId
  seccion: SeccionRevision
  totalParrafos: number
  sinEstructura: boolean
}): boolean {
  return (
    seccion === 'documento' &&
    tipoDocumento !== 'texto-abierto' &&
    (totalParrafos < 3 || sinEstructura)
  )
}

export function corregirPreguntasGuia(
  observaciones: ObservacionValidada[],
): ObservacionValidada[] {
  return observaciones.map((observacion) =>
    EXPRESION_PREGUNTA_PROHIBIDA.test(observacion.pregunta_guia)
      ? {
          ...observacion,
          pregunta_guia: PREGUNTAS_GUIA_FIJAS[observacion.tipo_problema],
        }
      : observacion,
  )
}

function construirMapaDeterminista(parrafos: string[]): MapaDocumento {
  const texto = parrafos[0]?.trim() ?? ''
  const resumen = texto.length > 200 ? `${texto.slice(0, 197)}…` : texto
  const tesis =
    resumen.length > 0 ? resumen : 'No se identifica una tesis en el texto.'
  const secciones: MapaDocumento['secciones'] =
    parrafos.length > 0
      ? [
          {
            id: 'introduccion',
            rol: 'Parte inicial del documento.',
            idea_principal: tesis,
            ideas_clave: [],
            parrafos: [1],
          },
        ]
      : []

  return { tesis_o_objetivo: tesis, secciones, ideas_anunciadas: [] }
}

function formatearOrigenes(
  observaciones: ObservacionConOrigen[],
): string {
  return observaciones
    .map(
      (observacion) =>
        `${observacion.parrafo_id}:${observacion.tipo_problema}:${ETIQUETAS_ORIGEN_OBSERVACION[observacion.origen]}`,
    )
    .join(' | ')
}

function sumarUso(a: UsoGemini, b: UsoGemini): UsoGemini {
  return {
    inputTokens:
      a.inputTokens !== undefined && b.inputTokens !== undefined
        ? a.inputTokens + b.inputTokens
        : undefined,
    outputTokens:
      a.outputTokens !== undefined && b.outputTokens !== undefined
        ? a.outputTokens + b.outputTokens
        : undefined,
    totalTokens:
      a.totalTokens !== undefined && b.totalTokens !== undefined
        ? a.totalTokens + b.totalTokens
        : undefined,
  }
}

function numerosParrafosSeccion(
  mapa: MapaDocumento,
  seccion: SeccionRevision,
  totalParrafos: number,
): number[] {
  if (seccion === 'documento') {
    return Array.from({ length: totalParrafos }, (_, indice) => indice + 1)
  }

  const numeros = mapa.secciones.find((item) => item.id === seccion)?.parrafos ?? []
  const validos = [...new Set(numeros)]
    .filter((numero) => numero >= 1 && numero <= totalParrafos)
    .sort((a, b) => a - b)

  if (validos.length > 0) return validos
  return seccion === 'introduccion' ? [1] : [totalParrafos]
}

function recortarParrafos(
  parrafos: string[],
  numeros: number[],
  limite: number,
): { textos: string[]; numeros: number[]; recortado: boolean } {
  let consumidos = 0
  const textos: string[] = []
  const numerosSalida: number[] = []

  for (const numero of numeros) {
    const texto = parrafos[numero - 1] ?? ''

    if (consumidos + texto.length > limite) {
      textos.push('[TEXTO RECORTADO]')
      numerosSalida.push(numero)
      return { textos, numeros: numerosSalida, recortado: true }
    }

    textos.push(texto)
    numerosSalida.push(numero)
    consumidos += texto.length
  }

  return { textos, numeros: numerosSalida, recortado: false }
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

export function dividirParrafos(texto: string): string[] {
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

export async function ejecutarConTraduccion<T>(
  accion: () => Promise<T>,
): Promise<T> {
  try {
    return await accion()
  } catch (error) {
    throw traducirError(error)
  }
}

function limpiarCriterio(
  observacion: ObservacionValidada,
  tipoDocumento: TipoDocumentoId,
): ObservacionValidada {
  if (!observacion.criterio_id) return observacion

  const permitidos = new Set([
    ...idsCriterios(tipoDocumento),
    CRITERIO_ESTRUCTURA_BASE,
    CRITERIO_ESTRUCTURA_DESARROLLO,
    CRITERIO_ESTRUCTURA_INCOMPLETO,
  ])

  if (permitidos.has(observacion.criterio_id)) return observacion

  return { ...observacion, criterio_id: undefined }
}

export function reanclarIdeasNoRetomadas(
  observaciones: ObservacionValidada[],
  mapa: MapaDocumento,
  totalParrafos: number,
): ObservacionValidada[] {
  const ideas = normalizarMapa(mapa, totalParrafos).ideas_anunciadas
  if (ideas.length === 0) return observaciones

  const primera = [...ideas].sort((a, b) => a.parrafo - b.parrafo)[0]!

  return observaciones.map((observacion) => {
    if (observacion.tipo_problema !== 'idea_no_retomada') return observacion

    const tokensObservacion = tokensDe(
      `${observacion.observacion} ${observacion.pregunta_guia}`,
    )
    let mejorIdea = primera
    let mejorPuntaje = -1

    for (const idea of ideas) {
      const tokensIdea = tokensDe(idea.idea)
      if (tokensIdea.size === 0) continue

      let coincidencias = 0
      for (const token of tokensIdea) {
        if (tokensObservacion.has(token)) coincidencias += 1
      }

      const puntaje = coincidencias / tokensIdea.size
      if (puntaje > mejorPuntaje) {
        mejorIdea = idea
        mejorPuntaje = puntaje
      }
    }

    return { ...observacion, parrafo_id: mejorIdea.parrafo }
  })
}

function claveOrigen(
  observacion: ObservacionValidada,
): string {
  return `${observacion.parrafo_id}|${observacion.tipo_problema}`
}

export function fusionarObservaciones({
  delModelo,
  verificaciones,
  tipoDocumento,
  totalParrafos,
  observacionAutoritativa,
}: {
  delModelo: ObservacionValidada[]
  verificaciones: ObservacionValidada[]
  tipoDocumento: TipoDocumentoId
  totalParrafos: number
  observacionAutoritativa?: ObservacionDeterminista
}): ObservacionConOrigen[] {
  if (observacionAutoritativa) {
    return [{ ...observacionAutoritativa, origen: 'codigo' }]
  }

  const modelo = delModelo.map((observacion) =>
    limpiarCriterio(observacion, tipoDocumento),
  )
  const clavesModelo = new Set(modelo.map(claveOrigen))
  const clavesCodigo = new Set(verificaciones.map(claveOrigen))

  const origenPara = (
    observacion: ObservacionValidada,
    origen: OrigenObservacion,
  ): OrigenObservacion =>
    clavesModelo.has(claveOrigen(observacion)) &&
    clavesCodigo.has(claveOrigen(observacion))
      ? 'fusionada'
      : origen

  const combinadas: ObservacionConOrigen[] = [
    ...modelo.map((observacion) => ({
      ...observacion,
      origen: origenPara(observacion, 'modelo'),
    })),
    ...verificaciones.map((observacion) => ({
      ...observacion,
      origen: origenPara(observacion, 'codigo'),
    })),
  ]

  const fueraDeRango = combinadas.filter(
    (observacion) =>
      observacion.parrafo_id < 1 || observacion.parrafo_id > totalParrafos,
  )

  if (fueraDeRango.length > 0) {
    throw new ErrorRevision(
      'respuesta_invalida',
      502,
      'El tutor citó párrafos que no existen en el documento. Inténtalo de nuevo.',
    )
  }

  return deduplicarObservaciones(combinadas)
}

export async function revisarConGemini({
  texto,
  tipoDocumento,
  seccion,
}: {
  texto: string
  tipoDocumento: TipoDocumentoId
  seccion: SeccionRevision
}): Promise<ResultadoRevision> {
  const parrafos = dividirParrafos(texto)
  const metricas = calcularMetricas(parrafos)
  const sinModelo = debeOmitirModelo({
    tipoDocumento,
    seccion,
    totalParrafos: metricas.total_parrafos,
    sinEstructura: metricas.sin_estructura,
  })

  if (sinModelo) {
    console.log(
      `[revisar] Inicio modelo=no-requerido tipo=${tipoDocumento} seccion=${seccion} parrafos=${parrafos.length} caracteres=${texto.length} llamadas=0`,
    )

    const observacion = crearObservacionDocumentoIncompleto(
      tipoDocumento,
      metricas.total_parrafos,
    )
    const observaciones: ObservacionConOrigen[] = [
      { ...observacion, origen: 'codigo' },
    ]

    console.log(
      `[revisar] Completado observaciones=${observaciones.length} verificaciones=1 origenes=${formatearOrigenes(observaciones)} llamadas=0`,
    )

    return {
      observaciones,
      mapa: construirMapaDeterminista(parrafos),
      metricas,
    }
  }

  const apiKey = leerVariable('GEMINI_API_KEY')
  const modelo = leerVariable('GEMINI_MODEL')
  const dosLlamadas = texto.length > LIMITE_CARACTERES_SECCION_PROMPT
  const proveedor = createGoogleGenerativeAI({ apiKey })
  const controlador = new AbortController()
  const temporizador = setTimeout(
    () =>
      controlador.abort(
        new ErrorRevision(
          'tiempo_agotado',
          504,
          'La revisión tardó demasiado. Inténtalo de nuevo.',
        ),
      ),
    TIEMPO_TOTAL_SERVIDOR_MS,
  )
  let llamadas = 0

  const registrarLlamada = () => {
    if (llamadas >= MAX_LLAMADAS_POR_REVISION) {
      throw new ErrorRevision(
        'servicio_no_disponible',
        503,
        'El tutor agotó el número de intentos permitidos. Inténtalo de nuevo.',
      )
    }
    llamadas += 1
    console.log(`[revisar] Llamada ${llamadas}/${MAX_LLAMADAS_POR_REVISION}`)
  }

  const notaCorreccion = (intentosPrevios: number, destino: string) =>
    intentosPrevios > 0
      ? `\n\nNOTA DE CORRECCIÓN: Tu respuesta anterior no cumplió el formato de ${destino}. Devuelve solo la salida solicitada, sin repetir el texto del autor.`
      : ''

  console.log(
    `[revisar] Inicio modelo=${modelo} tipo=${tipoDocumento} seccion=${seccion} parrafos=${parrafos.length} caracteres=${texto.length} llamadas=${dosLlamadas ? 2 : 1}`,
  )

  try {
    let mapa: MapaDocumento
    let verificaciones: ObservacionDeterminista[]
    let observacionesValidas: ObservacionValidada[]
    let uso: UsoGemini = {}

    if (dosLlamadas) {
      const mapaReintentado = await ejecutarConReintento({
        maxIntentos: REINTENTOS_POR_LLAMADA + 1,
        puedeReintentar: () => llamadas < MAX_LLAMADAS_POR_REVISION,
        llamada: async (intentosPrevios) => {
          registrarLlamada()
          const { system, prompt } = construirPromptMapa({ parrafos })
          const respuesta = await ejecutarConTraduccion(() =>
            generateText({
              model: proveedor(modelo),
              system,
              prompt: `${prompt}${notaCorreccion(intentosPrevios, 'mapa')}`,
              output: Output.object({
                schema: esquemaSalidaMapa,
                name: 'mapa',
                description: 'Mapa descriptivo del documento.',
              }),
              temperature: 0.1,
              maxRetries: 0,
              maxOutputTokens: 1_200,
              abortSignal: AbortSignal.any([
                controlador.signal,
                AbortSignal.timeout(TIEMPO_MAPA_MS),
              ]),
            }),
          )

          const validacion = esquemaSalidaMapa.safeParse(respuesta.output)
          if (!validacion.success) {
            throw new ErrorRevision(
              'respuesta_invalida',
              502,
              'El tutor devolvió un mapa que no cumple el esquema esperado. Inténtalo de nuevo.',
              { cause: validacion.error },
            )
          }

          const normalizado = normalizarMapa(validacion.data, parrafos.length)
          if (
            normalizado.secciones.length === 0 ||
            normalizado.tesis_o_objetivo.trim().length === 0
          ) {
            throw new ErrorRevision(
              'respuesta_invalida',
              502,
              'El tutor no pudo construir un mapa válido del documento. Inténtalo de nuevo.',
            )
          }

          return { mapa: normalizado, uso: respuesta.totalUsage }
        },
      })

      mapa = mapaReintentado.valor.mapa
      uso = sumarUso(uso, mapaReintentado.valor.uso)

      verificaciones = verificarDocumento({
        tipoDocumento,
        mapa,
        metricas,
        parrafos,
      })

      const numeros = numerosParrafosSeccion(mapa, seccion, parrafos.length)
      const seleccion = recortarParrafos(
        parrafos,
        numeros,
        seccion === 'documento'
          ? LIMITE_CARACTERES_TEXTO
          : LIMITE_CARACTERES_SECCION_PROMPT,
      )
      const { system, prompt } = construirPromptRevision({
        tipoDocumento,
        seccion,
        parrafos: seleccion.textos,
        metricas,
        mapa,
        verificaciones,
        incluirMapa: false,
        numerosParrafos: seleccion.numeros,
        recortado: seleccion.recortado,
      })

      const revisionReintentada = await ejecutarConReintento({
        maxIntentos: REINTENTOS_POR_LLAMADA + 1,
        puedeReintentar: () => llamadas < MAX_LLAMADAS_POR_REVISION,
        llamada: async (intentosPrevios) => {
          registrarLlamada()
          const respuesta = await ejecutarConTraduccion(() =>
            generateText({
              model: proveedor(modelo),
              system,
              prompt: `${prompt}${notaCorreccion(intentosPrevios, 'observaciones')}`,
              output: Output.object({
                schema: esquemaSalidaObservaciones,
                name: 'observaciones',
                description: 'Lista de problemas de estructura y coherencia.',
              }),
              temperature: 0.2,
              maxRetries: 0,
              maxOutputTokens: 3_000,
              abortSignal: controlador.signal,
            }),
          )

          const validacion = esquemaSalidaObservaciones.safeParse(
            respuesta.output,
          )
          if (!validacion.success) {
            throw new ErrorRevision(
              'respuesta_invalida',
              502,
              'El tutor devolvió observaciones que no cumplen el esquema esperado. Inténtalo de nuevo.',
              { cause: validacion.error },
            )
          }

          return {
            observaciones: validacion.data.observaciones,
            uso: respuesta.totalUsage,
          }
        },
      })

      observacionesValidas = revisionReintentada.valor.observaciones
      uso = sumarUso(uso, revisionReintentada.valor.uso)
    } else {
      const { system, prompt } = construirPromptRevision({
        tipoDocumento,
        seccion,
        parrafos,
        metricas,
        incluirMapa: true,
      })

      const revisionReintentada = await ejecutarConReintento({
        maxIntentos: REINTENTOS_POR_LLAMADA + 1,
        puedeReintentar: () => llamadas < MAX_LLAMADAS_POR_REVISION,
        llamada: async (intentosPrevios) => {
          registrarLlamada()
          const respuesta = await ejecutarConTraduccion(() =>
            generateText({
              model: proveedor(modelo),
              system,
              prompt: `${prompt}${notaCorreccion(intentosPrevios, 'revisión')}`,
              output: Output.object({
                schema: esquemaSalidaUnica,
                name: 'revision',
                description:
                  'Mapa del documento y lista de problemas de estructura y coherencia detectados.',
              }),
              temperature: 0.2,
              maxRetries: 0,
              maxOutputTokens: 3_000,
              abortSignal: controlador.signal,
            }),
          )

          const validacion = esquemaSalidaUnica.safeParse(respuesta.output)
          if (!validacion.success) {
            throw new ErrorRevision(
              'respuesta_invalida',
              502,
              'El tutor devolvió una respuesta que no cumple el esquema esperado. Inténtalo de nuevo.',
              { cause: validacion.error },
            )
          }

          const normalizado = normalizarMapa(
            validacion.data.mapa,
            parrafos.length,
          )
          if (
            normalizado.secciones.length === 0 ||
            normalizado.tesis_o_objetivo.trim().length === 0
          ) {
            throw new ErrorRevision(
              'respuesta_invalida',
              502,
              'El tutor no pudo construir un mapa válido del documento. Inténtalo de nuevo.',
            )
          }

          return {
            mapa: normalizado,
            observaciones: validacion.data.observaciones,
            uso: respuesta.totalUsage,
          }
        },
      })

      mapa = revisionReintentada.valor.mapa
      observacionesValidas = revisionReintentada.valor.observaciones
      uso = sumarUso(uso, revisionReintentada.valor.uso)

      verificaciones = verificarDocumento({
        tipoDocumento,
        mapa,
        metricas,
        parrafos,
      })
    }

    const modeloCorregido = corregirPreguntasGuia(observacionesValidas)
    const modeloReanclado = reanclarIdeasNoRetomadas(
      modeloCorregido,
      mapa,
      parrafos.length,
    )

    const observaciones = fusionarObservaciones({
      delModelo: modeloReanclado,
      verificaciones,
      tipoDocumento,
      totalParrafos: parrafos.length,
      observacionAutoritativa:
        seccion === 'documento' && tipoDocumento !== 'texto-abierto'
          ? verificaciones.find(
              (verificacion) =>
                verificacion.criterio_id === CRITERIO_ESTRUCTURA_INCOMPLETO,
            )
          : undefined,
    })

    console.log(
      `[revisar] Completado observaciones=${observaciones.length} verificaciones=${verificaciones.length} origenes=${formatearOrigenes(observaciones)} llamadas=${llamadas}`,
    )

    return { observaciones, mapa, metricas, uso }
  } catch (error) {
    throw traducirError(error)
  } finally {
    clearTimeout(temporizador)
  }
}
