import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import test from 'node:test'
import { app } from '../server/app.ts'
import { cerrarPool, consultar } from '../server/db.ts'
import type {
  DocumentoApi,
  DocumentoResumen,
} from '../src/lib/documentosTipos.ts'

// Se genera en cada ejecución: no hay contraseñas reales en el repositorio.
const CONTRASENA = randomBytes(18).toString('base64url')

type CuerpoError = {
  ok?: boolean
  codigo?: string
  mensaje?: string
}

type CuerpoUsuario = {
  ok: boolean
  usuario: {
    id: string
    nombre: string
    correo: string
    creadoEn: string
  }
}

type CuerpoDocumento = {
  ok: boolean
  documento: DocumentoApi
}

type CuerpoLista = {
  ok: boolean
  documentos: DocumentoResumen[]
}

function correoUnico(): string {
  return `prueba-${randomUUID()}@example.com`
}

function cookieDe(respuesta: Response): string {
  const cabecera = respuesta.headers.get('set-cookie')
  assert.ok(cabecera, 'La respuesta debe incluir la cookie de sesión')
  return cabecera.split(';')[0]!
}

type OpcionesPeticion = {
  metodo?: string
  cookie?: string
  cuerpo?: unknown
  sinCuerpo?: boolean
}

async function peticion(
  ruta: string,
  opciones: OpcionesPeticion = {},
): Promise<Response> {
  const cabeceras = new Headers()

  if (opciones.cookie) cabeceras.set('Cookie', opciones.cookie)

  let cuerpo: string | undefined

  if (!opciones.sinCuerpo && opciones.cuerpo !== undefined) {
    cabeceras.set('Content-Type', 'application/json')
    cuerpo = JSON.stringify(opciones.cuerpo)
  }

  return app.request(ruta, {
    method: opciones.metodo ?? 'GET',
    headers: cabeceras,
    body: cuerpo,
  })
}

async function leerJson<T>(respuesta: Response): Promise<T> {
  return (await respuesta.json()) as T
}

test('registro, sesión y CRUD de documentos aislados por usuario', async () => {
  const usuariosCreados: string[] = []

  try {
    const correoA = correoUnico()

    // Registro abierto y auto-login.
    const registroA = await peticion('/api/auth/registro', {
      metodo: 'POST',
      cuerpo: { nombre: 'Ana', correo: correoA, contrasena: CONTRASENA },
    })
    assert.equal(registroA.status, 201)
    const cookieA = cookieDe(registroA)
    const cabeceraCookie = registroA.headers.get('set-cookie') ?? ''
    assert.match(cabeceraCookie, /HttpOnly/i)
    assert.match(cabeceraCookie, /SameSite=Lax/i)
    assert.match(cabeceraCookie, /Path=\//i)

    const datosA = await leerJson<CuerpoUsuario>(registroA)
    const idA = datosA.usuario.id
    usuariosCreados.push(idA)
    assert.equal(datosA.usuario.correo, correoA)
    assert.ok(datosA.usuario.creadoEn.length > 0)

    // La contraseña se guarda como hash scrypt, nunca en claro.
    const filaHash = await consultar<{ contrasena_hash: string }>(
      'select contrasena_hash from usuarios where id = $1',
      [idA],
    )
    const hash = filaHash.rows[0]!.contrasena_hash
    assert.match(hash, /^scrypt\$/)
    assert.notEqual(hash, CONTRASENA)

    // La base guarda un HMAC del token, no el valor que viaja en la cookie.
    const tokenCookie = cookieA.slice(cookieA.indexOf('=') + 1)
    const filaSesion = await consultar<{ token_hash: string }>(
      'select token_hash from sesiones where usuario_id = $1',
      [idA],
    )
    assert.equal(filaSesion.rows.length, 1)
    assert.notEqual(filaSesion.rows[0]!.token_hash, tokenCookie)

    // La sesión se recupera con la cookie httpOnly.
    const yoA = await peticion('/api/auth/yo', { cookie: cookieA })
    assert.equal(yoA.status, 200)
    assert.equal((await leerJson<CuerpoUsuario>(yoA)).usuario.id, idA)

    // El correo repetido se rechaza sin revelar la contraseña.
    const duplicado = await peticion('/api/auth/registro', {
      metodo: 'POST',
      cuerpo: {
        nombre: 'Otra Ana',
        correo: `  ${correoA.toUpperCase()}  `,
        contrasena: CONTRASENA,
      },
    })
    assert.equal(duplicado.status, 409)
    assert.equal(
      (await leerJson<CuerpoError>(duplicado)).codigo,
      'correo_en_uso',
    )

    // Validación en español.
    const correoInvalido = await peticion('/api/auth/registro', {
      metodo: 'POST',
      cuerpo: { nombre: 'Ana', correo: 'no-es-correo', contrasena: CONTRASENA },
    })
    assert.equal(correoInvalido.status, 400)
    assert.equal(
      (await leerJson<CuerpoError>(correoInvalido)).codigo,
      'peticion_invalida',
    )

    const contrasenaCorta = await peticion('/api/auth/registro', {
      metodo: 'POST',
      cuerpo: {
        nombre: 'Ana',
        correo: correoUnico(),
        contrasena: 'corta',
      },
    })
    assert.equal(contrasenaCorta.status, 400)

    // Login con contraseña incorrecta y con correo inexistente: misma
    // respuesta genérica para no revelar si el correo existe.
    const loginMalo = await peticion('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: correoA, contrasena: 'incorrecta' },
    })
    const loginInexistente = await peticion('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: correoUnico(), contrasena: CONTRASENA },
    })
    assert.equal(loginMalo.status, 401)
    assert.equal(loginInexistente.status, 401)
    const errorMalo = await leerJson<CuerpoError>(loginMalo)
    const errorInexistente = await leerJson<CuerpoError>(loginInexistente)
    assert.equal(errorMalo.codigo, 'credenciales_invalidas')
    assert.equal(errorMalo.mensaje, errorInexistente.mensaje)

    // Login correcto y cierre de sesión.
    const loginA = await peticion('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: correoA, contrasena: CONTRASENA },
    })
    assert.equal(loginA.status, 200)
    const cookieA2 = cookieDe(loginA)

    const logoutA = await peticion('/api/auth/logout', {
      metodo: 'POST',
      cookie: cookieA2,
    })
    assert.equal(logoutA.status, 200)
    const yoTrasLogout = await peticion('/api/auth/yo', { cookie: cookieA2 })
    assert.equal(yoTrasLogout.status, 200)
    assert.equal(
      (await leerJson<{ usuario: null }>(yoTrasLogout)).usuario,
      null,
    )

    const nuevoLoginA = await peticion('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: correoA, contrasena: CONTRASENA },
    })
    assert.equal(nuevoLoginA.status, 200)
    const cookieA3 = cookieDe(nuevoLoginA)

    // Sin sesión no se puede listar ni crear documentos.
    const listaSinSesion = await peticion('/api/documentos')
    assert.equal(listaSinSesion.status, 401)

    // Lista inicial vacía.
    const listaInicial = await peticion('/api/documentos', {
      cookie: cookieA3,
    })
    assert.equal(listaInicial.status, 200)
    assert.deepEqual(
      (await leerJson<CuerpoLista>(listaInicial)).documentos,
      [],
    )

    // Crear dos documentos: uno con datos y otro con los valores por defecto.
    const creacion1 = await peticion('/api/documentos', {
      metodo: 'POST',
      cookie: cookieA3,
      cuerpo: {
        titulo: 'Documento A',
        tipoDocumento: 'ensayo-argumentativo',
      },
    })
    assert.equal(creacion1.status, 201)
    const doc1 = (await leerJson<CuerpoDocumento>(creacion1)).documento
    assert.equal(doc1.titulo, 'Documento A')
    assert.equal(doc1.tipoDocumento, 'ensayo-argumentativo')
    assert.equal(doc1.contenido.type, 'doc')

    const creacion2 = await peticion('/api/documentos', {
      metodo: 'POST',
      cookie: cookieA3,
      sinCuerpo: true,
    })
    assert.equal(creacion2.status, 201)
    const doc2 = (await leerJson<CuerpoDocumento>(creacion2)).documento
    assert.equal(doc2.titulo, 'Sin título')
    assert.equal(doc2.tipoDocumento, 'texto-abierto')

    const listaA = await peticion('/api/documentos', { cookie: cookieA3 })
    assert.equal(listaA.status, 200)
    assert.equal(
      (await leerJson<CuerpoLista>(listaA)).documentos.length,
      2,
    )

    // Leer el documento completo.
    const lecturaDoc1 = await peticion(`/api/documentos/${doc1.id}`, {
      cookie: cookieA3,
    })
    assert.equal(lecturaDoc1.status, 200)
    const doc1Leido = (await leerJson<CuerpoDocumento>(lecturaDoc1)).documento
    assert.equal(doc1Leido.id, doc1.id)

    // Guardar contenido y tipo juntos.
    const contenidoNuevo = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { parrafoId: randomUUID() },
          content: [{ type: 'text', text: 'Texto de prueba del documento A.' }],
        },
      ],
    }

    const guardado = await peticion(
      `/api/documentos/${doc1.id}/contenido`,
      {
        metodo: 'PUT',
        cookie: cookieA3,
        cuerpo: {
          contenido: contenidoNuevo,
          tipoDocumento: 'reporte-investigacion',
        },
      },
    )
    assert.equal(guardado.status, 200)
    const doc1Guardado = (await leerJson<CuerpoDocumento>(guardado)).documento
    assert.equal(doc1Guardado.tipoDocumento, 'reporte-investigacion')
    assert.deepEqual(doc1Guardado.contenido, contenidoNuevo)

    // Renombrar.
    const renombrado = await peticion(`/api/documentos/${doc1.id}`, {
      metodo: 'PATCH',
      cookie: cookieA3,
      cuerpo: { titulo: 'Documento A renombrado' },
    })
    assert.equal(renombrado.status, 200)
    assert.equal(
      (await leerJson<CuerpoDocumento>(renombrado)).documento.titulo,
      'Documento A renombrado',
    )

    // Validación de contenido y tipo.
    const tipoInvalido = await peticion(`/api/documentos/${doc1.id}`, {
      metodo: 'PATCH',
      cookie: cookieA3,
      cuerpo: { tipoDocumento: 'tipo-inventado' },
    })
    assert.equal(tipoInvalido.status, 400)

    const contenidoInvalido = await peticion(
      `/api/documentos/${doc1.id}/contenido`,
      {
        metodo: 'PUT',
        cookie: cookieA3,
        cuerpo: {
          contenido: { type: 'paragraph' },
          tipoDocumento: 'texto-abierto',
        },
      },
    )
    assert.equal(contenidoInvalido.status, 400)

    const contenidoGrande = await peticion(
      `/api/documentos/${doc1.id}/contenido`,
      {
        metodo: 'PUT',
        cookie: cookieA3,
        cuerpo: {
          contenido: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'x'.repeat(1_000_100) }],
              },
            ],
          },
          tipoDocumento: 'texto-abierto',
        },
      },
    )
    assert.equal(contenidoGrande.status, 413)

    // Segundo usuario: no ve ni puede tocar los documentos de A.
    const correoB = correoUnico()
    const registroB = await peticion('/api/auth/registro', {
      metodo: 'POST',
      cuerpo: { nombre: 'Beto', correo: correoB, contrasena: CONTRASENA },
    })
    assert.equal(registroB.status, 201)
    const cookieB = cookieDe(registroB)
    const idB = (await leerJson<CuerpoUsuario>(registroB)).usuario.id
    usuariosCreados.push(idB)

    const listaB = await peticion('/api/documentos', { cookie: cookieB })
    assert.deepEqual(
      (await leerJson<CuerpoLista>(listaB)).documentos,
      [],
    )

    const lecturaCruzada = await peticion(`/api/documentos/${doc1.id}`, {
      cookie: cookieB,
    })
    assert.equal(lecturaCruzada.status, 404)

    const cambioCruzado = await peticion(
      `/api/documentos/${doc1.id}/contenido`,
      {
        metodo: 'PUT',
        cookie: cookieB,
        cuerpo: {
          contenido: { type: 'doc', content: [] },
          tipoDocumento: 'texto-abierto',
        },
      },
    )
    assert.equal(cambioCruzado.status, 404)

    const borradoCruzado = await peticion(`/api/documentos/${doc1.id}`, {
      metodo: 'DELETE',
      cookie: cookieB,
    })
    assert.equal(borradoCruzado.status, 404)

    // Borrar el propio documento.
    const borrado = await peticion(`/api/documentos/${doc1.id}`, {
      metodo: 'DELETE',
      cookie: cookieA3,
    })
    assert.equal(borrado.status, 200)

    const lecturaBorrado = await peticion(`/api/documentos/${doc1.id}`, {
      cookie: cookieA3,
    })
    assert.equal(lecturaBorrado.status, 404)

    const listaFinalA = await peticion('/api/documentos', {
      cookie: cookieA3,
    })
    const documentosFinalesA = await leerJson<CuerpoLista>(listaFinalA)
    assert.equal(documentosFinalesA.documentos.length, 1)
    assert.equal(documentosFinalesA.documentos[0]!.id, doc2.id)
  } finally {
    if (usuariosCreados.length > 0) {
      await consultar(
        'delete from usuarios where id = any($1::uuid[])',
        [usuariosCreados],
      ).catch(() => {
        // Si la prueba falló por falta de base, no ocultar el error original.
      })
    }

    await cerrarPool()
  }
})
