import { Hono } from 'hono'
import {
  esquemaLogin,
  esquemaRegistro,
  MENSAJES_CUENTA,
} from '../src/lib/cuentasTipos.ts'
import type { Usuario } from '../src/lib/cuentasTipos.ts'
import {
  hashContrasena,
  obtenerHashFicticio,
  verificarContrasena,
} from './auth.ts'
import { consultar, esCodigoPostgres } from './db.ts'
import type { VariablesApi } from './entorno.ts'
import {
  crearSesion,
  eliminarSesionActual,
  establecerCookieSesion,
  leerUsuarioSesion,
} from './sesiones.ts'
import { leerCuerpoJson, primerMensajeValidacion } from './validacion.ts'

type FilaUsuario = {
  id: string
  nombre: string
  correo: string
  creado_en: Date | string
}

type FilaUsuarioConHash = FilaUsuario & {
  contrasena_hash: string
}

function aUsuario(fila: FilaUsuario): Usuario {
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

export const rutasCuentas = new Hono<{ Variables: VariablesApi }>()

rutasCuentas.post('/registro', async (c) => {
  const cuerpo = await leerCuerpoJson(c)
  const validacion = esquemaRegistro.safeParse(cuerpo)

  if (!validacion.success) {
    return c.json(
      {
        ok: false,
        codigo: 'peticion_invalida',
        mensaje: primerMensajeValidacion(validacion.error),
      },
      400,
    )
  }

  const { nombre, correo, contrasena } = validacion.data
  const hash = await hashContrasena(contrasena)

  let fila: FilaUsuario

  try {
    const resultado = await consultar<FilaUsuario>(
      `insert into usuarios (nombre, correo, contrasena_hash)
       values ($1, $2, $3)
       returning id, nombre, correo, creado_en`,
      [nombre, correo, hash],
    )

    fila = resultado.rows[0]!
  } catch (error) {
    if (esCodigoPostgres(error, '23505')) {
      return c.json(
        {
          ok: false,
          codigo: 'correo_en_uso',
          mensaje: MENSAJES_CUENTA.correoEnUso,
        },
        409,
      )
    }

    throw error
  }

  const { token, expiraEn } = await crearSesion(fila.id)
  establecerCookieSesion(c, token, expiraEn)

  return c.json({ ok: true, usuario: aUsuario(fila) }, 201)
})

rutasCuentas.post('/login', async (c) => {
  const cuerpo = await leerCuerpoJson(c)
  const validacion = esquemaLogin.safeParse(cuerpo)

  if (!validacion.success) {
    return c.json(
      {
        ok: false,
        codigo: 'peticion_invalida',
        mensaje: primerMensajeValidacion(validacion.error),
      },
      400,
    )
  }

  const { correo, contrasena } = validacion.data

  const resultado = await consultar<FilaUsuarioConHash>(
    `select id, nombre, correo, contrasena_hash, creado_en
       from usuarios
      where lower(correo) = lower($1)`,
    [correo],
  )

  const fila = resultado.rows[0]

  // Si el correo no existe se verifica igualmente un hash ficticio para que el
  // tiempo de respuesta no revele si la cuenta existe.
  const hashParaComparar = fila?.contrasena_hash ?? (await obtenerHashFicticio())
  const contrasenaValida = await verificarContrasena(
    contrasena,
    hashParaComparar,
  )

  if (!fila || !contrasenaValida) {
    return c.json(
      {
        ok: false,
        codigo: 'credenciales_invalidas',
        mensaje: MENSAJES_CUENTA.credencialesInvalidas,
      },
      401,
    )
  }

  const { token, expiraEn } = await crearSesion(fila.id)
  establecerCookieSesion(c, token, expiraEn)

  return c.json({ ok: true, usuario: aUsuario(fila) })
})

rutasCuentas.post('/logout', async (c) => {
  await eliminarSesionActual(c)
  return c.json({ ok: true })
})

rutasCuentas.get('/yo', async (c) => {
  const usuario = await leerUsuarioSesion(c)
  return c.json({ ok: true, usuario })
})
