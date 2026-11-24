import { z } from 'zod'
import { esquemaObservacion } from './esquema.ts'

export const ID_SECCIONES_MAPA = [
  'introduccion',
  'desarrollo',
  'conclusion',
] as const

export const esquemaSeccionMapa = z.object({
  id: z.enum(ID_SECCIONES_MAPA),
  rol: z.string().min(1),
  idea_principal: z.string().min(1),
  ideas_clave: z.array(z.string().min(1)).max(6),
  parrafos: z.array(z.number().int().positive()).min(1),
})

export const esquemaIdeaAnunciada = z.object({
  idea: z.string().min(1),
  parrafo: z.number().int().positive(),
})

export const esquemaMapaDocumento = z.object({
  tesis_o_objetivo: z.string().min(1),
  secciones: z.array(esquemaSeccionMapa).min(1),
  ideas_anunciadas: z.array(esquemaIdeaAnunciada),
})

export const esquemaSalidaMapa = esquemaMapaDocumento

export const esquemaSalidaUnica = z.object({
  mapa: esquemaMapaDocumento,
  observaciones: z.array(esquemaObservacion),
})

export const esquemaSalidaObservaciones = z.object({
  observaciones: z.array(esquemaObservacion),
})

export type SeccionMapa = z.infer<typeof esquemaSeccionMapa>
export type IdeaAnunciada = z.infer<typeof esquemaIdeaAnunciada>
export type MapaDocumento = z.infer<typeof esquemaMapaDocumento>
export type SalidaUnica = z.infer<typeof esquemaSalidaUnica>
export type SalidaObservaciones = z.infer<typeof esquemaSalidaObservaciones>
