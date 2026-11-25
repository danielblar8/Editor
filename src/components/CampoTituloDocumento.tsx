import { useEffect, useRef, useState } from 'react'
import { LIMITE_TITULO, TITULO_POR_DEFECTO } from '../lib/documentosTipos'

type CampoTituloDocumentoProps = {
  titulo: string
  onGuardar: (titulo: string) => Promise<void>
}

type EstadoTitulo = 'inactivo' | 'guardando' | 'guardado' | 'error'

/**
 * Título editable de la hoja.
 *
 * Guarda al salir del campo o al pulsar Enter. Enter no envía ningún
 * formulario: solo confirma el título. Escape descarta el cambio. Un título
 * vacío se rechaza y se recupera el último valor guardado.
 */
export function CampoTituloDocumento({
  titulo,
  onGuardar,
}: CampoTituloDocumentoProps) {
  const [valor, setValor] = useState(titulo)
  const [estado, setEstado] = useState<EstadoTitulo>('inactivo')
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const ultimoGuardadoRef = useRef(titulo)
  const cancelarRef = useRef(false)
  const montadoRef = useRef(true)

  useEffect(() => {
    montadoRef.current = true

    return () => {
      montadoRef.current = false
    }
  }, [])

  useEffect(() => {
    // El título puede cambiar desde fuera (por ejemplo, tras guardarlo en la
    // API). Es una sincronización deliberada con una fuente externa.
    // oxlint-disable-next-line react/set-state-in-effect
    setValor(titulo)
    ultimoGuardadoRef.current = titulo
  }, [titulo])

  const guardar = async () => {
    if (cancelarRef.current) {
      cancelarRef.current = false
      setValor(ultimoGuardadoRef.current)
      setMensajeError(null)
      setEstado('inactivo')
      return
    }

    const limpio = valor.trim()

    if (!limpio) {
      setValor(ultimoGuardadoRef.current)
      setMensajeError('El título no puede estar vacío.')
      setEstado('error')
      return
    }

    if (limpio === ultimoGuardadoRef.current) {
      setValor(limpio)
      setMensajeError(null)
      setEstado('inactivo')
      return
    }

    setEstado('guardando')
    setMensajeError(null)

    try {
      await onGuardar(limpio)
      ultimoGuardadoRef.current = limpio

      if (!montadoRef.current) return
      setValor(limpio)
      setEstado('guardado')
    } catch (error) {
      if (!montadoRef.current) return
      setEstado('error')
      setMensajeError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar el título.',
      )
    }
  }

  const descrito =
    [
      mensajeError ? 'error-titulo-documento' : null,
      estado !== 'inactivo' ? 'estado-titulo-documento' : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className="mb-6 border-b border-line/70 pb-4">
      <label htmlFor="titulo-documento" className="sr-only">
        Título del documento
      </label>
      <input
        id="titulo-documento"
        type="text"
        value={valor}
        maxLength={LIMITE_TITULO}
        placeholder={TITULO_POR_DEFECTO}
        aria-invalid={mensajeError !== null}
        aria-describedby={descrito}
        onChange={(evento) => {
          setValor(evento.target.value)
          setMensajeError(null)
          if (estado !== 'inactivo') setEstado('inactivo')
        }}
        onBlur={() => {
          void guardar()
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') {
            evento.preventDefault()
            evento.currentTarget.blur()
          } else if (evento.key === 'Escape') {
            cancelarRef.current = true
            evento.currentTarget.blur()
          }
        }}
        className="w-full rounded-sm border border-transparent bg-transparent px-0 py-1 font-serif text-2xl font-bold tracking-tight text-ink outline-none transition-colors placeholder:text-subtle hover:border-line focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:text-3xl"
      />
      <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-3 text-xs">
        {mensajeError && (
          <p id="error-titulo-documento" role="alert" className="text-danger">
            {mensajeError}
          </p>
        )}
        <p id="estado-titulo-documento" role="status" className="text-muted">
          {estado === 'guardando'
            ? 'Guardando título…'
            : estado === 'guardado'
              ? 'Título guardado.'
              : ''}
        </p>
      </div>
    </div>
  )
}
