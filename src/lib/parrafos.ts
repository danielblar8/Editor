import type { Editor } from '@tiptap/core'

/**
 * Extrae el texto de los bloques de nivel superior del editor (párrafos,
 * títulos y listas) sin modificar el documento.
 *
 * Solo es lectura: no usa comandos de TipTap ni cambia la selección. Los
 * bloques vacíos se descartan para no enviar ruido al tutor.
 */
export function extraerParrafos(editor: Editor): string[] {
  const parrafos: string[] = []

  editor.state.doc.forEach((nodo) => {
    const texto = nodo
      .textBetween(0, nodo.content.size, ' ')
      .replace(/\s+/gu, ' ')
      .trim()

    if (texto.length > 0) parrafos.push(texto)
  })

  return parrafos
}

/**
 * El backend divide el documento por líneas en blanco y numera los párrafos
 * solo para el prompt. El cliente no guarda ni envía IDs.
 */
export function unirParrafos(parrafos: string[]): string {
  return parrafos.join('\n\n')
}
