import { useState } from 'react'
import type { PreferenciaTema, TemaResuelto } from '../lib/tema'

type ControlTemaProps = {
  temaResuelto: TemaResuelto
  onCambiar: (preferencia: PreferenciaTema) => TemaResuelto
}

export function ControlTema({
  temaResuelto,
  onCambiar,
}: ControlTemaProps) {
  const [anuncio, setAnuncio] = useState('')
  const temaDestino: TemaResuelto =
    temaResuelto === 'oscuro' ? 'claro' : 'oscuro'
  const etiquetaAccion =
    temaDestino === 'oscuro' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'

  return (
    <>
      <button
        type="button"
        aria-label={etiquetaAccion}
        title={etiquetaAccion}
        onClick={() => {
          const resuelto = onCambiar(temaDestino)
          setAnuncio(`Tema ${resuelto} activado.`)
        }}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {temaResuelto === 'oscuro' ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
          </svg>
        )}
      </button>

      <p role="status" className="sr-only">
        {anuncio}
      </p>
    </>
  )
}
