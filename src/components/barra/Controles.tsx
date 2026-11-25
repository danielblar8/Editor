import type { ReactNode } from 'react'

type Opcion = {
  valor: string
  etiqueta: string
}

type BotonBarraProps = {
  etiqueta: string
  atajo?: string
  activo?: boolean
  deshabilitado?: boolean
  onClick: () => void
  children: ReactNode
}

export function BotonBarra({
  etiqueta,
  atajo,
  activo,
  deshabilitado = false,
  onClick,
  children,
}: BotonBarraProps) {
  const titulo = atajo ? `${etiqueta} (${atajo})` : etiqueta

  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      disabled={deshabilitado}
      onClick={onClick}
      className={[
        'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:pointer-events-none disabled:opacity-40',
        activo
          ? 'bg-accent text-accent-ink shadow-sm'
          : 'text-muted hover:bg-surface-muted hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

type SelectorBarraProps = {
  etiqueta: string
  valor: string
  opciones: readonly Opcion[]
  onChange: (valor: string) => void
  className?: string
}

export function SelectorBarra({
  etiqueta,
  valor,
  opciones,
  onChange,
  className = '',
}: SelectorBarraProps) {
  const valorConocido = opciones.some((opcion) => opcion.valor === valor)

  return (
    <select
      title={etiqueta}
      aria-label={etiqueta}
      value={valor}
      onChange={(evento) => onChange(evento.target.value)}
      className={[
        'h-9 max-w-[8.5rem] min-w-0 rounded-md border border-line bg-surface px-2 text-xs text-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      ].join(' ')}
    >
      {/* Un documento pegado puede traer un valor fuera del catálogo: se
          mantiene como opción para que el menú siga mostrando la selección. */}
      {!valorConocido && valor.length > 0 && (
        <option value={valor}>{valor}</option>
      )}
      {opciones.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor}>
          {opcion.etiqueta}
        </option>
      ))}
    </select>
  )
}

export function Separador() {
  return (
    <span
      className="mx-0.5 hidden h-6 w-px bg-line sm:block"
      aria-hidden="true"
    />
  )
}

export function Icono({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </svg>
  )
}
