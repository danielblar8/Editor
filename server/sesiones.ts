import { createHmac, randomBytes } from 'node:crypto'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Usuario } from '../src/lib/cuentasTipos.ts'
import { consultar } from './db.ts'
import { ErrorConfiguracion } from './errores.ts'

const NOMBRE_COOKIE = 'editor_sesion'
const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000
const LONGITUD_MINIMA_SECRETO = 32

type FilaUsuarioSesion = {
  id: string
  nombre: string
  correo: string
  creado_en: Date | string
}

function obtenerSecreto(): string {
  const secreto = process.env.SESSION_SECRET?.trim()

  if (!secreto || secreto.length < LONGITUD_MINIMA_SECRETO) {
    throw new ErrorConfiguracion(
      `Falta SESSION_SECRET o tiene menos de ${LONGITUD_MINIMA_SECRETO} caracteres. Configúralo en .env con un valor aleatorio largo.`,
    )
  }

  return secreto
}

/**
 * El token viaja en la cookie y en la base solo se guarda su HMAC. Si se filtra
 * la tabla de sesiones, los valores no sirven como cookie sin SESSION_SECRET.
 */
function hashToken(token: string): string {
  return createHmac('sha256', obtenerSecreto()).update(token).digest('base64url')
}

function aUsuario(fila: FilaUsuarioSesion): Usuario {
  return {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    creadoEn:
      fila.creado_en instanceof Date
        ? fila.creado_en.toISOString()
        : new Date(fila.creado_en).toISOString(),
  }
}

export async function crearSesion(
  usuarioId: string,
): Promise<{ token: string; expiraEn: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiraEn = new Date(Date.now() + DURACION_SESION_MS)

  // Limpieza barata de sesiones caducadas de este usuario.
  await consultar(
    'delete from sesiones where usuario_id = $1 and expira_en <= now()',
    [usuarioId],
  )

  await consultar(
    'insert into sesiones (usuario_id, token_hash, expira_en) values ($1, $2, $3)',
    [usuarioId, hashToken(token), expiraEn],
  )

  return { token, expiraEn }
}

export function establecerCookieSesion(
  c: Context,
  token: string,
  expiraEn: Date,
): void {
  setCookie(c, NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: expiraEn,
    maxAge: Math.max(
      1,
      Math.floor((expiraEn.getTime() - Date.now()) / 1000),
    ),
  })
}

export function borrarCookieSesion(c: Context): void {
  deleteCookie(c, NOMBRE_COOKIE, { path: '/' })
}

export async function leerUsuarioSesion(c: Context): Promise<Usuario | null> {
  const token = getCookie(c, NOMBRE_COOKIE)
  if (!token) return null

  const resultado = await consultar<FilaUsuarioSesion>(
    `select u.id, u.nombre, u.correo, u.creado_en
       from sesiones s
       join usuarios u on u.id = s.usuario_id
      where s.token_hash = $1
        and s.expira_en > now()`,
    [hashToken(token)],
  )

  const fila = resultado.rows[0]

  if (!fila) {
    borrarCookieSesion(c)
    return null
  }

  return aUsuario(fila)
}

export async function eliminarSesionActual(c: Context): Promise<void> {
  const token = getCookie(c, NOMBRE_COOKIE)

  try {
    if (token) {
      await consultar('delete from sesiones where token_hash = $1', [
        hashToken(token),
      ])
    }
  } finally {
    borrarCookieSesion(c)
  }
}
