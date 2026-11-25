import type { RefObject } from 'react'
import type { PreferenciaTema, TemaResuelto } from '../lib/tema'
import type { TipoDocumentoId } from '../lib/tiposDocumento'
import { ControlTema } from './ControlTema'
import { SelectorTipoDocumento } from './SelectorTipoDocumento'

type EncabezadoAppProps = {
  tipoDocumento: TipoDocumentoId
  onCambiarTipo: (tipo: TipoDocumentoId) => void
  chatAbierto: boolean
  onAlternarChat: () => void
  botonChatRef: RefObject<HTMLButtonElement | null>
  temaResuelto: TemaResuelto
  onCambiarTema: (preferencia: PreferenciaTema) => TemaResuelto
  ocupado?: boolean
  onAbrirDocumentos: () => void
  onCerrarSesion: () => void
}

export function EncabezadoApp({
  tipoDocumento,
  onCambiarTipo,
  chatAbierto,
  onAlternarChat,
  botonChatRef,
  temaResuelto,
  onCambiarTema,
  ocupado = false,
  onAbrirDocumentos,
  onCerrarSesion,
}: EncabezadoAppProps) {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-surface/95 text-ink shadow-sm backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-1 px-2 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onAbrirDocumentos}
          disabled={ocupado}
          aria-busy={ocupado}
          aria-label="Mis documentos"
          title="Mis documentos"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
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
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          </svg>
          <span className="hidden md:inline">Mis documentos</span>
        </button>

        <h1 className="hidden min-w-0 truncate text-base font-semibold tracking-tight text-ink lg:block">
          Editor con tutor
        </h1>

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          <SelectorTipoDocumento
            valor={tipoDocumento}
            onCambiar={onCambiarTipo}
          />

          <ControlTema
            temaResuelto={temaResuelto}
            onCambiar={onCambiarTema}
          />

          <button
            ref={botonChatRef}
            type="button"
            onClick={onAlternarChat}
            aria-expanded={chatAbierto}
            aria-controls="chat-tutor"
            aria-label={
              chatAbierto ? 'Ocultar chat del tutor' : 'Mostrar chat del tutor'
            }
            title={
              chatAbierto ? 'Ocultar chat del tutor' : 'Mostrar chat del tutor'
            }
            className={[
              'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              chatAbierto
                ? 'bg-accent text-accent-ink hover:bg-accent-hover'
                : 'text-muted hover:bg-surface-muted hover:text-ink',
            ].join(' ')}
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
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
              <path d="M8 9h8" />
              <path d="M8 13h5" />
            </svg>
            <span className="hidden sm:inline">
              {chatAbierto ? 'Ocultar chat' : 'Mostrar chat'}
            </span>
          </button>

          <button
            type="button"
            onClick={onCerrarSesion}
            disabled={ocupado}
            aria-busy={ocupado}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            <span className="hidden md:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  )
}
