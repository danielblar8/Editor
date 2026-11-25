import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ZodError } from 'zod'
import { ErrorApi, mensajeDeError } from '../lib/api'
import type {
  PeticionLogin,
  PeticionRegistro,
} from '../lib/cuentasTipos'
import {
  esquemaLogin,
  esquemaRegistro,
  LONGITUD_MAXIMA_CONTRASENA,
  LONGITUD_MAXIMA_CORREO,
  LONGITUD_MAXIMA_NOMBRE,
  LONGITUD_MINIMA_CONTRASENA,
} from '../lib/cuentasTipos'
import type { PreferenciaTema, TemaResuelto } from '../lib/tema'
import { ControlTema } from './ControlTema'

type ModoCuenta = 'login' | 'registro'

type PantallaCuentaProps = {
  onIniciarSesion: (datos: PeticionLogin) => Promise<void>
  onRegistrarse: (datos: PeticionRegistro) => Promise<void>
  onLimpiarErrorSesion: () => void
  errorSesion: string | null
  temaResuelto: TemaResuelto
  onCambiarTema: (preferencia: PreferenciaTema) => TemaResuelto
}

function mapearErrores(error: ZodError): Record<string, string> {
  const errores: Record<string, string> = {}

  for (const problema of error.issues) {
    const campo = problema.path[0]
    if (typeof campo === 'string' && !errores[campo]) {
      errores[campo] = problema.message
    }
  }

  return errores
}

export function PantallaCuenta({
  onIniciarSesion,
  onRegistrarse,
  onLimpiarErrorSesion,
  errorSesion,
  temaResuelto,
  onCambiarTema,
}: PantallaCuentaProps) {
  const [modo, setModo] = useState<ModoCuenta>('login')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({})

  const cambiarModo = (nuevo: ModoCuenta) => {
    if (nuevo === modo) return

    setModo(nuevo)
    setError(null)
    setErroresCampos({})
    setContrasena('')
    if (nuevo === 'login') setNombre('')
    onLimpiarErrorSesion()
  }

  const limpiarErrorCampo = (campo: string) => {
    setErroresCampos((anteriores) => {
      if (!anteriores[campo]) return anteriores

      const copia = { ...anteriores }
      delete copia[campo]
      return copia
    })
    setError(null)
  }

  const manejarEnvio = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    setErroresCampos({})
    setEnviando(true)

    try {
      if (modo === 'login') {
        const resultado = esquemaLogin.safeParse({ correo, contrasena })

        if (!resultado.success) {
          setErroresCampos(mapearErrores(resultado.error))
          return
        }

        await onIniciarSesion(resultado.data)
      } else {
        const resultado = esquemaRegistro.safeParse({
          nombre,
          correo,
          contrasena,
        })

        if (!resultado.success) {
          setErroresCampos(mapearErrores(resultado.error))
          return
        }

        await onRegistrarse(resultado.data)
      }
    } catch (fallo) {
      if (fallo instanceof ErrorApi && fallo.codigo === 'correo_en_uso') {
        setErroresCampos({ correo: fallo.message })
      } else {
        setError(
          mensajeDeError(
            fallo,
            'No se pudo completar la operación. Inténtalo de nuevo.',
          ),
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  const claseCampo = (campo: string) =>
    [
      'h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink shadow-sm transition-colors',
      'placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
      erroresCampos[campo]
        ? 'border-danger'
        : 'border-line hover:border-subtle focus-visible:border-focus',
    ].join(' ')

  const idError = (campo: string) => `error-cuenta-${campo}`

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface/95 text-ink shadow-sm backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3 sm:px-4">
          <h1 className="text-base font-semibold tracking-tight text-ink">
            Editor con tutor
          </h1>
          <ControlTema
            temaResuelto={temaResuelto}
            onCambiar={onCambiarTema}
          />
        </div>
      </header>

      <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
        <section
          aria-labelledby="titulo-cuenta"
          className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-xl sm:p-8"
        >
          <h2
            id="titulo-cuenta"
            className="text-xl font-semibold tracking-tight text-ink"
          >
            {modo === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {modo === 'login'
              ? 'Accede a tus documentos y sigue escribiendo donde lo dejaste.'
              : 'Guarda tus documentos y recibe orientación de tu tutor.'}
          </p>

          <div
            role="group"
            aria-label="Tipo de acceso"
            className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1"
          >
            {(['login', 'registro'] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={modo === opcion}
                onClick={() => cambiarModo(opcion)}
                className={[
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  modo === opcion
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-muted hover:text-ink',
                ].join(' ')}
              >
                {opcion === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {errorSesion && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-danger"
            >
              {errorSesion}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <form
            onSubmit={(evento) => {
              void manejarEnvio(evento)
            }}
            noValidate
            aria-busy={enviando}
            className="mt-5 space-y-4"
          >
            {modo === 'registro' && (
              <div>
                <label
                  htmlFor="cuenta-nombre"
                  className="text-sm font-medium text-ink"
                >
                  Nombre
                </label>
                <input
                  id="cuenta-nombre"
                  name="nombre"
                  type="text"
                  autoComplete="name"
                  maxLength={LONGITUD_MAXIMA_NOMBRE}
                  value={nombre}
                  onChange={(evento) => {
                    setNombre(evento.target.value)
                    limpiarErrorCampo('nombre')
                  }}
                  aria-invalid={Boolean(erroresCampos.nombre)}
                  aria-describedby={
                    erroresCampos.nombre ? idError('nombre') : undefined
                  }
                  className={`mt-1 ${claseCampo('nombre')}`}
                />
                {erroresCampos.nombre && (
                  <p
                    id={idError('nombre')}
                    className="mt-1 text-xs text-danger"
                  >
                    {erroresCampos.nombre}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="cuenta-correo"
                className="text-sm font-medium text-ink"
              >
                Correo
              </label>
              <input
                id="cuenta-correo"
                name="correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={LONGITUD_MAXIMA_CORREO}
                value={correo}
                onChange={(evento) => {
                  setCorreo(evento.target.value)
                  limpiarErrorCampo('correo')
                }}
                aria-invalid={Boolean(erroresCampos.correo)}
                aria-describedby={
                  erroresCampos.correo ? idError('correo') : undefined
                }
                className={`mt-1 ${claseCampo('correo')}`}
              />
              {erroresCampos.correo && (
                <p id={idError('correo')} className="mt-1 text-xs text-danger">
                  {erroresCampos.correo}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="cuenta-contrasena"
                className="text-sm font-medium text-ink"
              >
                Contraseña
              </label>
              <input
                id="cuenta-contrasena"
                name="contrasena"
                type="password"
                autoComplete={
                  modo === 'login' ? 'current-password' : 'new-password'
                }
                minLength={
                  modo === 'registro' ? LONGITUD_MINIMA_CONTRASENA : undefined
                }
                maxLength={LONGITUD_MAXIMA_CONTRASENA}
                value={contrasena}
                onChange={(evento) => {
                  setContrasena(evento.target.value)
                  limpiarErrorCampo('contrasena')
                }}
                aria-invalid={Boolean(erroresCampos.contrasena)}
                aria-describedby={
                  erroresCampos.contrasena
                    ? idError('contrasena')
                    : undefined
                }
                className={`mt-1 ${claseCampo('contrasena')}`}
              />
              {erroresCampos.contrasena && (
                <p
                  id={idError('contrasena')}
                  className="mt-1 text-xs text-danger"
                >
                  {erroresCampos.contrasena}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={enviando}
              aria-busy={enviando}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando
                ? modo === 'login'
                  ? 'Entrando…'
                  : 'Creando cuenta…'
                : modo === 'login'
                  ? 'Entrar'
                  : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            {modo === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              type="button"
              onClick={() => cambiarModo(modo === 'login' ? 'registro' : 'login')}
              className="font-medium text-focus underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {modo === 'login' ? 'Crea una' : 'Inicia sesión'}
            </button>
          </p>
        </section>
      </main>
    </div>
  )
}
