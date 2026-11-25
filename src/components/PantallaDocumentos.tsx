import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { esErrorNoAutenticado, mensajeDeError } from '../lib/api'
import type { Usuario } from '../lib/cuentasTipos'
import type { DocumentoResumen } from '../lib/documentosTipos'
import { LIMITE_TITULO } from '../lib/documentosTipos'
import {
  borrarDocumento,
  crearDocumento,
  listarDocumentos,
  renombrarDocumento,
} from '../lib/storage'
import type { PreferenciaTema, TemaResuelto } from '../lib/tema'
import { obtenerTipoDocumento } from '../lib/tiposDocumento'
import { EncabezadoDocumentos } from './EncabezadoDocumentos'

type PantallaDocumentosProps = {
  usuario: Usuario
  temaResuelto: TemaResuelto
  onCambiarTema: (preferencia: PreferenciaTema) => TemaResuelto
  onCerrarSesion: () => void | Promise<void>
  onAbrirDocumento: (id: string, esNuevo: boolean) => void
  onSesionExpirada: () => void
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const BOTON_PRIMARIO =
  'inline-flex h-8 items-center justify-center rounded-md bg-accent px-3 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60'

const BOTON_SECUNDARIO =
  'inline-flex h-8 items-center justify-center rounded-md border border-line px-3 text-xs font-medium text-muted transition-colors hover:border-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60'

const BOTON_PELIGRO =
  'inline-flex h-8 items-center justify-center rounded-md border border-line px-3 text-xs font-medium text-danger transition-colors hover:border-danger hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60'

const CAMPO_TEXTO =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink shadow-sm transition-colors hover:border-subtle focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

function formatearFecha(iso: string): string | null {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? null : FORMATO_FECHA.format(fecha)
}

export function PantallaDocumentos({
  usuario,
  temaResuelto,
  onCambiarTema,
  onCerrarSesion,
  onAbrirDocumento,
  onSesionExpirada,
}: PantallaDocumentosProps) {
  const [documentos, setDocumentos] = useState<DocumentoResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [tituloEdicion, setTituloEdicion] = useState('')
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null)
  const [confirmandoBorradoId, setConfirmandoBorradoId] = useState<
    string | null
  >(null)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    setEditandoId(null)
    setConfirmandoBorradoId(null)

    try {
      setDocumentos(await listarDocumentos())
    } catch (fallo) {
      if (esErrorNoAutenticado(fallo)) {
        onSesionExpirada()
        return
      }

      setError(
        mensajeDeError(
          fallo,
          'No se pudieron cargar tus documentos. Inténtalo de nuevo.',
        ),
      )
    } finally {
      setCargando(false)
    }
  }, [onSesionExpirada])

  useEffect(() => {
    // La lista se carga al montar la pantalla; el estado inicial ya está
    // preparado para la primera petición.
    // oxlint-disable-next-line react/set-state-in-effect
    void cargar()
  }, [cargar])

  const crearNuevo = async () => {
    setCreando(true)
    setError(null)

    try {
      const documento = await crearDocumento()
      onAbrirDocumento(documento.id, true)
    } catch (fallo) {
      if (esErrorNoAutenticado(fallo)) {
        onSesionExpirada()
        return
      }

      setError(
        mensajeDeError(
          fallo,
          'No se pudo crear el documento. Inténtalo de nuevo.',
        ),
      )
    } finally {
      setCreando(false)
    }
  }

  const iniciarRenombre = (documento: DocumentoResumen) => {
    setEditandoId(documento.id)
    setTituloEdicion(documento.titulo)
    setConfirmandoBorradoId(null)
    setError(null)
  }

  const cancelarRenombre = () => {
    setEditandoId(null)
    setTituloEdicion('')
    setError(null)
  }

  const guardarRenombre = async (
    evento: FormEvent<HTMLFormElement>,
    documento: DocumentoResumen,
  ) => {
    evento.preventDefault()

    const limpio = tituloEdicion.trim()

    if (!limpio) {
      setError('El título no puede estar vacío.')
      return
    }

    if (limpio === documento.titulo) {
      setEditandoId(null)
      setError(null)
      return
    }

    setRenombrandoId(documento.id)
    setError(null)

    try {
      const actualizado = await renombrarDocumento(documento.id, limpio)
      setDocumentos((anteriores) => [
        actualizado,
        ...anteriores.filter((item) => item.id !== actualizado.id),
      ])
      setEditandoId(null)
      setTituloEdicion('')
    } catch (fallo) {
      if (esErrorNoAutenticado(fallo)) {
        onSesionExpirada()
        return
      }

      setError(
        mensajeDeError(
          fallo,
          'No se pudo renombrar el documento. Inténtalo de nuevo.',
        ),
      )
    } finally {
      setRenombrandoId(null)
    }
  }

  const borrar = async (documento: DocumentoResumen) => {
    setBorrandoId(documento.id)
    setError(null)

    try {
      await borrarDocumento(documento.id)
      setDocumentos((anteriores) =>
        anteriores.filter((item) => item.id !== documento.id),
      )
      setConfirmandoBorradoId(null)
    } catch (fallo) {
      if (esErrorNoAutenticado(fallo)) {
        onSesionExpirada()
        return
      }

      setError(
        mensajeDeError(
          fallo,
          'No se pudo borrar el documento. Inténtalo de nuevo.',
        ),
      )
    } finally {
      setBorrandoId(null)
    }
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <EncabezadoDocumentos
        usuario={usuario}
        temaResuelto={temaResuelto}
        onCambiarTema={onCambiarTema}
        onCerrarSesion={() => {
          void onCerrarSesion()
        }}
      />

      <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
              Tus documentos
            </h2>
            <p className="mt-1 text-sm text-muted">
              Crea, abre o renombra tus documentos. El tutor solo lee lo que
              escribes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void crearNuevo()
            }}
            disabled={creando}
            aria-busy={creando}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {creando ? 'Creando…' : 'Nuevo documento'}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-danger"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                void cargar()
              }}
              className={BOTON_SECUNDARIO}
            >
              Recargar
            </button>
          </div>
        )}

        {cargando ? (
          <p aria-live="polite" className="mt-8 text-sm text-muted">
            Cargando documentos…
          </p>
        ) : !error && documentos.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-line bg-surface/60 p-8 text-center">
            <p className="text-sm font-medium text-ink">
              Todavía no tienes documentos.
            </p>
            <p className="mt-1 text-sm text-muted">
              Crea uno para empezar a escribir con tu tutor.
            </p>
            <button
              type="button"
              onClick={() => {
                void crearNuevo()
              }}
              disabled={creando}
              aria-busy={creando}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creando ? 'Creando…' : 'Crear mi primer documento'}
            </button>
          </div>
        ) : documentos.length > 0 ? (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {documentos.map((documento) => {
              const tipo = obtenerTipoDocumento(documento.tipoDocumento)
              const fecha = formatearFecha(documento.actualizadoEn)
              const editando = editandoId === documento.id
              const confirmando = confirmandoBorradoId === documento.id
              const ocupado =
                borrandoId === documento.id ||
                renombrandoId === documento.id

              return (
                <li key={documento.id}>
                  <article className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="max-w-full truncate rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">
                        {tipo.nombre}
                      </span>
                      <span className="text-xs text-muted">
                        {fecha
                          ? `Actualizado el ${fecha}`
                          : 'Fecha no disponible'}
                      </span>
                    </div>

                    {editando ? (
                      <form
                        onSubmit={(evento) => {
                          void guardarRenombre(evento, documento)
                        }}
                        className="flex flex-col gap-2"
                      >
                        <label
                          htmlFor={`titulo-${documento.id}`}
                          className="sr-only"
                        >
                          Nuevo título para {documento.titulo}
                        </label>
                        <input
                          id={`titulo-${documento.id}`}
                          type="text"
                          value={tituloEdicion}
                          maxLength={LIMITE_TITULO}
                          autoFocus
                          onChange={(evento) => {
                            setTituloEdicion(evento.target.value)
                            setError(null)
                          }}
                          onKeyDown={(evento) => {
                            if (evento.key === 'Escape') {
                              evento.preventDefault()
                              cancelarRenombre()
                            }
                          }}
                          className={CAMPO_TEXTO}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={ocupado}
                            className={BOTON_PRIMARIO}
                          >
                            {renombrandoId === documento.id
                              ? 'Guardando…'
                              : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelarRenombre}
                            disabled={ocupado}
                            className={BOTON_SECUNDARIO}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <h3
                        className="min-w-0 truncate text-base font-semibold text-ink"
                        title={documento.titulo}
                      >
                        {documento.titulo}
                      </h3>
                    )}

                    {!editando && (
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                        {confirmando ? (
                          <>
                            <span className="text-xs text-muted">
                              ¿Borrar este documento?
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                void borrar(documento)
                              }}
                              disabled={ocupado}
                              aria-label={`Confirmar borrado de ${documento.titulo}`}
                              className={BOTON_PELIGRO}
                            >
                              {borrandoId === documento.id
                                ? 'Borrando…'
                                : 'Sí, borrar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoBorradoId(null)}
                              disabled={ocupado}
                              className={BOTON_SECUNDARIO}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onAbrirDocumento(documento.id, false)
                              }
                              aria-label={`Abrir ${documento.titulo}`}
                              className={BOTON_PRIMARIO}
                            >
                              Abrir
                            </button>
                            <button
                              type="button"
                              onClick={() => iniciarRenombre(documento)}
                              aria-label={`Renombrar ${documento.titulo}`}
                              className={BOTON_SECUNDARIO}
                            >
                              Renombrar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmandoBorradoId(documento.id)
                                setEditandoId(null)
                                setError(null)
                              }}
                              aria-label={`Borrar ${documento.titulo}`}
                              className={BOTON_PELIGRO}
                            >
                              Borrar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        ) : null}
      </main>
    </div>
  )
}
