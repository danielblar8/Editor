import {
  ESTADO_ERROR_GRAMATICA,
  IDIOMA_GRAMATICA,
  MAX_LONGITUD_MENSAJE,
  MAX_LONGITUD_REGLA,
  MENSAJES_ERROR_GRAMATICA,
  TIMEOUT_LANGUAGETOOL_MS,
} from '../src/lib/gramaticaTipos.ts'
import type {
  CodigoErrorGramatica,
  ErrorGramatica as ErrorGramaticaContrato,
  EstadoErrorGramatica,
  ParrafoGramatica,
} from '../src/lib/gramaticaTipos.ts'
import { esquemaRespuestaLanguageTool } from './esquemaGramatica.ts'

export class ErrorGramatica extends Error {
  readonly codigo: CodigoErrorGramatica
  readonly estado: EstadoErrorGramatica

  constructor(
    codigo: CodigoErrorGramatica,
    options?: { cause?: unknown },
  ) {
    super(MENSAJES_ERROR_GRAMATICA[codigo], options)
    this.name = 'ErrorGramatica'
    this.codigo = codigo
    this.estado = ESTADO_ERROR_GRAMATICA[codigo]
  }
}

type RangoParrafo = {
  clave: string
  inicio: number
  fin: number
}

function unirParrafos(parrafos: ParrafoGramatica[]): {
  texto: string
  rangos: RangoParrafo[]
} {
  let texto = ''
  const rangos: RangoParrafo[] = []

  for (const parrafo of parrafos) {
    if (texto.length > 0) texto += '\n\n'
    const inicio = texto.length
    texto += parrafo.texto
    rangos.push({ clave: parrafo.clave, inicio, fin: texto.length })
  }

  return { texto, rangos }
}

function leerUrlLanguageTool(): string {
  const url = process.env.LANGUAGETOOL_URL?.trim()
  if (!url) throw new ErrorGramatica('configuracion')
  return `${url.replace(/\/+$/, '')}/v2/check`
}

function esErrorAborto(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function crearSenal(signal?: AbortSignal): AbortSignal {
  const senales = [AbortSignal.timeout(TIMEOUT_LANGUAGETOOL_MS)]
  if (signal) senales.push(signal)
  return AbortSignal.any(senales)
}

/**
 * Envía los párrafos a LanguageTool y devuelve solo los errores gramaticales
 * colocados en coordenadas locales de cada párrafo.
 *
 * Los offsets de LanguageTool son UTF-16, igual que los de JavaScript, así que
 * se usan tal cual. Las faltas de ortografía se descartan: de eso se encarga el
 * corrector nativo del navegador.
 */
export async function revisarConLanguageTool({
  parrafos,
  signal,
}: {
  parrafos: ParrafoGramatica[]
  signal?: AbortSignal
}): Promise<ErrorGramaticaContrato[]> {
  const url = leerUrlLanguageTool()
  const { texto, rangos } = unirParrafos(parrafos)
  if (texto.trim().length === 0) return []

  const senal = crearSenal(signal)
  let respuesta: Response

  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        text: texto,
        language: IDIOMA_GRAMATICA,
      }),
      signal: senal,
    })
  } catch (error) {
    if (signal?.aborted) {
      throw new ErrorGramatica('servicio_no_disponible', { cause: error })
    }
    if (esErrorAborto(error)) {
      throw new ErrorGramatica('tiempo_agotado', { cause: error })
    }
    throw new ErrorGramatica('servicio_no_disponible', { cause: error })
  }

  if (respuesta.status === 429) throw new ErrorGramatica('cuota_agotada')
  if (respuesta.status === 413) {
    throw new ErrorGramatica('texto_demasiado_largo')
  }
  if (!respuesta.ok) {
    if (respuesta.status >= 500) {
      throw new ErrorGramatica('servicio_no_disponible')
    }
    throw new ErrorGramatica('configuracion')
  }

  let datos: unknown
  try {
    datos = await respuesta.json()
  } catch (error) {
    if (signal?.aborted) {
      throw new ErrorGramatica('servicio_no_disponible', { cause: error })
    }
    if (esErrorAborto(error)) {
      throw new ErrorGramatica('tiempo_agotado', { cause: error })
    }
    throw new ErrorGramatica('respuesta_invalida', { cause: error })
  }

  const validacion = esquemaRespuestaLanguageTool.safeParse(datos)
  if (!validacion.success) {
    throw new ErrorGramatica('respuesta_invalida', {
      cause: validacion.error,
    })
  }

  const errores: ErrorGramaticaContrato[] = []

  for (const coincidencia of validacion.data.matches) {
    const tipo = coincidencia.rule?.issueType?.trim().toLowerCase()
    if (tipo === 'misspelling') continue

    const idRegla = coincidencia.rule?.id.trim() ?? ''
    const idNormalizado = idRegla.toUpperCase()
    if (
      idNormalizado.startsWith('MORFOLOGIK_') ||
      idNormalizado.startsWith('HUNSPELL_')
    ) {
      continue
    }

    const inicioGlobal = coincidencia.offset
    const finGlobal = coincidencia.offset + coincidencia.length
    const rango = rangos.find(
      (candidato) =>
        inicioGlobal >= candidato.inicio &&
        finGlobal <= candidato.fin &&
        candidato.fin > candidato.inicio,
    )
    if (!rango) continue

    const inicio = inicioGlobal - rango.inicio
    const fin = finGlobal - rango.inicio
    const longitudParrafo = rango.fin - rango.inicio
    if (inicio < 0 || fin <= inicio || fin > longitudParrafo) continue

    const mensaje = coincidencia.message
      .trim()
      .slice(0, MAX_LONGITUD_MENSAJE)
    if (mensaje.length === 0) continue

    const regla =
      idRegla.slice(0, MAX_LONGITUD_REGLA) || 'languagetool'

    errores.push({
      clave: rango.clave,
      inicio,
      fin,
      mensaje,
      regla,
    })
  }

  return errores
}
