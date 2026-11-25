import { z } from 'zod'
import type { TipoDocumentoId } from './tiposDocumento.ts'
import {
  esTipoDocumentoId,
  TIPO_DOCUMENTO_POR_DEFECTO,
} from './tiposDocumento.ts'

/**
 * Contrato compartido de documentos.
 *
 * El contenido es siempre JSON de TipTap. El servidor comprueba la forma
 * básica y el tamaño; el cliente sigue aplicando las migraciones de contenido.
 */
export const VERSION_CONTENIDO = 3
export const LIMITE_TITULO = 200
export const LIMITE_CONTENIDO_BYTES = 1_000_000
export const TITULO_POR_DEFECTO = 'Sin título'

export const esquemaTipoDocumento = z.custom<TipoDocumentoId>(
  (valor) => esTipoDocumentoId(valor),
  { message: 'El tipo de documento no es válido.' },
)

export const esquemaTitulo = z
  .string()
  .trim()
  .min(1, 'El título no puede estar vacío.')
  .max(
    LIMITE_TITULO,
    `El título no puede superar ${LIMITE_TITULO} caracteres.`,
  )

export const esquemaContenidoDocumento = z.custom<Record<string, unknown>>(
  (valor) =>
    typeof valor === 'object' &&
    valor !== null &&
    !Array.isArray(valor) &&
    (valor as { type?: unknown }).type === 'doc',
  { message: 'El contenido debe ser un documento JSON de TipTap.' },
)

export const esquemaCrearDocumento = z.object({
  titulo: esquemaTitulo.optional(),
  tipoDocumento: esquemaTipoDocumento.optional(),
})

export const esquemaRenombrarDocumento = z
  .object({
    titulo: esquemaTitulo.optional(),
    tipoDocumento: esquemaTipoDocumento.optional(),
  })
  .refine(
    (valor) => valor.titulo !== undefined || valor.tipoDocumento !== undefined,
    { message: 'Indica un título o un tipo de documento.' },
  )

export const esquemaGuardarContenido = z.object({
  contenido: esquemaContenidoDocumento,
  tipoDocumento: esquemaTipoDocumento,
})

export type PeticionCrearDocumento = z.infer<typeof esquemaCrearDocumento>
export type PeticionRenombrarDocumento = z.infer<
  typeof esquemaRenombrarDocumento
>
export type PeticionGuardarContenido = z.infer<typeof esquemaGuardarContenido>

export type DocumentoResumen = {
  id: string
  titulo: string
  tipoDocumento: TipoDocumentoId
  creadoEn: string
  actualizadoEn: string
}

export type DocumentoApi = DocumentoResumen & {
  version: number
  contenido: Record<string, unknown>
}

export { TIPO_DOCUMENTO_POR_DEFECTO }
