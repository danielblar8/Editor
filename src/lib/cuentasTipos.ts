import { z } from 'zod'

/**
 * Contrato compartido de cuentas.
 *
 * El cliente y el servidor validan con los mismos esquemas y muestran los
 * mismos mensajes. Las contraseñas nunca se transforman ni se recortan.
 */
export const LONGITUD_MINIMA_CONTRASENA = 8
export const LONGITUD_MAXIMA_CONTRASENA = 200
export const LONGITUD_MAXIMA_NOMBRE = 120
export const LONGITUD_MAXIMA_CORREO = 254

export const esquemaCorreo = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Escribe tu correo.')
  .max(LONGITUD_MAXIMA_CORREO, 'El correo es demasiado largo.')
  .email('Escribe un correo válido.')

export const esquemaNombre = z
  .string()
  .trim()
  .min(1, 'Escribe tu nombre.')
  .max(
    LONGITUD_MAXIMA_NOMBRE,
    `El nombre no puede superar ${LONGITUD_MAXIMA_NOMBRE} caracteres.`,
  )

export const esquemaContrasenaNueva = z
  .string()
  .min(
    LONGITUD_MINIMA_CONTRASENA,
    `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`,
  )
  .max(
    LONGITUD_MAXIMA_CONTRASENA,
    `La contraseña no puede superar ${LONGITUD_MAXIMA_CONTRASENA} caracteres.`,
  )

export const esquemaRegistro = z.object({
  nombre: esquemaNombre,
  correo: esquemaCorreo,
  contrasena: esquemaContrasenaNueva,
})

export const esquemaLogin = z.object({
  correo: esquemaCorreo,
  contrasena: z
    .string()
    .min(1, 'Escribe tu contraseña.')
    .max(
      LONGITUD_MAXIMA_CONTRASENA,
      `La contraseña no puede superar ${LONGITUD_MAXIMA_CONTRASENA} caracteres.`,
    ),
})

export type PeticionRegistro = z.infer<typeof esquemaRegistro>
export type PeticionLogin = z.infer<typeof esquemaLogin>

export type Usuario = {
  id: string
  nombre: string
  correo: string
  creadoEn: string
}

export const MENSAJES_CUENTA = {
  correoEnUso: 'Ya existe una cuenta con ese correo.',
  credencialesInvalidas: 'El correo o la contraseña no son correctos.',
  noAutenticado: 'Inicia sesión para continuar.',
  sesionCaducada: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  baseDatosNoDisponible:
    'No se pudo conectar con PostgreSQL. Comprueba que esté en marcha y que DATABASE_URL sea correcta.',
} as const
