import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calcularMetricas,
  calcularMetricasPorSeccion,
  contarPalabras,
  esTitulo,
  separarBloques,
} from '../server/metricas.ts'

test('contarPalabras respeta tildes, apóstrofos y guiones', () => {
  assert.equal(contarPalabras('La lectura digital no es fácil.'), 6)
  assert.equal(contarPalabras('Línea-a-línea y don’t stop.'), 4)
  assert.equal(contarPalabras('   '), 0)
})

test('esTitulo distingue encabezados de párrafos breves con punto', () => {
  assert.equal(esTitulo('Introducción'), true)
  assert.equal(esTitulo('El problema'), true)
  assert.equal(esTitulo('El problema del soporte.'), false)
  assert.equal(
    esTitulo('Este enunciado tiene más de ocho palabras y por eso no es título.'),
    false,
  )
})

test('los títulos no cuentan como párrafos ni entran en los segmentos', () => {
  const metricas = calcularMetricas([
    'Introducción',
    'Este es el primer párrafo de la introducción con varias palabras y un punto final.',
    'Este es el desarrollo central del texto con razones, ejemplos y un punto final.',
    'Este es otro párrafo de desarrollo que amplia las razones y termina con un punto.',
    'Esta es la conclusión del documento y retoma la idea principal con un punto.',
  ])

  assert.equal(metricas.total_parrafos, 4)
  assert.equal(metricas.titulos.length, 1)
  assert.equal(metricas.titulos[0]?.indice, 1)
  assert.deepEqual(
    metricas.segmentos.map((segmento) => segmento.parrafos),
    [[2], [3, 4], [5]],
  )
  assert.deepEqual(
    metricas.por_parrafo.map((detalle) => detalle.es_titulo),
    [true, false, false, false, false],
  )
})

test('las proporciones y longitudes medias se calculan sobre el cuerpo', () => {
  const metricas = calcularMetricas([
    'Uno dos tres cuatro cinco seis siete ocho nueve diez once.',
    'Uno dos tres cuatro cinco.',
    'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce.',
    'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece.',
  ])

  assert.equal(metricas.total_palabras, 43)
  assert.equal(metricas.por_seccion.introduccion.palabras, 11)
  assert.equal(metricas.por_seccion.desarrollo.palabras, 19)
  assert.equal(metricas.por_seccion.conclusion.palabras, 13)
  assert.equal(metricas.por_seccion.desarrollo.parrafos, 2)
  assert.equal(metricas.por_seccion.desarrollo.longitud_media, 9.5)
  assert.equal(metricas.por_seccion.conclusion.porcentaje, 30.2)
})

test('documentos cortos y sin desarrollo se marcan como tales', () => {
  const corto = calcularMetricas([
    'Solo hay una introducción breve con un punto final.',
  ])
  assert.equal(corto.es_corto, true)
  assert.equal(corto.sin_estructura, true)

  const dosBloques = calcularMetricas([
    'Esta es la introducción del texto con varias palabras y un punto final.',
    'Este es el cierre del texto con varias palabras y un punto final.',
  ])
  assert.equal(dosBloques.sin_estructura, true)
  assert.deepEqual(
    dosBloques.segmentos.map((segmento) => segmento.id),
    ['introduccion', 'conclusion'],
  )
})

test('calcularMetricasPorSeccion ignora títulos, índices repetidos y fuera de rango', () => {
  const bloques = separarBloques([
    'Título',
    'Uno dos tres cuatro cinco seis siete ocho nueve diez once.',
    'Uno dos tres cuatro.',
    'Uno dos tres cuatro cinco.',
  ])

  const porSeccion = calcularMetricasPorSeccion(bloques, [
    { id: 'introduccion', parrafos: [2] },
    { id: 'desarrollo', parrafos: [2, 3, 3, 99, 1] },
    { id: 'conclusion', parrafos: [4] },
  ])

  assert.equal(porSeccion.desarrollo.parrafos, 2)
  assert.equal(porSeccion.desarrollo.palabras, 15)
  assert.equal(porSeccion.desarrollo.porcentaje, 48.4)
})
