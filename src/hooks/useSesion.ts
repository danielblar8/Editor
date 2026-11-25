import { useCallback, useEffect, useState } from 'react'
import {
  esErrorNoAutenticado,
  mensajeDeError,
  solicitarJson,
} from '../lib/api'
import type {
  PeticionLogin,
  PeticionRegistro,
  Usuario,
} from '../lib/cuentasTipos'
import { MENSAJES_CUENTA } from '../lib/cuentasTipos'
import { limpiarDocumentoActual } from '../lib/storage'

type RespuestaUsuario = {
  ok: true
  usuario: Usuario
}

type RespuestaYo = {
  ok: true
  usuario: Usuario | null
}

/**
 * Estado de la cuenta en el cliente.
 *
 * La sesión real vive en una cookie httpOnly: aquí solo se guarda el usuario
 * que devuelve `/api/auth/yo`. Las funciones de acceso lanzan `ErrorApi` para
 * que el formulario muestre el mensaje del servidor.
 */
export function useSesion() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorSesion, setErrorSesion] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    solicitarJson<RespuestaYo>('/api/auth/yo')
      .then((respuesta) => {
        if (!activo) return
        setUsuario(respuesta.usuario)
        setErrorSesion(null)
      })
      .catch((error: unknown) => {
        if (!activo) return

        if (esErrorNoAutenticado(error)) {
          setUsuario(null)
          return
        }

        setErrorSesion(
          mensajeDeError(
            error,
            'No se pudo comprobar tu sesión. Comprueba que el servidor esté en marcha.',
          ),
        )
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [])

  const iniciarSesion = useCallback(async (datos: PeticionLogin) => {
    setErrorSesion(null)

    const respuesta = await solicitarJson<RespuestaUsuario>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(datos),
      },
    )

    limpiarDocumentoActual()
    setUsuario(respuesta.usuario)
  }, [])

  const registrarse = useCallback(async (datos: PeticionRegistro) => {
    setErrorSesion(null)

    const respuesta = await solicitarJson<RespuestaUsuario>(
      '/api/auth/registro',
      {
        method: 'POST',
        body: JSON.stringify(datos),
      },
    )

    limpiarDocumentoActual()
    setUsuario(respuesta.usuario)
  }, [])

  const cerrarSesion = useCallback(async () => {
    try {
      await solicitarJson('/api/auth/logout', { method: 'POST' })
    } catch {
      // Aunque falle la petición, la interfaz cierra la sesión local.
    } finally {
      limpiarDocumentoActual()
      setUsuario(null)
      setErrorSesion(null)
    }
  }, [])

  const marcarSesionExpirada = useCallback(() => {
    limpiarDocumentoActual()
    setUsuario(null)
    setErrorSesion(MENSAJES_CUENTA.sesionCaducada)
  }, [])

  const limpiarError = useCallback(() => {
    setErrorSesion(null)
  }, [])

  return {
    usuario,
    cargando,
    errorSesion,
    iniciarSesion,
    registrarse,
    cerrarSesion,
    marcarSesionExpirada,
    limpiarError,
  }
}
