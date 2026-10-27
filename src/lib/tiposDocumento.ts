/**
 * Catálogo único de tipos de documento.
 *
 * De aquí salen los identificadores, los nombres visibles y las descripciones
 * que usan el selector, el diálogo inicial, el chat y el almacenamiento. En la
 * Fase 3 también se reutilizará para elegir el prompt base de cada tipo.
 */
export const TIPOS_DOCUMENTO = [
  {
    id: 'ensayo-argumentativo',
    nombre: 'Ensayo Argumentativo',
    descripcion:
      'Defiende una tesis con argumentos propios y una conclusión coherente.',
  },
  {
    id: 'reporte-investigacion',
    nombre: 'Reporte de Investigación',
    descripcion:
      'Presenta objetivo, método, resultados y conclusiones de una investigación.',
  },
  {
    id: 'texto-abierto',
    nombre: 'Texto Abierto / Sin Definir',
    descripcion:
      'Sin estructura predefinida; el tutor no aplicará una rúbrica concreta.',
  },
] as const

export type TipoDocumentoId = (typeof TIPOS_DOCUMENTO)[number]['id']
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

export const TIPO_DOCUMENTO_POR_DEFECTO: TipoDocumentoId = 'texto-abierto'

export function esTipoDocumentoId(valor: unknown): valor is TipoDocumentoId {
  return TIPOS_DOCUMENTO.some((tipo) => tipo.id === valor)
}

export function obtenerTipoDocumento(id: TipoDocumentoId): TipoDocumento {
  return (
    TIPOS_DOCUMENTO.find((tipo) => tipo.id === id) ??
    TIPOS_DOCUMENTO[TIPOS_DOCUMENTO.length - 1]
  )
}
