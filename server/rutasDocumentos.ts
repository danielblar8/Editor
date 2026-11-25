import { Hono } from 'hono'
import type { Context } from 'hono'
import type { DocumentoApi } from '../src/lib/documentosTipos.ts'
import {
  esquemaCrearDocumento,
  esquemaGuardarContenido,
  esquemaRenombrarDocumento,
  LIMITE_CONTENIDO_BYTES,
} from '../src/lib/documentosTipos.ts'
import {
  actualizarDocumento,
  borrarDocumento,
  crearDocumento,
  guardarContenido,
  listarDocumentos,
  obtenerDocumento,
} from './documentos.ts'
import type { VariablesApi } from './entorno.ts'
import { requerirSesion } from './requerirSesion.ts'
import {
  esUuid,
  leerCuerpoJson,
  leerCuerpoJsonOpcional,
  primerMensajeValidacion,
} from './validacion.ts'

const MENSAJE_NO_ENCONTRADO =
  'El documento no existe o no tienes acceso a él.'

function respuestaNoEncontrado(c: Context) {
  return c.json(
    {
      ok: false,
      codigo: 'documento_no_encontrado',
      mensaje: MENSAJE_NO_ENCONTRADO,
    },
    404,
  )
}

function respuestaPeticionInvalida(c: Context, mensaje: string) {
  return c.json({ ok: false, codigo: 'peticion_invalida', mensaje }, 400)
}

export const rutasDocumentos = new Hono<{ Variables: VariablesApi }>()

rutasDocumentos.use('*', requerirSesion)

rutasDocumentos.get('/', async (c) => {
  const usuario = c.get('usuario')
  const documentos = await listarDocumentos(usuario.id)

  return c.json({ ok: true, documentos })
})

rutasDocumentos.post('/', async (c) => {
  const usuario = c.get('usuario')
  const cuerpo = await leerCuerpoJsonOpcional(c)
  const validacion = esquemaCrearDocumento.safeParse(cuerpo)

  if (!validacion.success) {
    return respuestaPeticionInvalida(
      c,
      primerMensajeValidacion(validacion.error),
    )
  }

  const documento = await crearDocumento(usuario.id, validacion.data)
  return c.json({ ok: true, documento }, 201)
})

rutasDocumentos.get('/:id', async (c) => {
  const usuario = c.get('usuario')
  const id = c.req.param('id')

  if (!esUuid(id)) return respuestaNoEncontrado(c)

  const documento = await obtenerDocumento(usuario.id, id)
  if (!documento) return respuestaNoEncontrado(c)

  return c.json({ ok: true, documento })
})

rutasDocumentos.patch('/:id', async (c) => {
  const usuario = c.get('usuario')
  const id = c.req.param('id')

  if (!esUuid(id)) return respuestaNoEncontrado(c)

  const cuerpo = await leerCuerpoJson(c)
  const validacion = esquemaRenombrarDocumento.safeParse(cuerpo)

  if (!validacion.success) {
    return respuestaPeticionInvalida(
      c,
      primerMensajeValidacion(validacion.error),
    )
  }

  const documento = await actualizarDocumento(usuario.id, id, validacion.data)
  if (!documento) return respuestaNoEncontrado(c)

  return c.json({ ok: true, documento })
})

rutasDocumentos.put('/:id/contenido', async (c) => {
  const usuario = c.get('usuario')
  const id = c.req.param('id')

  if (!esUuid(id)) return respuestaNoEncontrado(c)

  const cuerpo = await leerCuerpoJson(c)
  const validacion = esquemaGuardarContenido.safeParse(cuerpo)

  if (!validacion.success) {
    return respuestaPeticionInvalida(
      c,
      primerMensajeValidacion(validacion.error),
    )
  }

  const bytes = Buffer.byteLength(
    JSON.stringify(validacion.data.contenido),
    'utf8',
  )

  if (bytes > LIMITE_CONTENIDO_BYTES) {
    return c.json(
      {
        ok: false,
        codigo: 'contenido_demasiado_grande',
        mensaje: `El documento supera el límite de ${LIMITE_CONTENIDO_BYTES.toLocaleString('es-ES')} bytes.`,
      },
      413,
    )
  }

  const documento: DocumentoApi | null = await guardarContenido(
    usuario.id,
    id,
    validacion.data,
  )
  if (!documento) return respuestaNoEncontrado(c)

  return c.json({ ok: true, documento })
})

rutasDocumentos.delete('/:id', async (c) => {
  const usuario = c.get('usuario')
  const id = c.req.param('id')

  if (!esUuid(id)) return respuestaNoEncontrado(c)

  const borrado = await borrarDocumento(usuario.id, id)
  if (!borrado) return respuestaNoEncontrado(c)

  return c.json({ ok: true })
})
