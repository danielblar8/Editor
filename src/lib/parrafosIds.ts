import type { JSONContent } from '@tiptap/core'

/**
 * Tipos de nodo que reciben un ID persistente.
 *
 * El tutor numera los bloques de nivel superior (párrafos, títulos y listas
 * completas). Por eso el contenedor de lista también lleva ID: es el bloque
 * que `extraerParrafos` cuenta como un solo párrafo. Los nodos internos
 * (listItem y sus párrafos) reciben ID propio para que cualquier bloque tenga
 * uno estable, pero la numeración del tutor sigue usando solo el nivel superior.
 */
export const TIPOS_BLOQUE_CON_ID = [
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'codeBlock',
] as const

const CONJUNTO_TIPOS = new Set<string>(TIPOS_BLOQUE_CON_ID)

export type ParrafoConId = {
  id: string | null
  texto: string
}

export type ResultadoIdsContenido = {
  contenido: JSONContent
  cambiado: boolean
}

export function esTipoBloqueConId(tipo: string | undefined): boolean {
  return typeof tipo === 'string' && CONJUNTO_TIPOS.has(tipo)
}

/**
 * Genera un ID nuevo. Siempre lo llama el código de la app: el agente nunca
 * propone ni elige IDs.
 */
export function crearIdParrafo(): string {
  return crypto.randomUUID()
}

export function leerIdParrafo(nodo: JSONContent): string | null {
  const valor = nodo.attrs?.parrafoId
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}

function asegurarNodo(
  nodo: JSONContent,
  vistos: Set<string>,
): ResultadoIdsContenido {
  let resultado = nodo
  let cambiado = false

  if (esTipoBloqueConId(nodo.type)) {
    const idActual = leerIdParrafo(nodo)
    const idValido = idActual !== null && !vistos.has(idActual)
    const id = idValido && idActual ? idActual : crearIdParrafo()

    vistos.add(id)

    if (!idValido) {
      resultado = {
        ...resultado,
        attrs: { ...resultado.attrs, parrafoId: id },
      }
      cambiado = true
    }
  }

  if (resultado.content) {
    let contenidoCambiado = false
    const content = resultado.content.map((hijo) => {
      const asegurado = asegurarNodo(hijo, vistos)
      if (asegurado.cambiado) contenidoCambiado = true
      return asegurado.contenido
    })

    if (contenidoCambiado) {
      resultado = { ...resultado, content }
      cambiado = true
    }
  }

  return { contenido: resultado, cambiado }
}

/**
 * Recorre el JSON de TipTap y garantiza que cada bloque tenga un ID único.
 *
 * - Solo añade `attrs.parrafoId`. Nunca toca `text`, `content`, `marks` ni el
 *   orden de los nodos, así que el texto visible no cambia.
 * - Si un ID está repetido (por ejemplo, al pegar contenido), conserva el
 *   primero que aparece en el documento y asigna uno nuevo a los siguientes.
 * - Si no hace falta cambiar nada, devuelve la misma referencia.
 */
export function asegurarIdsContenido(
  contenido: JSONContent,
): ResultadoIdsContenido {
  return asegurarNodo(contenido, new Set<string>())
}
