import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { JSONContent } from '@tiptap/core'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { ParrafoId } from '../src/extensions/ParrafoId.ts'
import { extraerParrafosConIdDeDoc } from '../src/lib/parrafos.ts'
import { asegurarIdsContenido } from '../src/lib/parrafosIds.ts'
import { migrarDocumento } from '../src/lib/storage.ts'

const esquema = getSchema([StarterKit, ParrafoId])

function textoDeNodo(nodo: JSONContent): string {
  if (typeof nodo.text === 'string') return nodo.text
  return (nodo.content ?? []).map(textoDeNodo).join('')
}

function textos(contenido: JSONContent): string[] {
  return (contenido.content ?? []).map(textoDeNodo)
}

function ids(contenido: JSONContent): string[] {
  const encontrados: string[] = []

  const recorrer = (nodo: JSONContent) => {
    const id = nodo.attrs?.parrafoId
    if (typeof id === 'string') encontrados.push(id)
    for (const hijo of nodo.content ?? []) recorrer(hijo)
  }

  recorrer(contenido)
  return encontrados
}

function documentoV1(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hola mundo' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Título' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Uno' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Dos' }],
              },
            ],
          },
        ],
      },
    ],
  }
}

test('migra v1 a v3 añadiendo tipo e IDs sin cambiar el texto', () => {
  const contenidoOriginal = documentoV1()
  const leido = migrarDocumento({
    id: 'doc-1',
    version: 1,
    actualizadoEn: '2026-01-01T00:00:00.000Z',
    contenido: contenidoOriginal,
  })

  assert.ok(leido)
  assert.equal(leido.documento.id, 'doc-1')
  assert.equal(leido.documento.version, 3)
  assert.equal(leido.documento.tipoDocumento, 'texto-abierto')
  assert.equal(leido.requiereGuardado, true)
  assert.deepEqual(textos(leido.documento.contenido), ['Hola mundo', 'Título', 'UnoDos'])

  const todos = ids(leido.documento.contenido)
  assert.equal(todos.length, 7)
  assert.equal(new Set(todos).size, todos.length)
})

test('migra v2 a v3 conservando el tipo de documento', () => {
  const leido = migrarDocumento({
    id: 'doc-2',
    version: 2,
    tipoDocumento: 'ensayo-argumentativo',
    actualizadoEn: '2026-01-02T00:00:00.000Z',
    contenido: documentoV1(),
  })

  assert.ok(leido)
  assert.equal(leido.documento.version, 3)
  assert.equal(leido.documento.tipoDocumento, 'ensayo-argumentativo')
  assert.equal(leido.requiereGuardado, true)
  assert.equal(ids(leido.documento.contenido).length, 7)
})

test('un v2 con tipo desconocido cae al tipo por defecto', () => {
  const leido = migrarDocumento({
    id: 'doc-3',
    version: 2,
    tipoDocumento: 'inventado',
    actualizadoEn: '2026-01-02T00:00:00.000Z',
    contenido: documentoV1(),
  })

  assert.ok(leido)
  assert.equal(leido.documento.tipoDocumento, 'texto-abierto')
  assert.equal(leido.requiereGuardado, true)
})

test('un v3 completo no requiere guardado y conserva el contenido', () => {
  const { contenido } = asegurarIdsContenido(documentoV1())
  const leido = migrarDocumento({
    id: 'doc-4',
    version: 3,
    tipoDocumento: 'reporte-investigacion',
    actualizadoEn: '2026-01-03T00:00:00.000Z',
    contenido,
  })

  assert.ok(leido)
  assert.equal(leido.requiereGuardado, false)
  assert.equal(leido.documento.contenido, contenido)
  assert.deepEqual(textos(leido.documento.contenido), ['Hola mundo', 'Título', 'UnoDos'])
})

test('repara IDs duplicados conservando el primero', () => {
  const { contenido, cambiado } = asegurarIdsContenido({
    type: 'doc',
    content: [
      { type: 'paragraph', attrs: { parrafoId: 'dup' }, content: [{ type: 'text', text: 'A' }] },
      { type: 'paragraph', attrs: { parrafoId: 'dup' }, content: [{ type: 'text', text: 'B' }] },
    ],
  })

  assert.equal(cambiado, true)
  const [primero, segundo] = contenido.content ?? []
  assert.equal(primero?.attrs?.parrafoId, 'dup')
  assert.ok(typeof segundo?.attrs?.parrafoId === 'string')
  assert.notEqual(segundo?.attrs?.parrafoId, 'dup')
  assert.deepEqual(textos(contenido), ['A', 'B'])
})

test('una versión desconocida se descarta', () => {
  assert.equal(
    migrarDocumento({
      id: 'doc-5',
      version: 4,
      tipoDocumento: 'texto-abierto',
      actualizadoEn: '2026-01-04T00:00:00.000Z',
      contenido: documentoV1(),
    }),
    null,
  )
})

test('los IDs de una lista corresponden al contenedor de nivel superior', () => {
  const { contenido } = asegurarIdsContenido(documentoV1())
  const doc = esquema.nodeFromJSON(contenido)
  const bloques = extraerParrafosConIdDeDoc(doc)

  // Tres bloques de nivel superior, igual que los numera el backend.
  assert.equal(bloques.length, 3)
  assert.equal(bloques[0]?.texto, 'Hola mundo')
  assert.equal(bloques[1]?.texto, 'Título')
  assert.equal(bloques[2]?.texto, 'Uno Dos')

  const lista = contenido.content?.[2]
  assert.equal(bloques[2]?.id, lista?.attrs?.parrafoId)

  // El ID del contenedor no es el del listItem ni el del párrafo interno.
  const primerItem = lista?.content?.[0]
  const parrafoInterno = primerItem?.content?.[0]
  assert.notEqual(primerItem?.attrs?.parrafoId, bloques[2]?.id)
  assert.notEqual(parrafoInterno?.attrs?.parrafoId, bloques[2]?.id)
})

test('los bloques vacíos no cuentan y no alteran la numeración', () => {
  const doc = esquema.nodeFromJSON({
    type: 'doc',
    content: [
      { type: 'paragraph', attrs: { parrafoId: 'a' }, content: [{ type: 'text', text: 'Uno' }] },
      { type: 'paragraph', attrs: { parrafoId: 'b' } },
      { type: 'paragraph', attrs: { parrafoId: 'c' }, content: [{ type: 'text', text: 'Dos' }] },
    ],
  })

  const bloques = extraerParrafosConIdDeDoc(doc)
  assert.deepEqual(bloques, [
    { id: 'a', texto: 'Uno' },
    { id: 'c', texto: 'Dos' },
  ])
})

test('el texto del documento no cambia al asignar IDs', () => {
  const original = documentoV1()
  const antes = textos(original)
  const { contenido } = asegurarIdsContenido(original)

  assert.deepEqual(textos(contenido), antes)
  assert.equal(JSON.stringify(original).includes('parrafoId'), false)
})
