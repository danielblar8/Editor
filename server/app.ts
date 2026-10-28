import { Hono } from 'hono'
import { LIMITE_CARACTERES_TEXTO } from '../src/lib/revisionTipos.ts'
import { esquemaPeticionRevision } from './esquema.ts'
import { ErrorRevision, revisarConGemini } from './gemini.ts'

export const app = new Hono()

app.get('/api/salud', (c) => c.json({ ok: true, mensaje: 'hola' }))

app.post('/api/revisar', async (c) => {
  let cuerpo: unknown

  try {
    cuerpo = await c.req.json()
  } catch {
    return c.json(
      {
        ok: false,
        codigo: 'peticion_invalida',
        mensaje: 'El cuerpo de la solicitud no es JSON válido.',
      },
      400,
    )
  }

  const validacion = esquemaPeticionRevision.safeParse(cuerpo)
  if (!validacion.success) {
    return c.json(
      {
        ok: false,
        codigo: 'peticion_invalida',
        mensaje:
          'La solicitud no es válida. Revisa el texto, el tipo de documento y la sección.',
      },
      400,
    )
  }

  const { texto, tipoDocumento, seccion } = validacion.data
  const textoLimpio = texto.trim()

  if (textoLimpio.length === 0) {
    return c.json(
      {
        ok: false,
        codigo: 'texto_vacio',
        mensaje: 'El documento está vacío. Escribe algo antes de pedir una revisión.',
      },
      400,
    )
  }

  if (textoLimpio.length > LIMITE_CARACTERES_TEXTO) {
    return c.json(
      {
        ok: false,
        codigo: 'texto_demasiado_largo',
        mensaje: `El texto supera el límite de ${LIMITE_CARACTERES_TEXTO.toLocaleString('es-ES')} caracteres.`,
      },
      413,
    )
  }

  const observaciones = await revisarConGemini({
    texto: textoLimpio,
    tipoDocumento,
    seccion,
  })

  return c.json({ ok: true, observaciones })
})

app.notFound((c) =>
  c.json(
    {
      ok: false,
      codigo: 'no_encontrado',
      mensaje: 'La ruta solicitada no existe.',
    },
    404,
  ),
)

app.onError((error, c) => {
  if (error instanceof ErrorRevision) {
    return c.json(
      { ok: false, codigo: error.codigo, mensaje: error.message },
      error.estado,
    )
  }

  console.error('[api] Error inesperado:', error)
  return c.json(
    {
      ok: false,
      codigo: 'error_interno',
      mensaje: 'Ocurrió un error inesperado en el servidor.',
    },
    500,
  )
})
