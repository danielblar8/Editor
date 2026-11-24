export type ResultadoReintento<T> = {
  valor: T
  intentos: number
}

function esReintentable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const codigo = (error as { codigo?: unknown }).codigo
  return codigo === 'respuesta_invalida'
}

export async function ejecutarConReintento<T>({
  llamada,
  maxIntentos = 2,
  puedeReintentar = () => true,
}: {
  llamada: (intentosPrevios: number) => Promise<T>
  maxIntentos?: number
  puedeReintentar?: () => boolean
}): Promise<ResultadoReintento<T>> {
  let ultimoError: unknown

  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      return { valor: await llamada(intento - 1), intentos: intento }
    } catch (error) {
      ultimoError = error
      const agotado = intento >= maxIntentos || !puedeReintentar()
      if (!esReintentable(error) || agotado) throw error
    }
  }

  throw ultimoError
}
