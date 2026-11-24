import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import {
  crearIdParrafo,
  esTipoBloqueConId,
  TIPOS_BLOQUE_CON_ID,
} from '../lib/parrafosIds'

export const clavePluginParrafoId = new PluginKey('parrafoId')

/**
 * Asigna IDs nuevos a los bloques sin ID o con un ID ya visto antes.
 *
 * `doc.descendants` devuelve posiciones del documento original; cambiar solo
 * atributos no altera esas posiciones, así que se pueden aplicar todos los
 * cambios en una sola transacción.
 */
function repararIds(doc: PMNode, transaccion: Transaction): boolean {
  const vistos = new Set<string>()
  let cambiado = false

  doc.descendants((nodo, pos) => {
    if (!esTipoBloqueConId(nodo.type.name)) return true

    const actual: unknown = nodo.attrs.parrafoId

    if (
      typeof actual === 'string' &&
      actual.length > 0 &&
      !vistos.has(actual)
    ) {
      vistos.add(actual)
      return true
    }

    const id = crearIdParrafo()
    vistos.add(id)
    transaccion.setNodeAttribute(pos, 'parrafoId', id)
    cambiado = true

    return true
  })

  return cambiado
}

/**
 * ID persistente por bloque.
 *
 * - Se guarda como atributo de nodo (`parrafoId`) y se serializa como
 *   `data-parrafo-id`; nunca como mark ni como texto.
 * - `keepOnSplit: false`: al pulsar Enter, el bloque nuevo nace sin ID y el
 *   plugin le asigna uno propio. El bloque original conserva el suyo.
 * - La reparación se marca como no historial y con `preventUpdate` para no
 *   ensuciar deshacer ni disparar autoguardado o gramática.
 */
export const ParrafoId = Extension.create({
  name: 'parrafoId',

  addGlobalAttributes() {
    return [
      {
        types: [...TIPOS_BLOQUE_CON_ID],
        attributes: {
          parrafoId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element) => element.getAttribute('data-parrafo-id'),
            renderHTML: (attributes) => {
              const id: unknown = attributes.parrafoId

              if (typeof id !== 'string' || id.length === 0) return {}

              return { 'data-parrafo-id': id }
            },
          },
        },
      },
    ]
  },

  onCreate() {
    const editor = this.editor
    const transaccion = editor.state.tr

    if (!repararIds(editor.state.doc, transaccion)) return

    transaccion.setMeta('addToHistory', false)
    transaccion.setMeta('preventUpdate', true)
    editor.view.dispatch(transaccion)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: clavePluginParrafoId,
        appendTransaction(transacciones, _estadoAnterior, estadoNuevo) {
          if (!transacciones.some((transaccion) => transaccion.docChanged)) {
            return null
          }

          const transaccion = estadoNuevo.tr

          if (!repararIds(estadoNuevo.doc, transaccion)) return null

          transaccion.setMeta('addToHistory', false)
          transaccion.setMeta('preventUpdate', true)

          return transaccion
        },
      }),
    ]
  },
})
