import type { TipoDocumentoId } from './tiposDocumento'
import { obtenerTipoDocumento } from './tiposDocumento'

export type AutorMensaje = 'usuario' | 'tutor'

/**
 * `bienvenida` y `aviso` permiten que la interfaz distinga los mensajes
 * automáticos del tutor sin depender de su texto. `bienvenida` también se usa
 * para actualizar el saludo cuando cambia el tipo antes de conversar.
 */
export type VarianteMensaje = 'normal' | 'bienvenida' | 'aviso'

export type MensajeChat = {
  id: string
  autor: AutorMensaje
  texto: string
  creadoEn: string
  variante: VarianteMensaje
}

export type PeticionTutor = {
  mensaje: string
  tipoDocumento: TipoDocumentoId
}

function crearMensaje(
  autor: AutorMensaje,
  texto: string,
  variante: VarianteMensaje = 'normal',
): MensajeChat {
  return {
    id: crypto.randomUUID(),
    autor,
    texto,
    creadoEn: new Date().toISOString(),
    variante,
  }
}

export function crearMensajeUsuario(texto: string): MensajeChat {
  return crearMensaje('usuario', texto)
}

export function crearMensajeTutor(texto: string): MensajeChat {
  return crearMensaje('tutor', texto)
}

export function crearMensajeBienvenida(
  tipoDocumento: TipoDocumentoId,
): MensajeChat {
  const { nombre } = obtenerTipoDocumento(tipoDocumento)

  return crearMensaje(
    'tutor',
    `Hola, soy tu tutor. Todavía no estoy conectado a la IA; en la Fase 3 podré revisar la estructura y la coherencia de tu ${nombre}. Mientras tanto, puedes escribir y hacerme preguntas.`,
    'bienvenida',
  )
}

export function crearAvisoCambioTipo(
  tipoDocumento: TipoDocumentoId,
): MensajeChat {
  const { nombre } = obtenerTipoDocumento(tipoDocumento)

  return crearMensaje(
    'tutor',
    `Tipo de documento actualizado a «${nombre}». Tendré en cuenta su estructura cuando la revisión esté disponible en la Fase 3.`,
    'aviso',
  )
}

/**
 * Respuesta simulada del tutor: no hay ninguna llamada a IA ni a red.
 *
 * En la Fase 3 esta función se sustituirá por una petición al backend. La
 * interfaz y `useChatTutor` no necesitan cambiar: ambos trabajan con el texto
 * que devuelve esta promesa.
 */
export function responderTutorSimulado({
  mensaje,
  tipoDocumento,
}: PeticionTutor): Promise<string> {
  // El mensaje forma parte de la firma para que el backend lo reciba en la
  // Fase 3; la respuesta simulada no lo necesita.
  void mensaje

  const { nombre } = obtenerTipoDocumento(tipoDocumento)

  return Promise.resolve(
    `Todavía no estoy conectado a la IA. Revisaré tu documento («${nombre}») en la Fase 3.`,
  )
}
