export const PREFERENCIAS_TEMA = ['sistema', 'claro', 'oscuro'] as const

export type PreferenciaTema = (typeof PREFERENCIAS_TEMA)[number]
export type TemaResuelto = 'claro' | 'oscuro'

export const PREFERENCIA_TEMA_POR_DEFECTO: PreferenciaTema = 'sistema'

export function esPreferenciaTema(valor: unknown): valor is PreferenciaTema {
  return (
    typeof valor === 'string' &&
    PREFERENCIAS_TEMA.some((preferencia) => preferencia === valor)
  )
}

export function prefiereTemaOscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolverTema(
  preferencia: PreferenciaTema,
  sistemaOscuro: boolean,
): TemaResuelto {
  if (preferencia === 'sistema') return sistemaOscuro ? 'oscuro' : 'claro'
  return preferencia
}

const COLOR_SCHEME: Record<TemaResuelto, 'light' | 'dark'> = {
  claro: 'light',
  oscuro: 'dark',
}

export function aplicarTema(tema: TemaResuelto): void {
  const raiz = document.documentElement
  raiz.dataset.theme = tema
  raiz.style.colorScheme = COLOR_SCHEME[tema]
}
