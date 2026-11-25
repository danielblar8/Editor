import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Editor, getSchema } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { crearDecoracionesObservaciones } from '../src/extensions/ObservacionesDecoraciones.ts'
import { ParrafoId } from '../src/extensions/ParrafoId.ts'
import { crearMensajeObservacion } from '../src/lib/chat.ts'
import { construirResaltados } from '../src/lib/observaciones.ts'
import { extraerParrafosConIdDeDoc } from '../src/lib/parrafos.ts'
import { asegurarIdsContenido } from '../src/lib/parrafosIds.ts'
import type { Observacion } from '../src/lib/revisionTipos.ts'

const extensionesTexto = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  TextStyle,
  FontFamily,
  FontSize,
  Subscript,
  Superscript,
  TextAlign.configure({ types: ['paragraph', 'heading'] }),
]

const esquema = getSchema([...extensionesTexto, ParrafoId])

function textoConFormato(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { parrafoId: 'intro', textAlign: 'center' },
        content: [
          {
            type: 'text',
            text: 'Intro',
            marks: [
              {
                type: 'textStyle',
                attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' },
              },
            ],
          },
          { type: 'text', text: ' importante', marks: [{ type: 'bold' }] },
        ],
      },
      {
        type: 'blockquote',
        attrs: { parrafoId: 'cita' },
        content: [
          {
            type: 'paragraph',
            attrs: { parrafoId: 'cita-interna' },
            content: [
              { type: 'text', text: 'Una cita', marks: [{ type: 'italic' }] },
            ],
          },
        ],
      },
      {
        type: 'bulletList',
        attrs: { parrafoId: 'vinetas' },
        content: [
          {
            type: 'listItem',
            attrs: { parrafoId: 'vineta-1' },
            content: [
              {
                type: 'paragraph',
                attrs: { parrafoId: 'texto-vineta-1' },
                content: [
                  { type: 'text', text: 'Primero', marks: [{ type: 'subscript' }] },
                ],
              },
            ],
          },
          {
            type: 'listItem',
            attrs: { parrafoId: 'vineta-2' },
            content: [
              {
                type: 'paragraph',
                attrs: { parrafoId: 'texto-vineta-2' },
                content: [
                  { type: 'text', text: 'Segundo', marks: [{ type: 'superscript' }] },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'orderedList',
        attrs: { parrafoId: 'numerada' },
        content: [
          {
            type: 'listItem',
            attrs: { parrafoId: 'numero-1' },
            content: [
              {
                type: 'paragraph',
                attrs: { parrafoId: 'texto-numero-1' },
                content: [{ type: 'text', text: 'Terciario' }],
              },
            ],
          },
          {
            type: 'listItem',
            attrs: { parrafoId: 'numero-2' },
            content: [
              {
                type: 'paragraph',
                attrs: { parrafoId: 'texto-numero-2' },
                content: [
                  { type: 'text', text: 'Cuarto', marks: [{ type: 'strike' }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

function textoSinFormato(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Intro importante' }],
      },
      {
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Una cita' }] },
        ],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Primero' }] },
            ],
          },
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Segundo' }] },
            ],
          },
        ],
      },
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Terciario' }] },
            ],
          },
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Cuarto' }] },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Editor sin montar: `getText()` usa el mismo estado y serializadores que en
 * la aplicación. No se incluye `ParrafoId` porque su plugin necesita una vista.
 */
function getText(contenido: JSONContent): string {
  const editor = new Editor({ extensions: extensionesTexto, content: contenido })

  try {
    return editor.getText({ blockSeparator: ' ' })
  } finally {
    editor.destroy()
  }
}

test('getText() es igual con y sin formato', () => {
  assert.equal(getText(textoConFormato()), getText(textoSinFormato()))
})

test('cita y listas conservan la numeración de parrafo_id', () => {
  const contenido = textoConFormato()
  const doc = esquema.nodeFromJSON(asegurarIdsContenido(contenido).contenido)
  const bloques = extraerParrafosConIdDeDoc(doc)

  assert.deepEqual(
    bloques.map((bloque) => bloque.id),
    ['intro', 'cita', 'vinetas', 'numerada'],
  )
  assert.deepEqual(
    bloques.map((bloque) => bloque.texto),
    ['Intro importante', 'Una cita', 'Primero Segundo', 'Terciario Cuarto'],
  )
})

test('el resaltado de una lista cae en el bloque que señala el número de párrafo', () => {
  const doc = esquema.nodeFromJSON(
    asegurarIdsContenido(textoConFormato()).contenido,
  )
  const bloques = extraerParrafosConIdDeDoc(doc)
  const observacion: Observacion = {
    parrafo_id: 3,
    tipo_problema: 'desarrollo_corto',
    observacion: 'La lista necesita más desarrollo.',
    pregunta_guia: '¿Qué razones faltan?',
  }
  const mensaje = crearMensajeObservacion(
    observacion,
    bloques.map((bloque) => bloque.id),
    'revision-prueba',
  )
  const resaltados = construirResaltados([mensaje])

  assert.deepEqual(resaltados, [
    {
      parrafoId: 'vinetas',
      tipo: 'desarrollo_corto',
      severidad: 'media',
    },
  ])

  let posicion = -1
  let tamano = 0
  doc.descendants((nodo, pos) => {
    if (nodo.attrs.parrafoId !== 'vinetas') return true
    posicion = pos
    tamano = nodo.nodeSize
    return false
  })

  const decoraciones = crearDecoracionesObservaciones(doc, resaltados).find()
  assert.equal(decoraciones.length, 1)
  assert.equal(decoraciones[0]?.from, posicion)
  assert.equal(decoraciones[0]?.to, posicion + tamano)
  assert.equal(decoraciones[0]?.spec.parrafoId, 'vinetas')
})
