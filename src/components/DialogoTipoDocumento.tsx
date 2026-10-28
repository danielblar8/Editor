import { useEffect, useRef } from 'react'
import type { TipoDocumentoId } from '../lib/tiposDocumento'
import { TIPOS_DOCUMENTO } from '../lib/tiposDocumento'

type DialogoTipoDocumentoProps = {
  abierto: boolean
  onElegir: (tipo: TipoDocumentoId) => void
  onOmitir: () => void
}

/**
 * Elección inicial del tipo de documento para un documento nuevo.
 *
 * Usa el elemento nativo `<dialog>` para obtener gratis el foco atrapado, el
 * cierre con Escape y la restauración del foco al cerrar.
 */
export function DialogoTipoDocumento({
  abierto,
  onElegir,
  onOmitir,
}: DialogoTipoDocumentoProps) {
  const dialogoRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = dialogoRef.current
    if (!dialogo) return

    if (abierto && !dialogo.open) {
      dialogo.showModal()
    } else if (!abierto && dialogo.open) {
      dialogo.close()
    }
  }, [abierto])

  return (
    <dialog
      ref={dialogoRef}
      aria-labelledby="titulo-dialogo-tipo"
      aria-describedby="descripcion-dialogo-tipo"
      onCancel={(evento) => {
        evento.preventDefault()
        onOmitir()
      }}
      onClick={(evento) => {
        if (evento.target === dialogoRef.current) onOmitir()
      }}
      className="m-auto w-[min(46rem,calc(100vw-2rem))] max-w-none rounded-xl border border-sheet-border bg-surface p-0 text-ink shadow-2xl backdrop:bg-overlay"
    >
      <div className="p-5 sm:p-7">
        <h2
          id="titulo-dialogo-tipo"
          className="text-lg font-semibold tracking-tight text-ink sm:text-xl"
        >
          ¿Qué tipo de documento vas a escribir?
        </h2>
        <p
          id="descripcion-dialogo-tipo"
          className="mt-1.5 text-sm leading-relaxed text-muted"
        >
          Elige uno para recibir orientación adecuada. Puedes cambiarlo en
          cualquier momento desde la barra superior.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {TIPOS_DOCUMENTO.map((tipo) => (
            <button
              key={tipo.id}
              type="button"
              onClick={() => onElegir(tipo.id)}
              className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-subtle hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="text-sm font-semibold text-ink">
                {tipo.nombre}
              </span>
              <span className="text-xs leading-relaxed text-muted">
                {tipo.descripcion}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onOmitir}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Omitir: seguir con Texto Abierto
          </button>
        </div>
      </div>
    </dialog>
  )
}
