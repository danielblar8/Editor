import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as EventoTecladoReact } from 'react'
import type { MensajeChat } from '../lib/chat'
import type { FocoObservacion, ResaltadoParrafo } from '../lib/observaciones'
import { esTarjetaActiva, mensajeEsNavegable } from '../lib/observaciones'
import { ETIQUETAS_TIPO_PROBLEMA } from '../lib/revisionTipos'

type ChatLateralProps = {
  mensajes: MensajeChat[]
  enviando: boolean
  enfocarAlAbrir: boolean
  foco: FocoObservacion | null
  idRevisionActual: string | undefined
  resaltados: readonly ResaltadoParrafo[]
  onEnviar: (texto: string) => void
  onVerEnTexto: (mensaje: MensajeChat) => void
  onCerrar: () => void
}

const SUGERENCIAS = [
  'Revisa mi introducción',
  '¿Hay huecos en mi argumento?',
] as const

function usePantallaEstrecha(): boolean {
  const [estrecha, setEstrecha] = useState(() =>
    window.matchMedia('(max-width: 1023px)').matches,
  )

  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 1023px)')
    const actualizar = () => setEstrecha(consulta.matches)

    consulta.addEventListener('change', actualizar)
    return () => consulta.removeEventListener('change', actualizar)
  }, [])

  return estrecha
}

export function ChatLateral({
  mensajes,
  enviando,
  enfocarAlAbrir,
  foco,
  idRevisionActual,
  resaltados,
  onEnviar,
  onVerEnTexto,
  onCerrar,
}: ChatLateralProps) {
  const [texto, setTexto] = useState('')
  const campoRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const esMovil = usePantallaEstrecha()

  useEffect(() => {
    if (!enfocarAlAbrir && !esMovil) return
    campoRef.current?.focus({ preventScroll: true })
  }, [enfocarAlAbrir, esMovil])

  useEffect(() => {
    const lista = listaRef.current
    if (!lista) return

    const sinMovimiento = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    lista.scrollTo({
      top: lista.scrollHeight,
      behavior: sinMovimiento ? 'auto' : 'smooth',
    })
  }, [enviando, mensajes])

  useEffect(() => {
    if (!esMovil) return

    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const alPulsarTecla = (evento: globalThis.KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        onCerrar()
        return
      }

      if (evento.key !== 'Tab' || !panelRef.current) return

      const enfocables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled])',
        ),
      )

      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      if (!primero || !ultimo) return

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsarTecla)

    return () => {
      document.removeEventListener('keydown', alPulsarTecla)
      document.body.style.overflow = overflowAnterior
    }
  }, [esMovil, onCerrar])

  const enviarTexto = () => {
    const limpio = texto.trim()
    if (!limpio || enviando) return

    onEnviar(limpio)
    setTexto('')
    campoRef.current?.focus({ preventScroll: true })
  }

  const enviarSugerencia = (sugerencia: string) => {
    if (enviando) return
    onEnviar(sugerencia)
    campoRef.current?.focus({ preventScroll: true })
  }

  const alPulsarEnCampo = (evento: EventoTecladoReact<HTMLTextAreaElement>) => {
    if (evento.key !== 'Enter' || evento.shiftKey) return
    if (evento.nativeEvent.isComposing) return

    evento.preventDefault()
    enviarTexto()
  }

  return (
    <>
      {esMovil && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Cerrar chat"
          onClick={onCerrar}
          className="fixed inset-0 z-40 h-full w-full cursor-default bg-overlay"
        />
      )}

      <aside
        ref={panelRef}
        id="chat-tutor"
        role={esMovil ? 'dialog' : undefined}
        aria-modal={esMovil ? true : undefined}
        aria-label="Chat del tutor"
        className={
          esMovil
            ? 'fixed inset-y-0 right-0 z-50 flex w-[min(24rem,100vw)] flex-col bg-surface text-ink shadow-2xl'
            : 'flex w-full shrink-0 flex-col border-t border-line bg-surface text-ink lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-[22rem] lg:border-t-0 lg:border-l xl:w-[24rem]'
        }
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Tutor</h2>
            <p className="text-xs text-muted">
              Revisión con IA · no modifica tu texto
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar chat del tutor"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div
          ref={listaRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={enviando}
          aria-label="Conversación con el tutor"
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {mensajes.map((mensaje) => {
            if (mensaje.variante === 'aviso') {
              return (
                <p
                  key={mensaje.id}
                  className="rounded-lg border border-dashed border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning"
                >
                  {mensaje.texto}
                </p>
              )
            }

            if (mensaje.observacion) {
              const {
                parrafo_id,
                tipo_problema,
                observacion,
                pregunta_guia,
              } = mensaje.observacion

              const navegable = mensajeEsNavegable(
                mensaje,
                idRevisionActual,
                resaltados,
              )
              const activa = esTarjetaActiva(mensaje, foco)

              return (
                <article
                  key={mensaje.id}
                  aria-current={activa ? 'location' : undefined}
                  onClick={navegable ? () => onVerEnTexto(mensaje) : undefined}
                  className={`flex justify-start ${navegable ? 'cursor-pointer' : ''}`}
                >
                  <div
                    className={[
                      'max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-3 text-sm leading-relaxed text-ink transition-colors',
                      activa
                        ? 'border-focus bg-observation ring-2 ring-focus'
                        : navegable
                          ? 'border-line bg-observation hover:border-subtle hover:bg-surface-muted'
                          : 'border-line bg-observation',
                    ].join(' ')}
                  >
                    <p className="sr-only">Tutor:</p>
                    {activa && (
                      <p className="sr-only">Tarjeta señalada en el texto.</p>
                    )}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-accent-ink uppercase">
                        Párrafo {parrafo_id}
                      </span>
                      <span className="text-xs font-medium text-muted">
                        {ETIQUETAS_TIPO_PROBLEMA[tipo_problema]}
                      </span>
                    </div>
                    <p>{observacion}</p>
                    <p className="mt-2 border-t border-observation-line pt-2 text-xs leading-relaxed text-muted">
                      <span className="font-semibold text-ink">
                        Pregunta guía:{' '}
                      </span>
                      {pregunta_guia}
                    </p>
                    {navegable && (
                      <button
                        type="button"
                        onClick={(evento) => {
                          evento.stopPropagation()
                          onVerEnTexto(mensaje)
                        }}
                        className="mt-2 inline-flex items-center rounded-md border border-line px-2 py-1 text-xs font-medium text-ink transition-colors hover:border-focus hover:text-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        Ver en el texto
                        <span className="sr-only"> del párrafo {parrafo_id}</span>
                      </button>
                    )}
                  </div>
                </article>
              )
            }

            const esUsuario = mensaje.autor === 'usuario'

            return (
              <article
                key={mensaje.id}
                className={esUsuario ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={[
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    esUsuario
                      ? 'rounded-br-md bg-chat-user text-chat-user-ink'
                      : 'rounded-bl-md bg-chat-tutor text-chat-tutor-ink',
                  ].join(' ')}
                >
                  <p className="sr-only">{esUsuario ? 'Tú:' : 'Tutor:'}</p>
                  <p className="whitespace-pre-wrap">{mensaje.texto}</p>
                </div>
              </article>
            )
          })}

          {enviando && (
            <div className="flex justify-start">
              <p
                role="status"
                className="rounded-2xl rounded-bl-md bg-chat-tutor px-3.5 py-2.5 text-sm text-muted"
              >
                El tutor está revisando…
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-line px-4 py-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGERENCIAS.map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                disabled={enviando}
                onClick={() => enviarSugerencia(sugerencia)}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50"
              >
                {sugerencia}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <label htmlFor="mensaje-chat" className="sr-only">
              Escribe tu mensaje al tutor
            </label>
            <textarea
              id="mensaje-chat"
              ref={campoRef}
              rows={2}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              onKeyDown={alPulsarEnCampo}
              placeholder="Escribe tu mensaje…"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            <button
              type="button"
              onClick={enviarTexto}
              disabled={!texto.trim() || enviando}
              aria-label="Enviar mensaje"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-40"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M4 12 20 4l-8 16-2-6Z" />
                <path d="m10 14 10-10" />
              </svg>
            </button>
          </div>

          <p className="mt-1.5 text-[0.7rem] text-subtle">
            Enter envía · Mayús+Enter salta de línea
          </p>
        </div>
      </aside>
    </>
  )
}
