import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/**
 * Hash de contraseñas con scrypt de Node.
 *
 * Formato guardado:
 *   scrypt$N$r$p$sal_base64url$hash_base64url
 *
 * La contraseña en claro nunca se guarda ni se registra. scrypt es una función
 * deliberadamente lenta y con sal aleatoria; `timingSafeEqual` evita comparar
 * el hash con una comparación vulnerable a diferencias de tiempo.
 */
const COSTE_N = 16_384
const BLOQUE_R = 8
const PARALELISMO_P = 1
const LONGITUD_SAL = 16
const LONGITUD_HASH = 64
const MAXMEM = 64 * 1024 * 1024

function derivarClave(
  contrasena: string,
  sal: Buffer,
  costeN: number,
  bloqueR: number,
  paralelismoP: number,
  maxmem: number,
): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(
      contrasena,
      sal,
      LONGITUD_HASH,
      {
        N: costeN,
        r: bloqueR,
        p: paralelismoP,
        maxmem,
      },
      (error, clave) => {
        if (error) {
          rechazar(error)
          return
        }

        resolver(clave)
      },
    )
  })
}

export async function hashContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(LONGITUD_SAL)
  const hash = await derivarClave(
    contrasena,
    sal,
    COSTE_N,
    BLOQUE_R,
    PARALELISMO_P,
    MAXMEM,
  )

  return [
    'scrypt',
    COSTE_N,
    BLOQUE_R,
    PARALELISMO_P,
    sal.toString('base64url'),
    hash.toString('base64url'),
  ].join('$')
}

export async function verificarContrasena(
  contrasena: string,
  hashGuardado: string,
): Promise<boolean> {
  const partes = hashGuardado.split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false

  const costeN = Number(partes[1])
  const bloqueR = Number(partes[2])
  const paralelismoP = Number(partes[3])

  if (
    !Number.isInteger(costeN) ||
    !Number.isInteger(bloqueR) ||
    !Number.isInteger(paralelismoP) ||
    costeN < 2 ** 14 ||
    costeN > 2 ** 20 ||
    bloqueR < 1 ||
    bloqueR > 16 ||
    paralelismoP < 1 ||
    paralelismoP > 16
  ) {
    return false
  }

  let sal: Buffer
  let hashEsperado: Buffer

  try {
    sal = Buffer.from(partes[4] ?? '', 'base64url')
    hashEsperado = Buffer.from(partes[5] ?? '', 'base64url')
  } catch {
    return false
  }

  if (sal.length === 0 || hashEsperado.length !== LONGITUD_HASH) return false

  try {
    const hashCalculado = await derivarClave(
      contrasena,
      sal,
      costeN,
      bloqueR,
      paralelismoP,
      Math.max(MAXMEM, 128 * costeN * bloqueR * 2),
    )

    return timingSafeEqual(hashCalculado, hashEsperado)
  } catch {
    return false
  }
}

let hashFicticio: Promise<string> | null = null

/**
 * Hash de una contraseña aleatoria que solo se usa para que un correo
 * inexistente tarde aproximadamente lo mismo que uno real. Nunca se compara su
 * resultado con una contraseña de usuario.
 */
export function obtenerHashFicticio(): Promise<string> {
  hashFicticio ??= hashContrasena(randomBytes(24).toString('base64url'))
  return hashFicticio
}
