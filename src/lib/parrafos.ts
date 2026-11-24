import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { ParrafoConId } from './parrafosIds'

function idDelBloque(nodo: PMNode): string | null {
  const valor: unknown = nodo.attrs.parrafoId
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}

/**
 * Extrae los bloques de nivel superior del documento con su ID persistente.
 *
 * La numeración del tutor es 1..N sobre esta misma lista: un título es un
 * bloque y una lista completa es un bloque (su `textBetween` une los
 * elementos). Por eso el ID que se usa para resaltar una lista es el del
 * contenedor (`bulletList`/`orderedList`), no el de cada `listItem` interno.
 *
 * Solo es lectura: no usa comandos de TipTap ni cambia la selección. Los
 * bloques vacíos se descartan para no enviar ruido al tutor.
 */
export function extraerParrafosConIdDeDoc(doc: PMNode): ParrafoConId[] {
  const parrafos: ParrafoConId[] = []

  doc.forEach((nodo) => {
    const texto = nodo
      .textBetween(0, nodo.content.size, ' ')
      .replace(/\s+/gu, ' ')
      .trim()

    if (texto.length > 0) {
      parrafos.push({ id: idDelBloque(nodo), texto })
    }
  })

  return parrafos
}

export function extraerParrafosConId(editor: Editor): ParrafoConId[] {
  return extraerParrafosConIdDeDoc(editor.state.doc)
}

/**
 * Extrae solo el texto de los bloques de nivel superior. Se deriva de
 * `extraerParrafosConId` para que ambas vistas cuenten exactamente los mismos
 * bloques y en el mismo orden.
 */
export function extraerParrafos(editor: Editor): string[] {
  return extraerParrafosConId(editor).map((parrafo) => parrafo.texto)
}

/**
 * El backend divide el documento por líneas en blanco y numera los párrafos
 * solo para el prompt. El cliente conserva la foto de IDs de esa misma lista
 * para traducir `parrafo_id` a un ID persistente sin cambiar el contrato.
 */
export function unirParrafos(parrafos: string[]): string {
  return parrafos.join('\n\n')
}
