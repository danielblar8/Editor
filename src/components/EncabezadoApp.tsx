import type { RefObject } from 'react'
import type { TipoDocumentoId } from '../lib/tiposDocumento'
import { SelectorTipoDocumento } from './SelectorTipoDocumento'

type EncabezadoAppProps = {
  tipoDocumento: TipoDocumentoId
  onCambiarTipo: (tipo: TipoDocumentoId) => void
  chatAbierto: boolean
  onAlternarChat: () => void
  botonChatRef: RefObject<HTMLButtonElement | null>
}

export function EncabezadoApp({
  tipoDocumento,
  onCambiarTipo,
  chatAbierto,
  onAlternarChat,
  botonChatRef,
}: EncabezadoAppProps) {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <h1 className="hidden truncate text-base font-semibold tracking-tight text-slate-800 sm:block">
          Editor con tutor
        </h1>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <SelectorTipoDocumento
            valor={tipoDocumento}
            onCambiar={onCambiarTipo}
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
              'inline-flex h-9 items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
              chatAbierto
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
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
        </div>
      </div>
    </header>
  )
}
