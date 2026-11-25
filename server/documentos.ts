import { randomUUID } from 'node:crypto'
import type {
  DocumentoApi,
  DocumentoResumen,
} from '../src/lib/documentosTipos.ts'
import {
  TIPO_DOCUMENTO_POR_DEFECTO,
  TITULO_POR_DEFECTO,
  VERSION_CONTENIDO,
} from '../src/lib/documentosTipos.ts'
import type { TipoDocumentoId } from '../src/lib/tiposDocumento.ts'
import { consultar } from './db.ts'

type FilaDocumento = {
  id: string
  titulo: string
  tipo_documento: string
  version: number
  contenido: Record<string, unknown>
  creado_en: Date | string
  actualizado_en: Date | string
}

function fechaIso(valor: Date | string): string {
  return valor instanceof Date ? valor.toISOString() : new Date(valor).toISOString()
}

function aResumen(fila: FilaDocumento): DocumentoResumen {
  return {
    id: fila.id,
    titulo: fila.titulo,
    tipoDocumento: fila.tipo_documento as TipoDocumentoId,
    creadoEn: fechaIso(fila.creado_en),
    actualizadoEn: fechaIso(fila.actualizado_en),
  }
}

function aDocumento(fila: FilaDocumento): DocumentoApi {
  return {
    ...aResumen(fila),
    version: fila.version,
    contenido: fila.contenido,
  }
}

/**
 * Contenido inicial de un documento. Incluye un `parrafoId` para que el editor
 * pueda resaltar y revisar el bloque desde el primer momento. El texto sigue
 * siendo un párrafo vacío.
 */
function contenidoVacio(): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { parrafoId: randomUUID() },
      },
    ],
  }
}

export async function listarDocumentos(
  usuarioId: string,
): Promise<DocumentoResumen[]> {
  const resultado = await consultar<FilaDocumento>(
    `select id, titulo, tipo_documento, version, contenido, creado_en, actualizado_en
       from documentos
      where usuario_id = $1
      order by actualizado_en desc`,
    [usuarioId],
  )

  return resultado.rows.map(aResumen)
}

export async function crearDocumento(
  usuarioId: string,
  datos: { titulo?: string; tipoDocumento?: TipoDocumentoId },
): Promise<DocumentoApi> {
  const resultado = await consultar<FilaDocumento>(
    `insert into documentos (usuario_id, titulo, tipo_documento, version, contenido)
     values ($1, $2, $3, $4, $5::jsonb)
     returning id, titulo, tipo_documento, version, contenido, creado_en, actualizado_en`,
    [
      usuarioId,
      datos.titulo ?? TITULO_POR_DEFECTO,
      datos.tipoDocumento ?? TIPO_DOCUMENTO_POR_DEFECTO,
      VERSION_CONTENIDO,
      contenidoVacio(),
    ],
  )

  return aDocumento(resultado.rows[0]!)
}

export async function obtenerDocumento(
  usuarioId: string,
  id: string,
): Promise<DocumentoApi | null> {
  const resultado = await consultar<FilaDocumento>(
    `select id, titulo, tipo_documento, version, contenido, creado_en, actualizado_en
       from documentos
      where id = $1 and usuario_id = $2`,
    [id, usuarioId],
  )

  const fila = resultado.rows[0]
  return fila ? aDocumento(fila) : null
}

export async function actualizarDocumento(
  usuarioId: string,
  id: string,
  datos: { titulo?: string; tipoDocumento?: TipoDocumentoId },
): Promise<DocumentoApi | null> {
  const resultado = await consultar<FilaDocumento>(
    `update documentos
        set titulo = coalesce($3::text, titulo),
            tipo_documento = coalesce($4::text, tipo_documento),
            actualizado_en = now()
      where id = $1 and usuario_id = $2
      returning id, titulo, tipo_documento, version, contenido, creado_en, actualizado_en`,
    [id, usuarioId, datos.titulo ?? null, datos.tipoDocumento ?? null],
  )

  const fila = resultado.rows[0]
  return fila ? aDocumento(fila) : null
}

export async function guardarContenido(
  usuarioId: string,
  id: string,
  datos: {
    contenido: Record<string, unknown>
    tipoDocumento: TipoDocumentoId
  },
): Promise<DocumentoApi | null> {
  const resultado = await consultar<FilaDocumento>(
    `update documentos
        set contenido = $3::jsonb,
            tipo_documento = $4::text,
            version = $5::smallint,
            actualizado_en = now()
      where id = $1 and usuario_id = $2
      returning id, titulo, tipo_documento, version, contenido, creado_en, actualizado_en`,
    [
      id,
      usuarioId,
      datos.contenido,
      datos.tipoDocumento,
      VERSION_CONTENIDO,
    ],
  )

  const fila = resultado.rows[0]
  return fila ? aDocumento(fila) : null
}

export async function borrarDocumento(
  usuarioId: string,
  id: string,
): Promise<boolean> {
  const resultado = await consultar(
    'delete from documentos where id = $1 and usuario_id = $2',
    [id, usuarioId],
  )

  return (resultado.rowCount ?? 0) > 0
}
