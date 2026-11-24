import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { ResaltadoParrafo } from '../lib/observaciones'
import { ETIQUETAS_TIPO_PROBLEMA } from '../lib/revisionTipos'

export const CLAVE_META_OBSERVACIONES = 'observacionesDecoraciones'

export type PayloadMetaObservaciones = {
  resaltados: ResaltadoParrafo[]
}

type EstadoObservaciones = {
  resaltados: ResaltadoParrafo[]
  decoraciones: DecorationSet
}

export const clavePluginObservaciones = new PluginKey<EstadoObservaciones>(
  'observacionesDecoraciones',
)

/**
 * Crea una decoración de nodo por cada bloque observado.
 *
 * Es `Decoration.node`, no `Decoration.inline` ni un mark: añade clases y
 * atributos al elemento del bloque sin tocar el texto, el JSON ni los marks
 * del documento. Como se localiza por `parrafoId`, un cambio de contenido o de
 * posición no deja el resaltado apuntando a otro párrafo.
 */
export function crearDecoracionesObservaciones(
  doc: PMNode,
  resaltados: readonly ResaltadoParrafo[],
): DecorationSet {
  if (resaltados.length === 0) return DecorationSet.empty

  const porId = new Map(
    resaltados.map((resaltado) => [resaltado.parrafoId, resaltado]),
  )
  const decoraciones: Decoration[] = []

  doc.descendants((nodo, pos) => {
    const id: unknown = nodo.attrs.parrafoId
    if (typeof id !== 'string') return true

    const resaltado = porId.get(id)
    if (!resaltado) return true

    decoraciones.push(
      Decoration.node(pos, pos + nodo.nodeSize, {
        class: `observacion-tutor observacion-tutor--${resaltado.severidad}`,
        'data-observacion-tipo': resaltado.tipo,
        'data-observacion-severidad': resaltado.severidad,
        title: `Observación del tutor: ${ETIQUETAS_TIPO_PROBLEMA[resaltado.tipo]}`,
      }, {
        parrafoId: resaltado.parrafoId,
        tipo: resaltado.tipo,
        severidad: resaltado.severidad,
      }),
    )

    return true
  })

  return DecorationSet.create(doc, decoraciones)
}

/**
 * Resalta en el editor los párrafos con observaciones del tutor.
 *
 * El estado guarda la lista de IDs, no posiciones. Si el documento cambia, las
 * decoraciones se reconstruyen desde los IDs: editar mantiene el resaltado y
 * borrar un bloque lo elimina sin errores. Las transacciones de metadatos no
 * cambian el documento, así que no disparan el autoguardado.
 */
export const ObservacionesDecoraciones = Extension.create({
  name: 'observacionesDecoraciones',

  addProseMirrorPlugins() {
    return [
      new Plugin<EstadoObservaciones>({
        key: clavePluginObservaciones,
        state: {
          init: () => ({
            resaltados: [],
            decoraciones: DecorationSet.empty,
          }),
          apply(transaccion, anterior) {
            const payload = transaccion.getMeta(CLAVE_META_OBSERVACIONES) as
              | PayloadMetaObservaciones
              | undefined

            if (payload) {
              return {
                resaltados: payload.resaltados,
                decoraciones: crearDecoracionesObservaciones(
                  transaccion.doc,
                  payload.resaltados,
                ),
              }
            }

            if (transaccion.docChanged) {
              return {
                resaltados: anterior.resaltados,
                decoraciones: crearDecoracionesObservaciones(
                  transaccion.doc,
                  anterior.resaltados,
                ),
              }
            }

            return anterior
          },
        },
        props: {
          decorations(estado) {
            return (
              clavePluginObservaciones.getState(estado)?.decoraciones ?? null
            )
          },
        },
      }),
    ]
  },
})
