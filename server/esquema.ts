import { z } from 'zod'
import type { TipoDocumentoId } from '../src/lib/tiposDocumento.ts'
import { esTipoDocumentoId } from '../src/lib/tiposDocumento.ts'
import {
  SECCIONES_REVISION,
  SEVERIDADES,
  TIPOS_PROBLEMA,
} from '../src/lib/revisionTipos.ts'
import type { Severidad } from '../src/lib/revisionTipos.ts'

export const esquemaTipoDocumento = z.custom<TipoDocumentoId>(
  (valor) => esTipoDocumentoId(valor),
  { message: 'El tipo de documento no es válido.' },
)

export const esquemaSeccion = z.enum(SECCIONES_REVISION)

export const esquemaPeticionRevision = z.object({
  texto: z.string(),
  tipoDocumento: esquemaTipoDocumento,
  seccion: esquemaSeccion,
})

export const esquemaSeveridad = z.enum(SEVERIDADES)

export type { Severidad }

export const esquemaObservacion = z.object({
  parrafo_id: z
    .number()
    .int()
    .positive()
    .describe('Número del párrafo observado, tal como aparece en [PÁRRAFO N].'),
  tipo_problema: z
    .enum(TIPOS_PROBLEMA)
    .describe('Categoría del problema detectado.'),
  observacion: z
    .string()
    .min(1)
    .describe(
      'Diagnóstico breve y concreto, en español, sin reescribir el texto del autor.',
    ),
  pregunta_guia: z
    .string()
    .min(1)
    .describe(
      'Pregunta abierta para que el autor revise su propio texto sin recibir una versión corregida.',
    ),
  criterio_id: z
    .string()
    .optional()
    .describe('Identificador del criterio de la rúbrica que corresponde a la observación.'),
  severidad: esquemaSeveridad
    .optional()
    .describe('Importancia estimada del problema detectado.'),
})

export type ObservacionValidada = z.infer<typeof esquemaObservacion>

export const ORIGENES_OBSERVACION = ['modelo', 'codigo', 'fusionada'] as const

export type OrigenObservacion = (typeof ORIGENES_OBSERVACION)[number]

export const ETIQUETAS_ORIGEN_OBSERVACION: Record<OrigenObservacion, string> = {
  modelo: 'modelo',
  codigo: 'codigo',
  fusionada: 'fusionada',
}

export type ObservacionConOrigen = ObservacionValidada & {
  origen: OrigenObservacion
}

export const esquemaObservaciones = z.array(esquemaObservacion)

