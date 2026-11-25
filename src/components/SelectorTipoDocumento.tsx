import type { TipoDocumentoId } from '../lib/tiposDocumento'
import { esTipoDocumentoId, TIPOS_DOCUMENTO } from '../lib/tiposDocumento'

type SelectorTipoDocumentoProps = {
  valor: TipoDocumentoId
  onCambiar: (tipo: TipoDocumentoId) => void
}

export function SelectorTipoDocumento({
  valor,
  onCambiar,
}: SelectorTipoDocumentoProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label
        htmlFor="tipo-documento"
        className="hidden text-sm font-medium whitespace-nowrap text-muted md:block"
      >
        Tipo de documento
      </label>

      <select
        id="tipo-documento"
        aria-label="Tipo de documento"
        value={valor}
        onChange={(evento) => {
          const nuevo = evento.target.value
          if (esTipoDocumentoId(nuevo)) onCambiar(nuevo)
        }}
        className="h-9 w-36 min-w-0 truncate rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-sm transition-colors hover:border-subtle focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-[13.5rem]"
      >
        {TIPOS_DOCUMENTO.map((tipo) => (
          <option key={tipo.id} value={tipo.id}>
            {tipo.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}
