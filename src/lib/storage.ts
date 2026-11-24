import type { JSONContent } from '@tiptap/core'
import { asegurarIdsContenido } from './parrafosIds'
import type { PreferenciaTema } from './tema'
import {
  esPreferenciaTema,
  PREFERENCIA_TEMA_POR_DEFECTO,
} from './tema'
import type { TipoDocumentoId } from './tiposDocumento'
import {
  esTipoDocumentoId,
  TIPO_DOCUMENTO_POR_DEFECTO,
} from './tiposDocumento'

const PREFIJO_CLAVES = 'editor-tutor-ia'
const CLAVE_DOCUMENTO_ACTUAL = `${PREFIJO_CLAVES}:documento-actual`
// La clave y los valores válidos también están duplicados en el script inline
// de index.html para aplicar el tema antes de cargar React. Mantén ambos
// sitios sincronizados.
const CLAVE_PREFERENCIA_TEMA = `${PREFIJO_CLAVES}:tema`
const VERSION_ACTUAL = 3
const VERSION_SIN_TIPO_DOCUMENTO = 1
const VERSION_SIN_IDS = 2

/**
 * Documento persistido. El contenido es siempre JSON de TipTap, nunca HTML ni
 * texto plano.
 *
 * La versión 2 añadió `tipoDocumento`; la versión 3 añade un `parrafoId`
 * estable a cada bloque del contenido. Los documentos de las versiones 1 y 2
 * se migran al cargarlos, sin perder contenido ni cambiar el texto visible.
 */
export type DocumentoGuardado = {
  id: string
  version: typeof VERSION_ACTUAL
  tipoDocumento: TipoDocumentoId
  contenido: JSONContent
  actualizadoEn: string
}

/**
 * Resultado de la carga inicial.
 *
 * `esNuevo` indica si el documento se acaba de crear, para que la app pueda
 * mostrar la elección inicial del tipo de documento. Un documento migrado
 * desde la versión 1 no es nuevo.
 */
export type ResultadoCargaDocumento = {
  documento: DocumentoGuardado
  esNuevo: boolean
}

type DocumentoCrudo = {
  id: string
  version: number
  tipoDocumento?: unknown
  contenido: JSONContent
  actualizadoEn: string
}

type DocumentoLeido = {
  documento: DocumentoGuardado
  requiereGuardado: boolean
}

function claveDocumento(id: string): string {
  return `${PREFIJO_CLAVES}:documento:${id}`
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

function esDocumentoBase(valor: unknown): valor is DocumentoCrudo {
  if (!esObjeto(valor)) return false

  return (
    typeof valor.id === 'string' &&
    valor.id.length > 0 &&
    typeof valor.version === 'number' &&
    typeof valor.actualizadoEn === 'string' &&
    esObjeto(valor.contenido) &&
    valor.contenido.type === 'doc'
  )
}

/**
 * Convierte un registro guardado en la forma actual.
 *
 * - Versión 1: se añade `tipoDocumento` con el valor por defecto.
 * - Versión 2: se respeta el tipo si es conocido; si no, se usa el defecto.
 * - Todas las versiones reciben IDs de párrafo estables al pasar a la 3. Un ID
 *   repetido se reemplaza por uno nuevo para mantener la unicidad.
 * - Cualquier otra versión se descarta.
 *
 * Exportada para las pruebas unitarias; el resto de la app usa
 * `cargarDocumento` y `guardarDocumento`.
 */
export function migrarDocumento(valor: unknown): DocumentoLeido | null {
  if (!esDocumentoBase(valor)) return null

  if (
    valor.version !== VERSION_SIN_TIPO_DOCUMENTO &&
    valor.version !== VERSION_SIN_IDS &&
    valor.version !== VERSION_ACTUAL
  ) {
    return null
  }

  const tipoValido = esTipoDocumentoId(valor.tipoDocumento)
  const tipoDocumento = esTipoDocumentoId(valor.tipoDocumento)
    ? valor.tipoDocumento
    : TIPO_DOCUMENTO_POR_DEFECTO
  const { contenido, cambiado: idsCambiados } = asegurarIdsContenido(
    valor.contenido,
  )

  return {
    documento: {
      id: valor.id,
      version: VERSION_ACTUAL,
      tipoDocumento,
      contenido,
      actualizadoEn: valor.actualizadoEn,
    },
    requiereGuardado:
      valor.version !== VERSION_ACTUAL || !tipoValido || idsCambiados,
  }
}

function crearDocumentoVacio(id: string): DocumentoGuardado {
  const { contenido } = asegurarIdsContenido({
    type: 'doc',
    content: [{ type: 'paragraph' }],
  })

  return {
    id,
    version: VERSION_ACTUAL,
    tipoDocumento: TIPO_DOCUMENTO_POR_DEFECTO,
    contenido,
    actualizadoEn: new Date().toISOString(),
  }
}

function leerDocumento(id: string): DocumentoLeido | null {
  const crudo = localStorage.getItem(claveDocumento(id))
  if (!crudo) return null

  try {
    const parseado: unknown = JSON.parse(crudo)
    const leido = migrarDocumento(parseado)
    if (!leido || leido.documento.id !== id) return null
    return leido
  } catch {
    return null
  }
}

async function cargarDocumentoInterno(): Promise<ResultadoCargaDocumento> {
  const idActual = localStorage.getItem(CLAVE_DOCUMENTO_ACTUAL)

  if (idActual) {
    const leido = leerDocumento(idActual)
    if (leido) {
      // Si venía de la versión 1, se reescribe ya migrado para no repetir la
      // conversión en cada carga.
      if (leido.requiereGuardado) {
        await guardarDocumento(leido.documento)
      }

      return { documento: leido.documento, esNuevo: false }
    }
  }

  const nuevo = crearDocumentoVacio(crypto.randomUUID())
  await guardarDocumento(nuevo)
  return { documento: nuevo, esNuevo: true }
}

/**
 * La carga inicial se memoiza durante la sesión.
 *
 * React StrictMode monta los efectos dos veces en desarrollo: sin esta caché,
 * la segunda llamada encontraría el documento recién creado por la primera y
 * respondería `esNuevo: false`, ocultando el diálogo de tipo de documento.
 * Si la carga falla, se olvida la promesa para permitir un reintento.
 */
let cargaInicial: Promise<ResultadoCargaDocumento> | null = null

/**
 * Carga el documento actual. Si es la primera visita, crea uno vacío con un ID
 * único y lo persiste antes de devolverlo.
 *
 * La firma es asíncrona a propósito: hoy usa localStorage, pero puede
 * sustituirse por IndexedDB o una base de datos sin cambiar a los consumidores.
 */
export function cargarDocumento(): Promise<ResultadoCargaDocumento> {
  if (!cargaInicial) {
    cargaInicial = cargarDocumentoInterno().catch((error: unknown) => {
      cargaInicial = null
      throw error
    })
  }

  return cargaInicial
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

/**
 * Lee la preferencia de tema. Es independiente del documento guardado y no
 * cambia su formato. Si el almacenamiento falla o el valor no es válido, usa
 * «sistema».
 */
export function cargarPreferenciaTema(): PreferenciaTema {
  try {
    const valor = localStorage.getItem(CLAVE_PREFERENCIA_TEMA)
    return esPreferenciaTema(valor)
      ? valor
      : PREFERENCIA_TEMA_POR_DEFECTO
  } catch {
    return PREFERENCIA_TEMA_POR_DEFECTO
  }
}

/**
 * Guarda la preferencia de tema. Un fallo de almacenamiento no impide cambiar
 * el tema durante la sesión; simplemente no se conserva al recargar.
 */
export function guardarPreferenciaTema(
  preferencia: PreferenciaTema,
): void {
  try {
    localStorage.setItem(CLAVE_PREFERENCIA_TEMA, preferencia)
  } catch {
    // El tema sigue funcionando en memoria durante esta sesión.
  }
}
