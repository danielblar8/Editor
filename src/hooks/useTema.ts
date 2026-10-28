import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import {
  cargarPreferenciaTema,
  guardarPreferenciaTema,
} from '../lib/storage'
import {
  aplicarTema,
  prefiereTemaOscuro,
  resolverTema,
} from '../lib/tema'
import type {
  PreferenciaTema,
  TemaResuelto,
} from '../lib/tema'

export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(
    cargarPreferenciaTema,
  )
  const [sistemaOscuro, setSistemaOscuro] =
    useState<boolean>(prefiereTemaOscuro)

  const temaResuelto = resolverTema(preferencia, sistemaOscuro)

  useEffect(() => {
    if (preferencia !== 'sistema') return

    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    const actualizar = () => setSistemaOscuro(consulta.matches)

    consulta.addEventListener('change', actualizar)
    return () => consulta.removeEventListener('change', actualizar)
  }, [preferencia])

  useLayoutEffect(() => {
    aplicarTema(temaResuelto)
  }, [temaResuelto])

  const cambiarPreferencia = useCallback(
    (nueva: PreferenciaTema): TemaResuelto => {
      const sistemaOscuroActual = prefiereTemaOscuro()
      const resuelto = resolverTema(nueva, sistemaOscuroActual)

      setSistemaOscuro(sistemaOscuroActual)
      setPreferencia(nueva)
      guardarPreferenciaTema(nueva)
      return resuelto
    },
    [],
  )

  return { temaResuelto, cambiarPreferencia }
}
