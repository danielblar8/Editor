/**
 * Contrato compartido entre el cliente y el backend para la revisión
 * gramatical. No importa Zod ni dependencias de Node: el frontend puede leer
 * los tipos, los límites y los códigos sin arrastrar el esquema del servidor.
 */
export const IDIOMA_GRAMATICA = 'es'

export const MAX_PARRAFOS_POR_PETICION = 20
export const MAX_CARACTERES_POR_PARRAFO = 4_000
export const MAX_CARACTERES_POR_PETICION = 12_000
export const MAX_LONGITUD_CLAVE = 128
export const MAX_LONGITUD_MENSAJE = 500
export const MAX_LONGITUD_REGLA = 100

export const DEBOUNCE_GRAMATICA_MS = 1_500
export const TIMEOUT_LANGUAGETOOL_MS = 8_000
export const TIMEOUT_CLIENTE_GRAMATICA_MS = 10_000
export const ESPERA_CUOTA_MS = 60_000
export const ESPERA_SERVICIO_MS = 30_000
export const MAX_ENTRADAS_CACHE_GRAMATICA = 400

export type ParrafoGramatica = {
  clave: string
  texto: string
}

export type ErrorGramatica = {
  clave: string
  inicio: number
  fin: number
  mensaje: string
  regla: string
}

export type PeticionGramatica = {
  parrafos: ParrafoGramatica[]
}

export type RespuestaGramatica = {
  ok: true
  errores: ErrorGramatica[]
}

export const CODIGOS_ERROR_GRAMATICA = [
  'peticion_invalida',
  'texto_vacio',
  'texto_demasiado_largo',
  'demasiados_parrafos',
  'parrafo_demasiado_largo',
  'configuracion',
  'cuota_agotada',
  'servicio_no_disponible',
  'tiempo_agotado',
  'respuesta_invalida',
  'error_interno',
] as const

export type CodigoErrorGramatica = (typeof CODIGOS_ERROR_GRAMATICA)[number]

export const MENSAJES_ERROR_GRAMATICA: Record<CodigoErrorGramatica, string> = {
  peticion_invalida: 'La solicitud de revisión gramatical no es válida.',
  texto_vacio: 'No hay texto para revisar.',
  texto_demasiado_largo:
    'El texto enviado supera el límite de 12.000 caracteres.',
  demasiados_parrafos:
    'Se enviaron demasiados párrafos en una sola revisión.',
  parrafo_demasiado_largo:
    'Uno de los párrafos supera el límite de 4.000 caracteres.',
  configuracion:
    'La revisión gramatical no está configurada en el servidor.',
  cuota_agotada:
    'Se alcanzó el límite temporal del servicio de gramática. Espera un momento.',
  servicio_no_disponible:
    'El servicio de gramática no está disponible en este momento.',
  tiempo_agotado: 'La revisión gramatical tardó demasiado.',
  respuesta_invalida:
    'El servicio de gramática devolvió una respuesta no válida.',
  error_interno:
    'Ocurrió un error inesperado al revisar la gramática.',
}

export const ESTADO_ERROR_GRAMATICA = {
  peticion_invalida: 400,
  texto_vacio: 400,
  texto_demasiado_largo: 413,
  demasiados_parrafos: 413,
  parrafo_demasiado_largo: 413,
  configuracion: 500,
  cuota_agotada: 429,
  servicio_no_disponible: 503,
  tiempo_agotado: 504,
  respuesta_invalida: 502,
  error_interno: 500,
} as const satisfies Record<CodigoErrorGramatica, number>

export type EstadoErrorGramatica =
  (typeof ESTADO_ERROR_GRAMATICA)[CodigoErrorGramatica]

export type RespuestaErrorGramatica = {
  ok: false
  codigo: CodigoErrorGramatica
  mensaje: string
}

export type RespuestaApiGramatica = RespuestaGramatica | RespuestaErrorGramatica

/** Error de gramática ya colocado en el documento, listo para decorar. */
export type ErrorDecoracionGramatica = {
  from: number
  to: number
  mensaje: string
  regla: string
}

export type EstadoGramatica =
  | 'inactivo'
  | 'revisando'
  | 'listo'
  | 'no_disponible'
