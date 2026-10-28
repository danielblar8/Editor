import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Bloque de texto extraído del documento.
 *
 * `inicio` es la posición absoluta de ProseMirror del primer carácter del
 * bloque (pos + 1) y `fin` es la posición inmediatamente posterior al último.
 * El texto no se normaliza: los offsets locales son los del texto tal cual se
 * envía a LanguageTool.
 */
export type ParrafoExtraido = {
  indice: number
  texto: string
  inicio: number
  fin: number
}

export type RangoProseMirror = {
  from: number
  to: number
}

function textoDelBloque(bloque: PMNode): string {
  let texto = ''

  bloque.forEach((hijo) => {
    if (hijo.isText) {
      texto += hijo.text ?? ''
      return
    }

    if (hijo.type.name === 'hardBreak') {
      texto += '\n'
      return
    }

    texto += '\uFFFC'
  })

  return texto
}

/**
 * Extrae cada textblock por separado, sin unir bloques ni normalizar espacios.
 *
 * Los hardBreak se convierten en "\n" y los nodos inline atómicos en "\uFFFC".
 * Así la longitud del texto coincide con `content.size` del bloque y los
 * offsets de LanguageTool se pueden trasladar a ProseMirror sin cálculos
 * adicionales.
 */
export function extraerParrafosConPosiciones(doc: PMNode): ParrafoExtraido[] {
  const parrafos: ParrafoExtraido[] = []

  doc.descendants((nodo, pos) => {
    if (!nodo.isTextblock) return true

    const texto = textoDelBloque(nodo)
    const inicio = pos + 1

    parrafos.push({
      indice: parrafos.length,
      texto,
      inicio,
      fin: inicio + texto.length,
    })

    return false
  })

  return parrafos
}

/**
 * Convierte un offset local del párrafo en una posición absoluta de
 * ProseMirror. Devuelve null si el offset no pertenece al texto.
 */
export function posicionProseMirror(
  parrafo: ParrafoExtraido,
  offset: number,
): number | null {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > parrafo.texto.length
  ) {
    return null
  }

  return parrafo.inicio + offset
}

/**
 * Convierte un rango local [inicio, fin) en un rango absoluto de ProseMirror.
 * Devuelve null si el rango es inválido o se sale del texto del párrafo.
 */
export function rangoProseMirror(
  parrafo: ParrafoExtraido,
  inicio: number,
  fin: number,
): RangoProseMirror | null {
  if (
    !Number.isInteger(inicio) ||
    !Number.isInteger(fin) ||
    inicio < 0 ||
    fin <= inicio ||
    fin > parrafo.texto.length
  ) {
    return null
  }

  return {
    from: parrafo.inicio + inicio,
    to: parrafo.inicio + fin,
  }
}
