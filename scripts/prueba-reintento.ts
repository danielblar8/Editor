import assert from 'node:assert/strict'
import test from 'node:test'
import { NoObjectGeneratedError, TypeValidationError } from 'ai'
import { ejecutarConTraduccion } from '../server/gemini.ts'
import { ejecutarConReintento } from '../server/reintento.ts'

function errorCodigo(codigo: string): Error & { codigo: string } {
  return Object.assign(new Error(codigo), { codigo })
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
