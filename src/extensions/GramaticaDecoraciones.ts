import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { CLAVE_META_GRAMATICA } from '../lib/gramatica'
import type { PayloadMetaGramatica } from '../lib/gramatica'
import type { ErrorDecoracionGramatica } from '../lib/gramaticaTipos'

export const clavePluginGramatica = new PluginKey<DecorationSet>(
  'gramaticaDecoraciones',
)

function crearDecoraciones(
  doc: PMNode,
  errores: ErrorDecoracionGramatica[],
): DecorationSet {
  const decoraciones: Decoration[] = []

  for (const error of errores) {
    if (
      error.from < 0 ||
      error.to <= error.from ||
      error.to > doc.content.size
    ) {
      continue
    }

    decoraciones.push(
      Decoration.inline(error.from, error.to, {
        class: 'error-gramatica',
        title: error.mensaje,
        'data-mensaje': error.mensaje,
        'data-regla': error.regla,
      }),
    )
  }

  return DecorationSet.create(doc, decoraciones)
}

export const GramaticaDecoraciones = Extension.create({
  name: 'gramaticaDecoraciones',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: clavePluginGramatica,
        state: {
          init: () => DecorationSet.empty,
          apply(transaccion, decoracionesAnteriores) {
            const payload = transaccion.getMeta(CLAVE_META_GRAMATICA) as
              | PayloadMetaGramatica
              | undefined

            if (payload) {
              return crearDecoraciones(transaccion.doc, payload.errores)
            }

            if (transaccion.docChanged) {
              return decoracionesAnteriores.map(
                transaccion.mapping,
                transaccion.doc,
              )
            }

            return decoracionesAnteriores
          },
        },
        props: {
          decorations(estado) {
            return clavePluginGramatica.getState(estado)
          },
        },
      }),
    ]
  },
})
