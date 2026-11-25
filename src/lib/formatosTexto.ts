import type { Editor } from '@tiptap/core'

/**
 * Valor centinela para un menú cuando la selección mezcla varios valores.
 * No es un formato aplicable: la barra se limita a mostrarlo.
 */
export const VALOR_VARIOS = '__varios__'

export const OPCION_PREDETERMINADA = ''

export const FUENTES_SISTEMA = [
  { valor: 'Georgia, "Times New Roman", serif', etiqueta: 'Georgia (serif)' },
  { valor: '"Times New Roman", Times, serif', etiqueta: 'Times New Roman' },
  { valor: 'Arial, Helvetica, sans-serif', etiqueta: 'Arial' },
  { valor: 'Verdana, Geneva, sans-serif', etiqueta: 'Verdana' },
  { valor: 'Tahoma, Geneva, sans-serif', etiqueta: 'Tahoma' },
  { valor: '"Courier New", Courier, monospace', etiqueta: 'Courier New' },
] as const

export const TAMANOS_PT = [
  10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36,
] as const

export const OPCIONES_FUENTE = [
  { valor: OPCION_PREDETERMINADA, etiqueta: 'Predeterminada' },
  ...FUENTES_SISTEMA,
  { valor: VALOR_VARIOS, etiqueta: 'Varios' },
]

export const OPCIONES_TAMANO = [
  { valor: OPCION_PREDETERMINADA, etiqueta: 'Predeterminado' },
  ...TAMANOS_PT.map((puntos) => ({
    valor: `${puntos}pt`,
    etiqueta: `${puntos} pt`,
  })),
  { valor: VALOR_VARIOS, etiqueta: 'Varios' },
]

type AtributoTextStyle = 'fontFamily' | 'fontSize'

/**
 * Lee un atributo de `textStyle` en la selección actual.
 *
 * Con el cursor colapsado se usa `getAttributes`, que respeta las marcas
 * guardadas. Con un rango se recorren solo los nodos de texto: así el menú
 * muestra «Varios» cuando la selección no tiene un valor único. Es lectura:
 * no usa comandos ni mueve la selección.
 */
export function leerAtributoTextStyle(
  editor: Editor,
  atributo: AtributoTextStyle,
): string {
  const { from, to, empty } = editor.state.selection

  if (empty) {
    const valor: unknown = editor.getAttributes('textStyle')[atributo]
    return typeof valor === 'string' && valor.length > 0 ? valor : OPCION_PREDETERMINADA
  }

  let primero = true
  let valorActual = OPCION_PREDETERMINADA
  let mixto = false

  editor.state.doc.nodesBetween(from, to, (nodo) => {
    if (!nodo.isText) return

    const marca = nodo.marks.find((candidata) => candidata.type.name === 'textStyle')
    const valorBruto: unknown = marca?.attrs[atributo]
    const valor =
      typeof valorBruto === 'string' && valorBruto.length > 0
        ? valorBruto
        : OPCION_PREDETERMINADA

    if (primero) {
      valorActual = valor
      primero = false
    } else if (valor !== valorActual) {
      mixto = true
    }
  })

  if (primero) return OPCION_PREDETERMINADA
  return mixto ? VALOR_VARIOS : valorActual
}

export function aplicarFuente(editor: Editor, valor: string): void {
  if (valor === VALOR_VARIOS) return

  if (valor === OPCION_PREDETERMINADA) {
    editor.chain().focus().unsetFontFamily().run()
    return
  }

  editor.chain().focus().setFontFamily(valor).run()
}

export function aplicarTamano(editor: Editor, valor: string): void {
  if (valor === VALOR_VARIOS) return

  if (valor === OPCION_PREDETERMINADA) {
    editor.chain().focus().unsetFontSize().run()
    return
  }

  editor.chain().focus().setFontSize(valor).run()
}
