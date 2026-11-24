import {
  UMBRAL_DOCUMENTO_CORTO_PALABRAS,
  UMBRAL_PALABRAS_TITULO,
} from './umbrales.ts'

export type SeccionMetrica = 'introduccion' | 'desarrollo' | 'conclusion'

export type Bloque = { indice: number; texto: string }

export type DetalleParrafo = {
  indice: number
  palabras: number
  caracteres: number
  es_titulo: boolean
}

export type MetricasSeccion = {
  palabras: number
  parrafos: number
  longitud_media: number
  porcentaje: number
}

export type Segmento = { id: SeccionMetrica; parrafos: number[] }

export type MetricasDocumento = {
  total_palabras: number
  total_parrafos: number
  titulos: Bloque[]
  por_parrafo: DetalleParrafo[]
  segmentos: Segmento[]
  por_seccion: Record<SeccionMetrica, MetricasSeccion>
  es_corto: boolean
  sin_estructura: boolean
}

export type BloquesDocumento = {
  todos: Bloque[]
  cuerpo: Bloque[]
  titulos: Bloque[]
  palabrasPorIndice: Map<number, number>
  porParrafo: DetalleParrafo[]
}

const EXPRESION_PALABRA = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu
const EXPRESION_FINAL = /[.!?…]["'”’)]?$/u

function redondear(valor: number): number {
  return Math.round(valor * 10) / 10
}

export function contarPalabras(texto: string): number {
  return texto.match(EXPRESION_PALABRA)?.length ?? 0
}

export function esTitulo(texto: string): boolean {
  const limpio = texto.trim()
  if (limpio.length === 0 || contarPalabras(limpio) >= UMBRAL_PALABRAS_TITULO) {
    return false
  }
  return !EXPRESION_FINAL.test(limpio)
}

export function separarBloques(parrafos: string[]): BloquesDocumento {
  const todos = parrafos.map((texto, posicion) => ({
    indice: posicion + 1,
    texto,
  }))
  const titulos = todos.filter((bloque) => esTitulo(bloque.texto))
  const cuerpo = todos.filter((bloque) => !esTitulo(bloque.texto))
  const porParrafo = todos.map((bloque) => ({
    indice: bloque.indice,
    palabras: contarPalabras(bloque.texto),
    caracteres: bloque.texto.length,
    es_titulo: esTitulo(bloque.texto),
  }))
  const palabrasPorIndice = new Map(
    cuerpo.map((bloque) => [bloque.indice, contarPalabras(bloque.texto)]),
  )

  return { todos, cuerpo, titulos, palabrasPorIndice, porParrafo }
}

export function calcularSegmentos(cuerpo: Bloque[]): Segmento[] {
  if (cuerpo.length === 0) return []

  if (cuerpo.length === 1) {
    return [{ id: 'introduccion', parrafos: [cuerpo[0]!.indice] }]
  }

  if (cuerpo.length === 2) {
    return [
      { id: 'introduccion', parrafos: [cuerpo[0]!.indice] },
      { id: 'conclusion', parrafos: [cuerpo[1]!.indice] },
    ]
  }

  return [
    { id: 'introduccion', parrafos: [cuerpo[0]!.indice] },
    {
      id: 'desarrollo',
      parrafos: cuerpo.slice(1, -1).map((bloque) => bloque.indice),
    },
    { id: 'conclusion', parrafos: [cuerpo[cuerpo.length - 1]!.indice] },
  ]
}

function seccionVacia(): MetricasSeccion {
  return { palabras: 0, parrafos: 0, longitud_media: 0, porcentaje: 0 }
}

export function calcularMetricasPorSeccion(
  bloques: BloquesDocumento,
  secciones: Array<{ id: SeccionMetrica; parrafos: number[] }>,
): Record<SeccionMetrica, MetricasSeccion> {
  const resultado: Record<SeccionMetrica, MetricasSeccion> = {
    introduccion: seccionVacia(),
    desarrollo: seccionVacia(),
    conclusion: seccionVacia(),
  }

  for (const seccion of secciones) {
    const destino = resultado[seccion.id]
    const indices = new Set(seccion.parrafos)

    for (const indice of indices) {
      if (!bloques.palabrasPorIndice.has(indice)) continue
      destino.palabras += bloques.palabrasPorIndice.get(indice) ?? 0
      destino.parrafos += 1
    }
  }

  const total = Object.values(resultado).reduce(
    (acumulado, seccion) => acumulado + seccion.palabras,
    0,
  )

  for (const seccion of Object.values(resultado)) {
    seccion.longitud_media =
      seccion.parrafos === 0 ? 0 : redondear(seccion.palabras / seccion.parrafos)
    seccion.porcentaje = total === 0 ? 0 : redondear((seccion.palabras / total) * 100)
  }

  return resultado
}

export function calcularMetricas(parrafos: string[]): MetricasDocumento {
  const bloques = separarBloques(parrafos)
  const segmentos = calcularSegmentos(bloques.cuerpo)
  const totalPalabras = bloques.cuerpo.reduce(
    (acumulado, bloque) => acumulado + contarPalabras(bloque.texto),
    0,
  )

  return {
    total_palabras: totalPalabras,
    total_parrafos: bloques.cuerpo.length,
    titulos: bloques.titulos,
    por_parrafo: bloques.porParrafo,
    segmentos,
    por_seccion: calcularMetricasPorSeccion(bloques, segmentos),
    es_corto: totalPalabras < UMBRAL_DOCUMENTO_CORTO_PALABRAS,
    sin_estructura: !segmentos.some((segmento) => segmento.id === 'desarrollo'),
  }
}
