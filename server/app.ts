import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { MENSAJES_ERROR_GRAMATICA } from '../src/lib/gramaticaTipos.ts'
import { LIMITE_CARACTERES_TEXTO } from '../src/lib/revisionTipos.ts'
import { comprobarConexion } from './db.ts'
import type { VariablesApi } from './entorno.ts'
import { ErrorApi } from './errores.ts'
import { esquemaPeticionRevision } from './esquema.ts'
import { validarPeticionGramatica } from './esquemaGramatica.ts'
import { ErrorRevision, revisarConGemini } from './gemini.ts'
import { ErrorGramatica, revisarConLanguageTool } from './languagetool.ts'
import { rutasCuentas } from './rutasCuentas.ts'
import { rutasDocumentos } from './rutasDocumentos.ts'

export const app = new Hono<{ Variables: VariablesApi }>()

app.get('/api/salud', (c) => c.json({ ok: true, mensaje: 'hola' }))

app.get('/api/salud/db', async (c) => {
  await comprobarConexion()
  return c.json({
    ok: true,
    mensaje: 'Conexión con PostgreSQL correcta.',
  })
})

app.route('/api/auth', rutasCuentas)
app.route('/api/documentos', rutasDocumentos)

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

  const revision = await revisarConGemini({
    texto: textoLimpio,
    tipoDocumento,
    seccion,
  })

  return c.json({
    ok: true,
    observaciones: revision.observaciones,
    mapa: revision.mapa,
    metricas: revision.metricas,
  })
})

app.post('/api/gramatica', async (c) => {
  let cuerpo: unknown

  try {
    cuerpo = await c.req.json()
  } catch {
    return c.json(
      {
        ok: false,
        codigo: 'peticion_invalida',
        mensaje: MENSAJES_ERROR_GRAMATICA.peticion_invalida,
      },
      400,
    )
  }

  const validacion = validarPeticionGramatica(cuerpo)
  if (!validacion.ok) {
    return c.json(
      {
        ok: false,
        codigo: validacion.codigo,
        mensaje: validacion.mensaje,
      },
      validacion.estado,
    )
  }

  const errores = await revisarConLanguageTool({
    parrafos: validacion.datos.parrafos,
    signal: c.req.raw.signal,
  })

  return c.json({ ok: true, errores })
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
  if (error instanceof ErrorApi) {
    return c.json(
      { ok: false, codigo: error.codigo, mensaje: error.message },
      error.estado as ContentfulStatusCode,
    )
  }

  if (error instanceof ErrorRevision) {
    return c.json(
      { ok: false, codigo: error.codigo, mensaje: error.message },
      error.estado,
    )
  }

  if (error instanceof ErrorGramatica) {
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
