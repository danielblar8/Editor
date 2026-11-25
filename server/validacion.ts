import type { Context } from 'hono'
import type { ZodError } from 'zod'
import { ErrorApi } from './errores.ts'

export async function leerCuerpoJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw new ErrorApi(
      'peticion_invalida',
      400,
      'El cuerpo de la solicitud no es JSON válido.',
    )
  }
}

export async function leerCuerpoJsonOpcional(c: Context): Promise<unknown> {
  const texto = await c.req.text()
  if (texto.trim().length === 0) return {}

  try {
    return JSON.parse(texto) as unknown
  } catch {
    throw new ErrorApi(
      'peticion_invalida',
      400,
      'El cuerpo de la solicitud no es JSON válido.',
    )
  }
}

export function primerMensajeValidacion(error: ZodError): string {
  return error.issues[0]?.message ?? 'La solicitud no es válida.'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function esUuid(valor: string): boolean {
  return UUID.test(valor)
}
