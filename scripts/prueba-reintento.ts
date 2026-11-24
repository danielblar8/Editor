import assert from 'node:assert/strict'
import test from 'node:test'
import { NoObjectGeneratedError, TypeValidationError } from 'ai'
import { ejecutarConTraduccion } from '../server/gemini.ts'
import { ejecutarConReintento } from '../server/reintento.ts'

function errorCodigo(
  codigo: string,
  estado?: number,
): Error & { codigo: string; estado?: number } {
  return Object.assign(new Error(codigo), { codigo, estado })
}

test('reintenta una respuesta inválida y devuelve el valor correcto', async () => {
  let intentos = 0

  const resultado = await ejecutarConReintento({
    llamada: async (intentosPrevios) => {
      intentos += 1
      if (intentosPrevios === 0) throw errorCodigo('respuesta_invalida')
      return `corregido-${intentosPrevios}`
    },
  })

  assert.equal(intentos, 2)
  assert.equal(resultado.intentos, 2)
  assert.equal(resultado.valor, 'corregido-1')
})

test('no reintenta un error de cuota', async () => {
  let intentos = 0

  await assert.rejects(
    ejecutarConReintento({
      llamada: async () => {
        intentos += 1
        throw errorCodigo('cuota_agotada')
      },
    }),
    /cuota_agotada/,
  )

  assert.equal(intentos, 1)
})

test('agota los intentos y propaga la respuesta inválida', async () => {
  let intentos = 0

  await assert.rejects(
    ejecutarConReintento({
      llamada: async () => {
        intentos += 1
        throw errorCodigo('respuesta_invalida')
      },
    }),
    /respuesta_invalida/,
  )

  assert.equal(intentos, 2)
})

test('respeta el presupuesto global de llamadas', async () => {
  let intentos = 0

  await assert.rejects(
    ejecutarConReintento({
      llamada: async () => {
        intentos += 1
        throw errorCodigo('respuesta_invalida')
      },
      puedeReintentar: () => false,
    }),
    /respuesta_invalida/,
  )

  assert.equal(intentos, 1)
})

test('un error de esquema del SDK se traduce y activa el reintento', async () => {
  let intentos = 0

  const resultado = await ejecutarConReintento({
    llamada: (intentosPrevios) =>
      ejecutarConTraduccion(async () => {
        intentos += 1
        if (intentosPrevios === 0) {
          throw new TypeValidationError({
            value: { observaciones: 'no es un array' },
            cause: new Error('Formato de salida inválido'),
          })
        }
        return 'corregido'
      }),
  })

  assert.equal(intentos, 2)
  assert.equal(resultado.intentos, 2)
  assert.equal(resultado.valor, 'corregido')
})

test('un error de objeto no generado del SDK también activa el reintento', async () => {
  let intentos = 0

  const resultado = await ejecutarConReintento({
    llamada: (intentosPrevios) =>
      ejecutarConTraduccion(async () => {
        intentos += 1
        if (intentosPrevios === 0) {
          throw new NoObjectGeneratedError({
            message: 'No se generó un objeto válido',
            cause: new Error('Salida sin objeto'),
            text: 'respuesta sin objeto',
            response: {
              id: 'respuesta-prueba',
              timestamp: new Date('2026-11-22T00:00:00.000Z'),
              modelId: 'modelo-prueba',
            },
            usage: {
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2,
              inputTokenDetails: {
                noCacheTokens: 1,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
              },
              outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
            },
            finishReason: 'stop',
          })
        }
        return 'corregido'
      }),
  })

  assert.equal(intentos, 2)
  assert.equal(resultado.valor, 'corregido')
})

test('reintenta un 503 y pasa el error previo a la segunda llamada', async () => {
  let intentos = 0
  const erroresPrevios: unknown[] = []

  const resultado = await ejecutarConReintento({
    esperaMs: 0,
    llamada: async (intentosPrevios, errorPrevio) => {
      intentos += 1
      erroresPrevios.push(errorPrevio)
      if (intentosPrevios === 0) {
        throw errorCodigo('servicio_no_disponible', 503)
      }
      return 'recuperado'
    },
  })

  assert.equal(intentos, 2)
  assert.equal(resultado.intentos, 2)
  assert.equal(resultado.valor, 'recuperado')
  assert.equal(erroresPrevios[0], undefined)
  const errorPrevio = erroresPrevios[1] as { codigo?: unknown; estado?: unknown }
  assert.equal(errorPrevio.codigo, 'servicio_no_disponible')
  assert.equal(errorPrevio.estado, 503)
})

test('agota el reintento cuando los dos intentos devuelven 503', async () => {
  let intentos = 0

  await assert.rejects(
    ejecutarConReintento({
      esperaMs: 0,
      llamada: () => {
        intentos += 1
        throw errorCodigo('servicio_no_disponible', 503)
      },
    }),
    /servicio_no_disponible/,
  )

  assert.equal(intentos, 2)
})

test('no reintenta una cuota que aparece después de un 503', async () => {
  let intentos = 0

  await assert.rejects(
    ejecutarConReintento({
      esperaMs: 0,
      llamada: (intentosPrevios) => {
        intentos += 1
        if (intentosPrevios === 0) {
          throw errorCodigo('servicio_no_disponible', 503)
        }
        throw errorCodigo('cuota_agotada')
      },
    }),
    /cuota_agotada/,
  )

  assert.equal(intentos, 2)
})

test('no reintenta un error de configuración', async () => {
  let intentos = 0

  await assert.rejects(
    ejecutarConReintento({
      esperaMs: 0,
      llamada: () => {
        intentos += 1
        throw errorCodigo('configuracion')
      },
    }),
    /configuracion/,
  )

  assert.equal(intentos, 1)
})

test('no reintenta un 5xx que no es 503', async () => {
  let intentos = 0

  await assert.rejects(
    ejecutarConReintento({
      esperaMs: 0,
      llamada: () => {
        intentos += 1
        throw errorCodigo('servicio_no_disponible', 500)
      },
    }),
    /servicio_no_disponible/,
  )

  assert.equal(intentos, 1)
})

test('no reintenta si el plazo global ya se agotó', async () => {
  let intentos = 0
  const controlador = new AbortController()
  controlador.abort()

  await assert.rejects(
    ejecutarConReintento({
      esperaMs: 0,
      senalAborto: controlador.signal,
      llamada: () => {
        intentos += 1
        throw errorCodigo('servicio_no_disponible', 503)
      },
    }),
    /servicio_no_disponible/,
  )

  assert.equal(intentos, 1)
})
