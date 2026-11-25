import type { Usuario } from '../lib/cuentasTipos'
import type { PreferenciaTema, TemaResuelto } from '../lib/tema'
import { ControlTema } from './ControlTema'

type EncabezadoDocumentosProps = {
  usuario: Usuario
  temaResuelto: TemaResuelto
  onCambiarTema: (preferencia: PreferenciaTema) => TemaResuelto
  onCerrarSesion: () => void
}

export function EncabezadoDocumentos({
  usuario,
  temaResuelto,
  onCambiarTema,
  onCerrarSesion,
}: EncabezadoDocumentosProps) {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-surface/95 text-ink shadow-sm backdrop-blur">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-ink">
          Mis documentos
        </h1>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <p
            className="hidden min-w-0 max-w-[16rem] truncate text-sm text-muted sm:block"
            title={usuario.correo}
          >
            {usuario.nombre}
          </p>

          <ControlTema
            temaResuelto={temaResuelto}
            onCambiar={onCambiarTema}
          />

          <button
            type="button"
            onClick={onCerrarSesion}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
