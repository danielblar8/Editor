/**
 * Contrato compartido entre el cliente y el backend para las revisiones.
 *
 * Este módulo no importa Zod ni ninguna dependencia de Node para que el
 * frontend pueda leer las etiquetas y los tipos sin arrastrar el esquema del
 * servidor al bundle.
 */
export const TIPOS_PROBLEMA = [
  'hueco_argumental',
  'idea_no_retomada',
  'desarrollo_corto',
  'conclusion_incoherente',
  'idea_nueva_en_conclusion',
  'desequilibrio_entre_secciones',
] as const

export type TipoProblema = (typeof TIPOS_PROBLEMA)[number]

export const ETIQUETAS_TIPO_PROBLEMA: Record<TipoProblema, string> = {
  hueco_argumental: 'Hueco argumental',
  idea_no_retomada: 'Idea no retomada',
  desarrollo_corto: 'Desarrollo corto',
  conclusion_incoherente: 'Conclusión incoherente',
  idea_nueva_en_conclusion: 'Idea nueva en la conclusión',
  desequilibrio_entre_secciones: 'Desequilibrio entre secciones',
}

export const SECCIONES_REVISION = [
  'introduccion',
  'conclusion',
  'documento',
] as const

export type SeccionRevision = (typeof SECCIONES_REVISION)[number]

export const ETIQUETAS_SECCION: Record<SeccionRevision, string> = {
  introduccion: 'la introducción',
  conclusion: 'la conclusión',
  documento: 'el documento completo',
}

/**
 * Límite del texto que se envía a revisar. Se comprueba en el cliente para no
 * hacer la petición y en el servidor para no confiar en el cliente.
 */
export const LIMITE_CARACTERES_TEXTO = 12_000

export type Observacion = {
  parrafo_id: number
  tipo_problema: TipoProblema
  observacion: string
  pregunta_guia: string
}
