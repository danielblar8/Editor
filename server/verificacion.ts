import type { TipoProblema } from '../src/lib/revisionTipos.ts'
import { PREGUNTA_GUIA_DOCUMENTO_INCOMPLETO } from '../src/lib/revisionTipos.ts'
import type { TipoDocumentoId } from '../src/lib/tiposDocumento.ts'
import type { ObservacionValidada, Severidad } from './esquema.ts'
import type { MapaDocumento } from './esquemaMapa.ts'
import {
  calcularMetricasPorSeccion,
  separarBloques,
  type BloquesDocumento,
  type MetricasDocumento,
  type SeccionMetrica,
} from './metricas.ts'
import { obtenerRubrica } from './rubricas/indice.ts'
import {
  CRITERIO_ESTRUCTURA_BASE,
  CRITERIO_ESTRUCTURA_DESARROLLO,
  CRITERIO_ESTRUCTURA_INCOMPLETO,
  UMBRAL_DESARROLLO_CORTO_PALABRAS,
  UMBRAL_DESARROLLO_PORCENTAJE_MAXIMO_ALERTA,
  UMBRAL_DESARROLLO_PORCENTAJE_MINIMO,
  UMBRAL_INTRODUCCION_PORCENTAJE_MAXIMO,
  UMBRAL_LONGITUD_PREFIJO_TOKEN,
  UMBRAL_LONGITUD_TOKEN_MINIMA,
  UMBRAL_SOLAPAMIENTO_IDEA_RETOMADA,
  UMBRAL_TOKENS_ANCLA_CONCLUSION,
  UMBRAL_TOKENS_MINIMOS_IDEA,
  UMBRAL_TOKENS_NUEVOS_CONCLUSION,
  UMBRAL_TOKENS_TESIS_CONCLUSION,
} from './umbrales.ts'

export type ObservacionDeterminista = ObservacionValidada & {
  criterio_id: string
  severidad: Severidad
}

type SeccionesCalculo = Array<{ id: SeccionMetrica; parrafos: number[] }>

const STOPWORDS = new Set(
  `
  acerca actualmente apenas porque cuando donde después durante ahora así también
  tanto tampoco mismo misma mismos mismas otro otros otra otras muchos muchas
  puede pueden debe deben hacer hecho siendo sobre entre desde hacia mediante
  según conforme aunque porque entonces quizás acaso bastante demasiado siempre
  nunca todavía ya más menos muy solo sola solo mismo antes luego primero
  finalmente generalmente especialmente especialmente propio propia propios
  propias nuevo nueva nuevos nuevas tiempo veces forma manera modo parte punto
  caso cosas algo alguien nada nadie todos todas todo toda cada cual quien
  quienes cuyo cuya cuyos cuyas dicho dicha dichos dichas ser sido siendo
  estar estado estan estaba fueron siendo hubo haber tienen tenia tiene
  nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras
  dentro fuera arriba abajo delante detrás cerca lejos
  `.split(/\s+/u).map((palabra) => quitarTildes(palabra).slice(0, UMBRAL_LONGITUD_PREFIJO_TOKEN)),
)

function quitarTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function tokensDe(texto: string): Set<string> {
  const tokens = new Set<string>()

  for (const palabra of texto.match(/[\p{L}\p{N}]+/gu) ?? []) {
    const normal = quitarTildes(palabra.toLowerCase())
    if (normal.length < UMBRAL_LONGITUD_TOKEN_MINIMA) continue

    const prefijo = normal.slice(0, UMBRAL_LONGITUD_PREFIJO_TOKEN)
    if (STOPWORDS.has(prefijo)) continue
    tokens.add(prefijo)
  }

  return tokens
}

function interseccion(a: Set<string>, b: Set<string>): number {
  let total = 0
  for (const token of a) {
    if (b.has(token)) total += 1
  }
  return total
}

function solapamiento(a: Set<string>, b: Set<string>): number {
  return a.size === 0 ? 0 : interseccion(a, b) / a.size
}

function indiceValido(indice: number, total: number): boolean {
  return Number.isInteger(indice) && indice >= 1 && indice <= total
}

export function normalizarMapa(
  mapa: MapaDocumento,
  totalParrafos: number,
): MapaDocumento {
  const secciones = mapa.secciones
    .map((seccion) => ({
      ...seccion,
      parrafos: [...new Set(seccion.parrafos.filter((indice) => indiceValido(indice, totalParrafos)))],
    }))
    .filter((seccion) => seccion.parrafos.length > 0)

  return {
    ...mapa,
    secciones,
    ideas_anunciadas: mapa.ideas_anunciadas.filter((idea) =>
      indiceValido(idea.parrafo, totalParrafos),
    ),
  }
}

function textoRealSeccion(
  id: SeccionMetrica,
  secciones: SeccionesCalculo,
  bloques: BloquesDocumento,
): string {
  const numeros = new Set(
    secciones.find((seccion) => seccion.id === id)?.parrafos ?? [],
  )

  return bloques.cuerpo
    .filter((bloque) => numeros.has(bloque.indice))
    .map((bloque) => bloque.texto)
    .join(' ')
}

function construirSeccionesCalculo(
  mapa: MapaDocumento,
  metricas: MetricasDocumento,
): SeccionesCalculo {
  const porId = new Map<SeccionMetrica, number[]>()
  for (const seccion of mapa.secciones) {
    const actuales = porId.get(seccion.id) ?? []
    porId.set(seccion.id, [...actuales, ...seccion.parrafos])
  }

  const resultado: SeccionesCalculo = []
  for (const id of ['introduccion', 'desarrollo', 'conclusion'] as const) {
    const delMapa = porId.get(id)
    if (delMapa && delMapa.length > 0) {
      resultado.push({ id, parrafos: delMapa })
      continue
    }

    const heuristico = metricas.segmentos.find((segmento) => segmento.id === id)
    if (heuristico) resultado.push(heuristico)
  }

  return resultado
}

function criterioPara(
  tipoDocumento: TipoDocumentoId,
  tipoProblema: TipoProblema,
): string {
  const criterio = obtenerRubrica(tipoDocumento).criterios.find(
    (candidato) => candidato.tipo_problema === tipoProblema,
  )

  if (criterio) return criterio.id
  return tipoProblema === 'desarrollo_corto'
    ? CRITERIO_ESTRUCTURA_DESARROLLO
    : CRITERIO_ESTRUCTURA_BASE
}

function crearObservacion({
  tipoDocumento,
  tipo_problema,
  parrafo_id,
  observacion,
  pregunta_guia,
  severidad,
  criterio_id,
}: {
  tipoDocumento: TipoDocumentoId
  tipo_problema: TipoProblema
  parrafo_id: number
  observacion: string
  pregunta_guia: string
  severidad: Severidad
  criterio_id?: string
}): ObservacionDeterminista {
  return {
    parrafo_id,
    tipo_problema,
    observacion,
    pregunta_guia,
    criterio_id: criterio_id ?? criterioPara(tipoDocumento, tipo_problema),
    severidad,
  }
}

export function crearObservacionDocumentoIncompleto(
  tipoDocumento: TipoDocumentoId,
  totalParrafos: number,
): ObservacionDeterminista {
  const mensaje =
    totalParrafos <= 1
      ? 'Solo hay introducción y falta el desarrollo: el texto no permite distinguir argumentos ni un cierre.'
      : totalParrafos === 2
        ? 'Hay una introducción y un cierre, pero falta el desarrollo: el texto no explica ni sostiene la idea principal.'
        : 'No se identifica un desarrollo entre la introducción y la conclusión: faltan apartados que sostengan la idea principal.'

  return crearObservacion({
    tipoDocumento,
    tipo_problema: 'desarrollo_corto',
    parrafo_id: 1,
    observacion: mensaje,
    pregunta_guia: PREGUNTA_GUIA_DOCUMENTO_INCOMPLETO,
    severidad: 'alta',
    criterio_id: CRITERIO_ESTRUCTURA_INCOMPLETO,
  })
}

export function deduplicarObservaciones<
  T extends { parrafo_id: number; tipo_problema: string; criterio_id?: string },
>(observaciones: T[]): T[] {
  const vistosCriterio = new Set<string>()
  const vistosParrafo = new Set<string>()

  return observaciones.filter((observacion) => {
    const claveParrafo = `${observacion.parrafo_id}|${observacion.tipo_problema}`
    const claveCriterio = observacion.criterio_id
      ? `${observacion.criterio_id}|${observacion.tipo_problema}`
      : ''

    if (vistosParrafo.has(claveParrafo)) return false
    if (claveCriterio && vistosCriterio.has(claveCriterio)) return false

    vistosParrafo.add(claveParrafo)
    if (claveCriterio) vistosCriterio.add(claveCriterio)
    return true
  })
}

export function verificarDocumento({
  tipoDocumento,
  mapa,
  metricas,
  parrafos,
}: {
  tipoDocumento: TipoDocumentoId
  mapa: MapaDocumento
  metricas: MetricasDocumento
  parrafos: string[]
}): ObservacionDeterminista[] {
  const mapaValido = normalizarMapa(mapa, parrafos.length)
  const seccionesCalculo = construirSeccionesCalculo(mapaValido, metricas)
  const bloques = separarBloques(parrafos)
  const porSeccion = calcularMetricasPorSeccion(bloques, seccionesCalculo)
  const primero = (id: SeccionMetrica): number =>
    seccionesCalculo.find((seccion) => seccion.id === id)?.parrafos[0] ?? 1

  const resultado: ObservacionDeterminista[] = []
  const esAbierto = tipoDocumento === 'texto-abierto'
  const desarrollo = porSeccion.desarrollo
  const faltaDesarrollo = desarrollo.parrafos === 0
  const documentoIncompleto =
    !esAbierto && (metricas.total_parrafos < 3 || faltaDesarrollo)

  if (documentoIncompleto) {
    resultado.push(
      crearObservacionDocumentoIncompleto(tipoDocumento, metricas.total_parrafos),
    )
  } else if (!esAbierto && metricas.sin_estructura) {
    resultado.push(
      crearObservacion({
        tipoDocumento,
        tipo_problema: 'desarrollo_corto',
        parrafo_id: 1,
        observacion:
          'No se distingue una estructura con introducción, desarrollo y conclusión: el texto aparece como un solo bloque.',
        pregunta_guia: '¿Cómo podrías separar tu texto en partes reconocibles?',
        severidad: 'alta',
        criterio_id: CRITERIO_ESTRUCTURA_BASE,
      }),
    )
  }

  if (esAbierto && metricas.es_corto) {
    resultado.push(
      crearObservacion({
        tipoDocumento,
        tipo_problema: 'desarrollo_corto',
        parrafo_id: 1,
        observacion:
          'El documento es muy corto para evaluar su progresión con seguridad; hay pocas palabras para distinguir ideas desarrolladas.',
        pregunta_guia: '¿Qué falta para que tus ideas queden explicadas?',
        severidad: 'media',
      }),
    )
  } else if (
    !documentoIncompleto &&
    desarrollo.palabras < UMBRAL_DESARROLLO_CORTO_PALABRAS
  ) {
    resultado.push(
      crearObservacion({
        tipoDocumento,
        tipo_problema: 'desarrollo_corto',
        parrafo_id: primero('desarrollo'),
        observacion: `El desarrollo tiene ${desarrollo.palabras} palabras repartidas en ${desarrollo.parrafos} párrafo(s), menos de ${UMBRAL_DESARROLLO_CORTO_PALABRAS}.`,
        pregunta_guia: '¿Qué razones o ejemplos faltan en el desarrollo?',
        severidad: esAbierto ? 'media' : 'alta',
      }),
    )
  }

  if (!esAbierto && !documentoIncompleto) {
    const desequilibrado =
      !faltaDesarrollo &&
      (desarrollo.porcentaje < UMBRAL_DESARROLLO_PORCENTAJE_MINIMO ||
      (porSeccion.introduccion.porcentaje >
        UMBRAL_INTRODUCCION_PORCENTAJE_MAXIMO &&
        desarrollo.porcentaje < UMBRAL_DESARROLLO_PORCENTAJE_MAXIMO_ALERTA))

    if (desequilibrado) {
      resultado.push(
        crearObservacion({
          tipoDocumento,
          tipo_problema: 'desequilibrio_entre_secciones',
          parrafo_id: primero('desarrollo'),
          observacion: `El desarrollo concentra el ${desarrollo.porcentaje}% de las palabras, mientras la introducción concentra el ${porSeccion.introduccion.porcentaje}%.`,
          pregunta_guia: '¿Qué sección necesita más espacio para sostener tu texto?',
          severidad: 'media',
        }),
      )
    }

    resultado.push(
      ...verificarSemantica(
        mapaValido,
        tipoDocumento,
        seccionesCalculo,
        bloques,
      ),
    )
  }

  return deduplicarObservaciones(resultado)
}

function verificarSemantica(
  mapa: MapaDocumento,
  tipoDocumento: TipoDocumentoId,
  seccionesCalculo: SeccionesCalculo,
  bloques: BloquesDocumento,
): ObservacionDeterminista[] {
  const resultado: ObservacionDeterminista[] = []
  const tieneDesarrollo = seccionesCalculo.some(
    (seccion) => seccion.id === 'desarrollo' && seccion.parrafos.length > 0,
  )
  const conclusion = seccionesCalculo.some(
    (seccion) => seccion.id === 'conclusion' && seccion.parrafos.length > 0,
  )
  const tesis = tokensDe(mapa.tesis_o_objetivo)
  const tokensDesarrollo = tokensDe(
    tieneDesarrollo ? textoRealSeccion('desarrollo', seccionesCalculo, bloques) : '',
  )
  const tokensConclusion = tokensDe(
    conclusion ? textoRealSeccion('conclusion', seccionesCalculo, bloques) : '',
  )
  const tokensAnunciados = mapa.ideas_anunciadas
    .map((idea) => tokensDe(idea.idea))
    .reduce(
      (acumulado, tokens) => new Set([...acumulado, ...tokens]),
      new Set<string>(),
    )
  const tokensPrevios = new Set([
    ...tesis,
    ...tokensDesarrollo,
    ...tokensAnunciados,
  ])

  for (const idea of mapa.ideas_anunciadas) {
    const tokensIdea = tokensDe(idea.idea)
    if (tokensIdea.size < UMBRAL_TOKENS_MINIMOS_IDEA) continue

    if (
      solapamiento(tokensIdea, tokensConclusion) <=
        UMBRAL_SOLAPAMIENTO_IDEA_RETOMADA &&
      solapamiento(tokensIdea, tokensDesarrollo) <=
        UMBRAL_SOLAPAMIENTO_IDEA_RETOMADA
    ) {
      resultado.push(
        crearObservacion({
          tipoDocumento,
          tipo_problema: 'idea_no_retomada',
          parrafo_id: idea.parrafo,
          observacion: `La idea «${idea.idea}» se anuncia, pero no aparece desarrollada en el resto del texto.`,
          pregunta_guia: '¿Dónde retomas esa idea anunciada?',
          severidad: 'baja',
        }),
      )
    }
  }

  if (conclusion) {
    const anclas = [...tokensConclusion].filter(
      (token) => tesis.has(token) || tokensAnunciados.has(token),
    )
    const conclusionPocoAnclada =
      anclas.length < UMBRAL_TOKENS_ANCLA_CONCLUSION
    const nuevos = [...tokensConclusion].filter(
      (token) => !tokensPrevios.has(token),
    )
    const introduceNuevos =
      nuevos.length >= UMBRAL_TOKENS_NUEVOS_CONCLUSION &&
      nuevos.length / Math.max(tokensConclusion.size, 1) >= 0.5

    if (introduceNuevos && conclusionPocoAnclada) {
      resultado.push(
        crearObservacion({
          tipoDocumento,
          tipo_problema: 'idea_nueva_en_conclusion',
          parrafo_id:
            seccionesCalculo.find((seccion) => seccion.id === 'conclusion')
              ?.parrafos[0] ?? 1,
          observacion: `La conclusión introduce nociones que no aparecían antes (${nuevos.slice(0, 4).join(', ')}).`,
          pregunta_guia: '¿Qué temas nuevos aparecen solo al final?',
          severidad: 'baja',
        }),
      )
    }

    if (
      conclusionPocoAnclada &&
      tesis.size >= 3 &&
      interseccion(tokensConclusion, tesis) < UMBRAL_TOKENS_TESIS_CONCLUSION
    ) {
      resultado.push(
        crearObservacion({
          tipoDocumento,
          tipo_problema: 'conclusion_incoherente',
          parrafo_id:
            seccionesCalculo.find((seccion) => seccion.id === 'conclusion')
              ?.parrafos[0] ?? 1,
          observacion:
            'La conclusión no retoma los términos de la tesis u objetivo inicial.',
          pregunta_guia: '¿Cómo se conecta tu cierre con la idea inicial?',
          severidad: 'baja',
        }),
      )
    }
  }

  return deduplicarObservaciones(resultado)
}
