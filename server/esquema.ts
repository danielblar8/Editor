import { z } from 'zod'
import type { TipoDocumentoId } from '../src/lib/tiposDocumento.ts'
import { esTipoDocumentoId } from '../src/lib/tiposDocumento.ts'
import {
  SECCIONES_REVISION,
  TIPOS_PROBLEMA,
} from '../src/lib/revisionTipos.ts'

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
})

export const esquemaObservaciones = z.array(esquemaObservacion)
