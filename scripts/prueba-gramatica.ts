import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSchema } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import {
  extraerParrafosConPosiciones,
  posicionProseMirror,
  rangoProseMirror,
} from '../src/lib/gramaticaPosiciones.ts'
import { revisarConLanguageTool } from '../server/languagetool.ts'

const esquema = getSchema([StarterKit])

function documento(contenido: JSONContent[]): PMNode {
  return esquema.nodeFromJSON({ type: 'doc', content: contenido })
}

function obtenerParrafo(doc: PMNode, indice: number) {
  const parrafo = extraerParrafosConPosiciones(doc)[indice]
  assert.ok(parrafo, `No existe el párrafo ${indice}`)
  return parrafo
}

function comprobarLongitudes(doc: PMNode): void {
  const parrafos = extraerParrafosConPosiciones(doc)
  let indice = 0

  doc.descendants((nodo) => {
    if (!nodo.isTextblock) return true

    const parrafo = parrafos[indice]
    assert.ok(parrafo)
    assert.equal(parrafo.texto.length, nodo.content.size)
    indice += 1

    return false
  })

  assert.equal(parrafos.length, indice)
}

test('mapea un error simple', () => {
  const doc = documento([
    { type: 'paragraph', content: [{ type: 'text', text: 'Hola mundo' }] },
  ])
  const parrafo = obtenerParrafo(doc, 0)

  assert.equal(parrafo.texto, 'Hola mundo')
  assert.equal(parrafo.inicio, 1)
  assert.equal(parrafo.fin, 11)
  assert.deepEqual(rangoProseMirror(parrafo, 5, 10), { from: 6, to: 11 })
  assert.equal(doc.textBetween(6, 11), 'mundo')
  comprobarLongitudes(doc)
})

test('respeta las tildes anteriores al error', () => {
  const texto = 'La canción está mal'
  const doc = documento([
    { type: 'paragraph', content: [{ type: 'text', text: texto }] },
  ])
  const parrafo = obtenerParrafo(doc, 0)
  const inicioError = texto.indexOf('mal')
  const rango = rangoProseMirror(parrafo, inicioError, inicioError + 3)

  assert.equal(inicioError, 16)
  assert.equal(parrafo.texto, texto)
  assert.ok(rango)
  assert.equal(doc.textBetween(rango.from, rango.to), 'mal')
  comprobarLongitudes(doc)
})

test('usa offsets UTF-16 cuando hay un emoji antes del error', () => {
  const texto = 'Hola 😀 mundo'
  const doc = documento([
    { type: 'paragraph', content: [{ type: 'text', text: texto }] },
  ])
  const parrafo = obtenerParrafo(doc, 0)
  const inicioError = texto.indexOf('mundo')
  const rango = rangoProseMirror(parrafo, inicioError, inicioError + 5)

  assert.equal(inicioError, 8)
  assert.equal(texto.length, 13)
  assert.equal(parrafo.texto.length, 13)
  assert.ok(rango)
  assert.equal(doc.textBetween(rango.from, rango.to), 'mundo')
  comprobarLongitudes(doc)
})

test('mapea una lista con viñetas', () => {
  const doc = documento([
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Primer punto' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Segundo punto' }],
            },
          ],
        },
      ],
    },
  ])

  const parrafos = extraerParrafosConPosiciones(doc)
  assert.equal(parrafos.length, 2)
  assert.equal(parrafos[0]?.texto, 'Primer punto')
  assert.equal(parrafos[1]?.texto, 'Segundo punto')

  const segundo = obtenerParrafo(doc, 1)
  const inicioError = segundo.texto.indexOf('punto')
  const rango = rangoProseMirror(segundo, inicioError, inicioError + 5)

  assert.ok(rango)
  assert.equal(doc.textBetween(rango.from, rango.to), 'punto')
  comprobarLongitudes(doc)
})

test('mapea una lista numerada', () => {
  const doc = documento([
    {
      type: 'orderedList',
      attrs: { start: 1 },
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Primer punto' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Segundo punto' }],
            },
          ],
        },
      ],
    },
  ])

  const segundo = obtenerParrafo(doc, 1)
  const inicioError = segundo.texto.indexOf('punto')
  const rango = rangoProseMirror(segundo, inicioError, inicioError + 5)

  assert.equal(segundo.texto, 'Segundo punto')
  assert.ok(rango)
  assert.equal(doc.textBetween(rango.from, rango.to), 'punto')
  comprobarLongitudes(doc)
})

test('convierte hardBreak en salto de línea y conserva la posición', () => {
  const doc = documento([
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hola' },
        { type: 'hardBreak' },
        { type: 'text', text: 'mundo' },
      ],
    },
  ])
  const parrafo = obtenerParrafo(doc, 0)
  const rango = rangoProseMirror(parrafo, 5, 10)

  assert.equal(parrafo.texto, 'Hola\nmundo')
  assert.equal(parrafo.texto.length, 10)
  assert.deepEqual(parrafo, {
    indice: 0,
    texto: 'Hola\nmundo',
    inicio: 1,
    fin: 11,
  })
  assert.deepEqual(rango, { from: 6, to: 11 })
  assert.equal(doc.textBetween(6, 11), 'mundo')
  comprobarLongitudes(doc)
})

test('descarta rangos inválidos', () => {
  const doc = documento([
    { type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] },
  ])
  const parrafo = obtenerParrafo(doc, 0)

  assert.equal(rangoProseMirror(parrafo, -1, 2), null)
  assert.equal(rangoProseMirror(parrafo, 2, 2), null)
  assert.equal(rangoProseMirror(parrafo, 3, 2), null)
  assert.equal(rangoProseMirror(parrafo, 2, 5), null)
  assert.equal(posicionProseMirror(parrafo, -1), null)
  assert.equal(posicionProseMirror(parrafo, 5), null)
  assert.equal(posicionProseMirror(parrafo, 4), 5)
})

test('descarta MORFOLOGIK y conserva AGREEMENT_DET_NOUN', async () => {
  const fetchOriginal = globalThis.fetch
  const urlOriginal = process.env.LANGUAGETOOL_URL

  process.env.LANGUAGETOOL_URL = 'https://languagetool.test'

  const texto = 'Esta es una cassa bonita y los niño juegan.'
  const coincidencias = [
    {
      message: 'Posible error ortográfico',
      offset: 12,
      length: 5,
      rule: { id: 'MORFOLOGIK_RULE_ES', issueType: 'misspelling' },
    },
    {
      message: 'Posible error de concordancia',
      offset: 27,
      length: 8,
      rule: { id: 'AGREEMENT_DET_NOUN', issueType: 'grammar' },
    },
    {
      message: 'Otra falta simulada',
      offset: 0,
      length: 4,
      rule: { id: 'HUNSPELL_RULE_ES' },
    },
  ]

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ matches: coincidencias }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch

  try {
    const errores = await revisarConLanguageTool({
      parrafos: [{ clave: 'p1', texto }],
    })

    assert.equal(errores.length, 1)
    assert.deepEqual(errores[0], {
      clave: 'p1',
      inicio: 27,
      fin: 35,
      mensaje: 'Posible error de concordancia',
      regla: 'AGREEMENT_DET_NOUN',
    })
  } finally {
    globalThis.fetch = fetchOriginal
    if (urlOriginal === undefined) {
      delete process.env.LANGUAGETOOL_URL
    } else {
      process.env.LANGUAGETOOL_URL = urlOriginal
    }
  }
})
