import assert from 'node:assert/strict'
import test from 'node:test'
import type { ObservacionValidada } from '../server/esquema.ts'
import {
  corregirPreguntasGuia,
  debeOmitirModelo,
  fusionarObservaciones,
} from '../server/gemini.ts'
import { crearObservacionDocumentoIncompleto } from '../server/verificacion.ts'
import {
  PREGUNTA_GUIA_DOCUMENTO_INCOMPLETO,
  PREGUNTAS_GUIA_FIJAS,
} from '../src/lib/revisionTipos.ts'

const observacionesModelo: ObservacionValidada[] = [
  {
    parrafo_id: 1,
    tipo_problema: 'desequilibrio_entre_secciones',
    observacion: 'La introducción ocupa casi todo el texto.',
    pregunta_guia: '¿Qué deberías redactar en el desarrollo?',
  },
  {
    parrafo_id: 1,
    tipo_problema: 'idea_no_retomada',
    observacion: 'La idea inicial no vuelve a aparecer.',
    pregunta_guia: '¿Dónde retomas esa idea anunciada?',
  },
  {
    parrafo_id: 1,
    tipo_problema: 'desarrollo_corto',
    observacion: 'No hay razones que sostengan la tesis.',
    pregunta_guia: '¿Qué ejemplos podrías escribir aquí?',
  },
]

test('el código es autoritativo ante un modelo que reporta un documento incompleto', () => {
  const codigo = crearObservacionDocumentoIncompleto(
    'ensayo-argumentativo',
    1,
  )

  const observaciones = fusionarObservaciones({
    delModelo: observacionesModelo,
    verificaciones: [codigo],
    tipoDocumento: 'ensayo-argumentativo',
    totalParrafos: 1,
    observacionAutoritativa: codigo,
  })

  assert.equal(observaciones.length, 1)
  assert.equal(observaciones[0]?.origen, 'codigo')
  assert.equal(observaciones[0]?.tipo_problema, 'desarrollo_corto')
  assert.equal(
    observaciones[0]?.pregunta_guia,
    PREGUNTA_GUIA_DOCUMENTO_INCOMPLETO,
  )
  assert.equal(observaciones[0]?.observacion, codigo.observacion)

  const tipos = observaciones.map((observacion) => observacion.tipo_problema)
  assert.equal(tipos.includes('desequilibrio_entre_secciones'), false)
  assert.equal(tipos.includes('idea_no_retomada'), false)
})

test('la guarda sustituye las preguntas que piden redactar o escribir', () => {
  const corregidas = corregirPreguntasGuia(observacionesModelo)

  assert.equal(
    corregidas[0]?.pregunta_guia,
    PREGUNTAS_GUIA_FIJAS.desequilibrio_entre_secciones,
  )
  assert.equal(
    corregidas[1]?.pregunta_guia,
    observacionesModelo[1]?.pregunta_guia,
  )
  assert.equal(
    corregidas[2]?.pregunta_guia,
    PREGUNTAS_GUIA_FIJAS.desarrollo_corto,
  )
})

test('el modelo conserva las observaciones finas cuando el código es conservador', () => {
  const delModelo: ObservacionValidada[] = [
    {
      parrafo_id: 1,
      tipo_problema: 'idea_no_retomada',
      observacion: 'El texto anuncia las familias y no las desarrolla.',
      pregunta_guia: '¿Dónde retomas esa idea anunciada?',
    },
    {
      parrafo_id: 4,
      tipo_problema: 'idea_nueva_en_conclusion',
      observacion: 'La conclusión incorpora la deserción escolar.',
      pregunta_guia: '¿Cómo se vincula ese tema con la tesis?',
    },
  ]

  const observaciones = fusionarObservaciones({
    delModelo,
    verificaciones: [],
    tipoDocumento: 'ensayo-argumentativo',
    totalParrafos: 4,
  })

  assert.deepEqual(
    observaciones.map((observacion) => [
      observacion.parrafo_id,
      observacion.tipo_problema,
      observacion.origen,
    ]),
    [
      [1, 'idea_no_retomada', 'modelo'],
      [4, 'idea_nueva_en_conclusion', 'modelo'],
    ],
  )
})

test('solo el documento completo de sección documento requiere modelo', () => {
  assert.equal(
    debeOmitirModelo({
      tipoDocumento: 'ensayo-argumentativo',
      seccion: 'documento',
      totalParrafos: 1,
      sinEstructura: false,
    }),
    true,
  )
  assert.equal(
    debeOmitirModelo({
      tipoDocumento: 'ensayo-argumentativo',
      seccion: 'introduccion',
      totalParrafos: 1,
      sinEstructura: false,
    }),
    false,
  )
  assert.equal(
    debeOmitirModelo({
      tipoDocumento: 'texto-abierto',
      seccion: 'documento',
      totalParrafos: 1,
      sinEstructura: false,
    }),
    false,
  )
  assert.equal(
    debeOmitirModelo({
      tipoDocumento: 'reporte-investigacion',
      seccion: 'documento',
      totalParrafos: 4,
      sinEstructura: false,
    }),
    false,
  )
})
