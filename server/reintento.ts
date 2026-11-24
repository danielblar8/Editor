export type ResultadoReintento<T> = {
  valor: T
  intentos: number
}

type ErrorConCodigo = {
  codigo?: unknown
  estado?: unknown
}

/** Solo el 503 se reintenta; el resto de 5xx traducidos comparten código pero no estado. */
export function esServicioNoDisponible503(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { codigo, estado } = error as ErrorConCodigo
  return codigo === 'servicio_no_disponible' && estado === 503
}

function esReintentable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { codigo } = error as ErrorConCodigo
  return codigo === 'respuesta_invalida' || esServicioNoDisponible503(error)
}

function esperar(ms: number, senal?: AbortSignal): Promise<void> {
  if (!senal) return new Promise((resolver) => setTimeout(resolver, ms))
  if (senal.aborted) return Promise.resolve()

  return new Promise((resolver) => {
    let temporizador: ReturnType<typeof setTimeout>
    const finalizar = () => {
      clearTimeout(temporizador)
      senal.removeEventListener('abort', finalizar)
      resolver()
    }
    temporizador = setTimeout(finalizar, ms)
    senal.addEventListener('abort', finalizar, { once: true })
  })
}

export async function ejecutarConReintento<T>({
  llamada,
  maxIntentos = 2,
  puedeReintentar = () => true,
  esperaMs = 0,
  senalAborto,
}: {
  llamada: (intentosPrevios: number, errorPrevio?: unknown) => Promise<T>
  maxIntentos?: number
  puedeReintentar?: () => boolean
  esperaMs?: number
  senalAborto?: AbortSignal
}): Promise<ResultadoReintento<T>> {
  let ultimoError: unknown

  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      return { valor: await llamada(intento - 1, ultimoError), intentos: intento }
    } catch (error) {
      ultimoError = error
      const agotado = intento >= maxIntentos || !puedeReintentar()
      if (!esReintentable(error) || agotado) throw error
      if (esperaMs > 0) await esperar(esperaMs, senalAborto)
      if (senalAborto?.aborted) throw error
    }
  }

  throw ultimoError
}
