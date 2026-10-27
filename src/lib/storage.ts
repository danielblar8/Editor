import type { JSONContent } from '@tiptap/core'

const PREFIJO_CLAVES = 'editor-tutor-ia'
const CLAVE_DOCUMENTO_ACTUAL = `${PREFIJO_CLAVES}:documento-actual`
const VERSION_ACTUAL = 1

/**
 * Documento persistido. El contenido es siempre JSON de TipTap, nunca HTML ni
 * texto plano.
 */
export type DocumentoGuardado = {
  id: string
  version: typeof VERSION_ACTUAL
  contenido: JSONContent
  actualizadoEn: string
}

function claveDocumento(id: string): string {
  return `${PREFIJO_CLAVES}:documento:${id}`
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

function esDocumentoValido(valor: unknown): valor is DocumentoGuardado {
  if (!esObjeto(valor)) return false

  return (
    typeof valor.id === 'string' &&
    valor.id.length > 0 &&
    valor.version === VERSION_ACTUAL &&
    typeof valor.actualizadoEn === 'string' &&
    esObjeto(valor.contenido) &&
    valor.contenido.type === 'doc'
  )
}

function crearDocumentoVacio(id: string): DocumentoGuardado {
  return {
    id,
    version: VERSION_ACTUAL,
    contenido: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    actualizadoEn: new Date().toISOString(),
  }
}

function leerDocumento(id: string): DocumentoGuardado | null {
  const crudo = localStorage.getItem(claveDocumento(id))
  if (!crudo) return null

  try {
    const parseado: unknown = JSON.parse(crudo)
    if (!esDocumentoValido(parseado) || parseado.id !== id) return null
    return parseado
  } catch {
    return null
  }
}

/**
 * Carga el documento actual. Si es la primera visita, crea uno vacío con un ID
 * único y lo persiste antes de devolverlo.
 *
 * La firma es asíncrona a propósito: hoy usa localStorage, pero puede
 * sustituirse por IndexedDB o una base de datos sin cambiar a los consumidores.
 */
export async function cargarDocumento(): Promise<DocumentoGuardado> {
  const idActual = localStorage.getItem(CLAVE_DOCUMENTO_ACTUAL)

  if (idActual) {
    const documento = leerDocumento(idActual)
    if (documento) return documento
  }

  const nuevo = crearDocumentoVacio(crypto.randomUUID())
  await guardarDocumento(nuevo)
  return nuevo
}

/**
 * Persiste el documento completo y lo marca como documento actual.
 *
 * Se escribe primero el documento y después el puntero, para que un fallo a
 * mitad de la operación no deje el puntero apuntando a un documento inexistente.
 */
export async function guardarDocumento(
  documento: DocumentoGuardado,
): Promise<void> {
  localStorage.setItem(
    claveDocumento(documento.id),
    JSON.stringify(documento),
  )
  localStorage.setItem(CLAVE_DOCUMENTO_ACTUAL, documento.id)
}
