const SEPARADOR_PALABRAS = /\s+/u
const TIENE_LETRA_O_NUMERO = /[\p{L}\p{N}]/u

/**
 * Cuenta palabras separadas por espacios. Ignora signos sueltos para que un
 * guion o una raya no se cuenten como palabra.
 */
export function contarPalabras(texto: string): number {
  const limpio = texto.trim()
  if (limpio === '') return 0

  return limpio
    .split(SEPARADOR_PALABRAS)
    .filter((palabra) => TIENE_LETRA_O_NUMERO.test(palabra)).length
}

export function formatearPalabras(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'palabra' : 'palabras'}`
}
