import type { JSONContent } from '@tiptap/core'
import { ErrorApi, solicitarJson } from './api'
import type {
  DocumentoApi,
  DocumentoResumen,
} from './documentosTipos'
import {
  LIMITE_TITULO,
  TITULO_POR_DEFECTO,
} from './documentosTipos'
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

export type { DocumentoResumen } from './documentosTipos'

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
  titulo: string
  version: typeof VERSION_ACTUAL
  tipoDocumento: TipoDocumentoId
  contenido: JSONContent
  actualizadoEn: string
}

/**
 * Resultado de la carga inicial.
 *
 * `esNuevo` indica si el documento se acaba de crear, para que la app pueda
 * mostrar la elección inicial del tipo de documento.
 */
export type ResultadoCargaDocumento = {
  documento: DocumentoGuardado
  esNuevo: boolean
}

type DocumentoCrudo = {
  id: string
  titulo?: unknown
  version: number
  tipoDocumento?: unknown
  contenido: JSONContent
  actualizadoEn: string
}

type DocumentoLeido = {
  documento: DocumentoGuardado
  requiereGuardado: boolean
}

/**
 * La carga sin ID se memoiza para que StrictMode no cree dos documentos en el
 * primer mount. Se invalida al cerrar sesión o al crear un documento nuevo.
 */
let cargaInicial: Promise<ResultadoCargaDocumento> | null = null

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
 * - El título es opcional en documentos antiguos; sin él se usa «Sin título».
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
  const titulo =
    typeof valor.titulo === 'string' && valor.titulo.trim().length > 0
      ? valor.titulo.trim().slice(0, LIMITE_TITULO)
      : TITULO_POR_DEFECTO
  const { contenido, cambiado: idsCambiados } = asegurarIdsContenido(
    valor.contenido,
  )

  return {
    documento: {
      id: valor.id,
      titulo,
      version: VERSION_ACTUAL,
      tipoDocumento,
      contenido,
      actualizadoEn: valor.actualizadoEn,
    },
    requiereGuardado:
      valor.version !== VERSION_ACTUAL || !tipoValido || idsCambiados,
  }
}

function leerDocumentoActual(): string | null {
  try {
    const id = localStorage.getItem(CLAVE_DOCUMENTO_ACTUAL)
    return id && id.length > 0 ? id : null
  } catch {
    return null
  }
}

function recordarDocumento(id: string): void {
  try {
    localStorage.setItem(CLAVE_DOCUMENTO_ACTUAL, id)
  } catch {
    // Si localStorage no está disponible, el documento sigue guardado en la
    // base; solo se pierde el atajo al último documento abierto.
  }
}

export function limpiarDocumentoActual(): void {
  cargaInicial = null

  try {
    localStorage.removeItem(CLAVE_DOCUMENTO_ACTUAL)
  } catch {
    // Nada que limpiar si localStorage está bloqueado.
  }
}

function aDocumentoGuardado(api: DocumentoApi): DocumentoLeido {
  const leido = migrarDocumento({
    id: api.id,
    titulo: api.titulo,
    version: api.version,
    tipoDocumento: api.tipoDocumento,
    contenido: api.contenido as JSONContent,
    actualizadoEn: api.actualizadoEn,
  })

  if (!leido) {
    throw new ErrorApi(
      'respuesta_invalida',
      502,
      'El servidor devolvió un documento con un formato no válido.',
    )
  }

  return leido
}

async function cargarDocumentoPorId(id: string): Promise<DocumentoGuardado> {
  const respuesta = await solicitarJson<{ documento: DocumentoApi }>(
    `/api/documentos/${encodeURIComponent(id)}`,
  )
  const leido = aDocumentoGuardado(respuesta.documento)

  if (leido.requiereGuardado) {
    await guardarDocumento(leido.documento)
  }

  recordarDocumento(id)
  return leido.documento
}

/**
 * Carga un documento por ID.
 *
 * Sin ID usa el puntero de localStorage; si no existe o ya no es accesible,
 * abre el documento más reciente o crea uno vacío.
 */
export function cargarDocumento(
  id?: string,
): Promise<ResultadoCargaDocumento> {
  if (id) {
    return cargarDocumentoPorId(id).then((documento) => ({
      documento,
      esNuevo: false,
    }))
  }

  if (!cargaInicial) {
    cargaInicial = cargarDocumentoInicial().catch((error: unknown) => {
      cargaInicial = null
      throw error
    })
  }

  return cargaInicial
}

async function cargarDocumentoInicial(): Promise<ResultadoCargaDocumento> {
  const idActual = leerDocumentoActual()

  if (idActual) {
    try {
      return {
        documento: await cargarDocumentoPorId(idActual),
        esNuevo: false,
      }
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.estado !== 404) throw error
    }
  }

  const documentos = await listarDocumentos()

  if (documentos.length > 0) {
    return {
      documento: await cargarDocumentoPorId(documentos[0]!.id),
      esNuevo: false,
    }
  }

  return { documento: await crearDocumento(), esNuevo: true }
}

/**
 * Guarda el contenido y el tipo del documento en la API.
 *
 * El ID forma parte de la URL: aunque una petición llegue tarde, el servidor
 * solo puede escribir en ese documento y comprueba que pertenece al usuario de
 * la sesión.
 */
export async function guardarDocumento(
  documento: DocumentoGuardado,
): Promise<void> {
  await solicitarJson(`/api/documentos/${encodeURIComponent(documento.id)}/contenido`, {
    method: 'PUT',
    body: JSON.stringify({
      contenido: documento.contenido,
      tipoDocumento: documento.tipoDocumento,
    }),
  })

  recordarDocumento(documento.id)
}

export async function listarDocumentos(): Promise<DocumentoResumen[]> {
  const respuesta = await solicitarJson<{ documentos: DocumentoResumen[] }>(
    '/api/documentos',
  )
  return respuesta.documentos
}

export async function crearDocumento(opciones: {
  titulo?: string
  tipoDocumento?: TipoDocumentoId
} = {}): Promise<DocumentoGuardado> {
  const respuesta = await solicitarJson<{ documento: DocumentoApi }>(
    '/api/documentos',
    {
      method: 'POST',
      body: JSON.stringify(opciones),
    },
  )

  const { documento } = aDocumentoGuardado(respuesta.documento)
  recordarDocumento(documento.id)
  return documento
}

export async function renombrarDocumento(
  id: string,
  titulo: string,
): Promise<DocumentoResumen> {
  const respuesta = await solicitarJson<{ documento: DocumentoApi }>(
    `/api/documentos/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ titulo }),
    },
  )
  const { documento } = aDocumentoGuardado(respuesta.documento)

  return {
    id: documento.id,
    titulo: documento.titulo,
    tipoDocumento: documento.tipoDocumento,
    creadoEn: respuesta.documento.creadoEn,
    actualizadoEn: documento.actualizadoEn,
  }
}

export async function borrarDocumento(id: string): Promise<void> {
  await solicitarJson(`/api/documentos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (leerDocumentoActual() === id) limpiarDocumentoActual()
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
