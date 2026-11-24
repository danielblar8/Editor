import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import {
  crearDecoracionesObservaciones,
} from '../src/extensions/ObservacionesDecoraciones.ts'
import { ParrafoId } from '../src/extensions/ParrafoId.ts'
import type { MensajeChat } from '../src/lib/chat.ts'
import {
  crearMensajeTutor,
  crearMensajesRevision,
} from '../src/lib/chat.ts'
import {
  construirResaltados,
  severidadEfectiva,
} from '../src/lib/observaciones.ts'
import type { Observacion } from '../src/lib/revisionTipos.ts'

const esquema = getSchema([StarterKit, ParrafoId])

const contenido = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { parrafoId: 'p1' },
      content: [{ type: 'text', text: 'Introducción' }],
    },
    {
      type: 'paragraph',
      attrs: { parrafoId: 'p2' },
      content: [{ type: 'text', text: 'Desarrollo' }],
    },
  ],
}

function documento() {
  return esquema.nodeFromJSON(contenido)
}

/**
 * ProseMirror guarda los atributos de la decoración en `type.attrs`; la
 * declaración pública solo expone `spec`. Este accesorio permite comprobar la
 * clase que se aplicará al DOM.
 */
function atributos(decoracion: Decoration): Record<string, unknown> {
  const tipo = (decoracion as unknown as {
    type: { attrs: Record<string, unknown> }
  }).type

  return tipo.attrs
}

function observacion(
  parrafo_id: number,
  tipo: Observacion['tipo_problema'],
  severidad?: Observacion['severidad'],
): Observacion {
  return {
    parrafo_id,
    tipo_problema: tipo,
    observacion: 'Observación de prueba.',
    pregunta_guia: '¿Pregunta de prueba?',
    severidad,
  }
}

function mensajeCon(
  parrafoId: string | null,
  obs: Observacion,
  idRevision = 'r1',
): MensajeChat {
  return {
    id: `m-${idRevision}-${parrafoId}-${obs.tipo_problema}`,
    autor: 'tutor',
    texto: 'texto',
    creadoEn: '2026-01-01T00:00:00.000Z',
    variante: 'revision',
    idRevision,
    observacion: obs,
    parrafoId,
  }
}

function mensajeSinRevision(
  texto: string,
  variante: MensajeChat['variante'] = 'normal',
): MensajeChat {
  return {
    id: `normal-${texto}`,
    autor: 'tutor',
    texto,
    creadoEn: '2026-01-01T00:00:00.000Z',
    variante,
  }
}

test('usa la severidad del servidor cuando existe', () => {
  assert.equal(severidadEfectiva(observacion(1, 'desarrollo_corto', 'baja')), 'baja')
})

test('deriva la severidad del tipo si el servidor no la envía', () => {
  assert.equal(severidadEfectiva(observacion(1, 'desarrollo_corto')), 'media')
  assert.equal(severidadEfectiva(observacion(1, 'idea_nueva_en_conclusion')), 'alta')
  assert.equal(severidadEfectiva(observacion(1, 'desequilibrio_entre_secciones')), 'baja')
})

test('construirResaltados deduplica por párrafo y conserva la severidad máxima', () => {
  const mensajes: MensajeChat[] = [
    mensajeCon('p1', observacion(1, 'desarrollo_corto')),
    mensajeCon('p1', observacion(1, 'hueco_argumental')),
    mensajeCon('p1', observacion(1, 'desarrollo_corto', 'baja')),
    mensajeCon(null, observacion(2, 'idea_nueva_en_conclusion')),
    {
      id: 'normal',
      autor: 'tutor',
      texto: 'sin observación',
      creadoEn: '2026-01-01T00:00:00.000Z',
      variante: 'normal',
    },
  ]

  const resaltados = construirResaltados(mensajes)

  assert.equal(resaltados.length, 1)
  assert.deepEqual(resaltados[0], {
    parrafoId: 'p1',
    tipo: 'hueco_argumental',
    severidad: 'alta',
  })
})

test('solo resalta los párrafos de la última revisión', () => {
  const mensajes: MensajeChat[] = [
    mensajeCon('p1', observacion(1, 'hueco_argumental'), 'r1'),
    mensajeCon('p2', observacion(2, 'hueco_argumental'), 'r1'),
    mensajeCon('p2', observacion(2, 'desarrollo_corto'), 'r2'),
  ]

  assert.deepEqual(construirResaltados(mensajes), [
    { parrafoId: 'p2', tipo: 'desarrollo_corto', severidad: 'media' },
  ])
})

test('la severidad se decide dentro de la última revisión, no entre revisiones', () => {
  const mensajes: MensajeChat[] = [
    mensajeCon('p1', observacion(1, 'hueco_argumental', 'alta'), 'r1'),
    mensajeCon('p1', observacion(1, 'desarrollo_corto', 'baja'), 'r2'),
  ]

  assert.deepEqual(construirResaltados(mensajes), [
    { parrafoId: 'p1', tipo: 'desarrollo_corto', severidad: 'baja' },
  ])
})

test('una revisión sin observaciones limpia los resaltados y conserva el historial', () => {
  const idsParrafos = ['p1', 'p2']
  const primera = crearMensajesRevision(
    'documento',
    [observacion(1, 'hueco_argumental')],
    idsParrafos,
  )
  const segunda = crearMensajesRevision('documento', [], idsParrafos)
  const mensajes: MensajeChat[] = [...primera, ...segunda]

  assert.equal(construirResaltados(mensajes).length, 0)
  // Las tarjetas antiguas siguen en el chat, solo dejan de pintar el editor.
  assert.equal(mensajes.length, 2)
  assert.equal(mensajes.filter((mensaje) => mensaje.observacion).length, 1)
})

test('un mensaje normal o de error posterior no borra los resaltados de la última revisión', () => {
  const revision = crearMensajesRevision(
    'documento',
    [observacion(1, 'hueco_argumental')],
    ['p1'],
  )
  const mensajes: MensajeChat[] = [
    ...revision,
    crearMensajeTutor('No se pudo obtener la revisión. Inténtalo de nuevo.'),
    mensajeSinRevision('Tipo de documento actualizado.', 'aviso'),
  ]

  const resaltados = construirResaltados(mensajes)

  assert.equal(resaltados.length, 1)
  assert.equal(resaltados[0]?.parrafoId, 'p1')
})

test('sin ninguna revisión no hay resaltados', () => {
  const mensajes: MensajeChat[] = [
    mensajeSinRevision('Hola, soy tu tutor.', 'bienvenida'),
    mensajeSinRevision('Tu documento está vacío.'),
  ]

  assert.deepEqual(construirResaltados(mensajes), [])
})

test('cada revisión agrupa sus tarjetas bajo un idRevision propio', () => {
  const observaciones = [
    observacion(1, 'hueco_argumental'),
    observacion(2, 'desarrollo_corto'),
  ]
  const primera = crearMensajesRevision('documento', observaciones)
  const segunda = crearMensajesRevision('documento', observaciones)
  const sinProblemas = crearMensajesRevision('documento', [])

  const id = primera[0]?.idRevision
  assert.ok(id)
  assert.ok(primera.every((mensaje) => mensaje.idRevision === id))
  assert.ok(
    segunda.every((mensaje) => mensaje.idRevision && mensaje.idRevision !== id),
  )
  assert.ok(sinProblemas[0]?.idRevision)

  // La ruta real de error de useChatTutor no cuenta como revisión.
  assert.equal(
    crearMensajeTutor('No se pudo obtener la revisión. Inténtalo de nuevo.')
      .idRevision,
    undefined,
  )
})

test('resuelve parrafo_id con la foto de IDs de la petición', () => {
  const idsParrafos = ['p1', null, 'p3']
  const [primero] = crearMensajesRevision(
    'documento',
    [observacion(1, 'desarrollo_corto')],
    idsParrafos,
  )
  const [segundo] = crearMensajesRevision(
    'documento',
    [observacion(2, 'idea_nueva_en_conclusion')],
    idsParrafos,
  )
  const [tercero] = crearMensajesRevision(
    'documento',
    [observacion(3, 'hueco_argumental')],
    idsParrafos,
  )

  assert.equal(primero?.parrafoId, 'p1')
  assert.equal(segundo?.parrafoId, null)
  assert.equal(tercero?.parrafoId, 'p3')
})

test('un parrafo_id fuera de la foto no revienta y queda sin ID', () => {
  const [mensaje] = crearMensajesRevision(
    'documento',
    [observacion(9, 'hueco_argumental')],
    ['p1'],
  )

  assert.equal(mensaje?.parrafoId, null)
})

test('crea una decoración de nodo sobre el bloque observado', () => {
  const doc = documento()
  const antes = doc.textContent
  const decoraciones = crearDecoracionesObservaciones(doc, [
    { parrafoId: 'p2', tipo: 'desarrollo_corto', severidad: 'media' },
  ])
  const encontradas = decoraciones.find()

  assert.equal(encontradas.length, 1)
  const [decoracion] = encontradas
  assert.ok(decoracion)
  assert.equal(
    atributos(decoracion).class,
    'observacion-tutor observacion-tutor--media',
  )
  assert.equal(atributos(decoracion)['data-observacion-tipo'], 'desarrollo_corto')
  assert.equal(atributos(decoracion)['data-observacion-severidad'], 'media')
  assert.deepEqual(decoracion.spec, {
    parrafoId: 'p2',
    tipo: 'desarrollo_corto',
    severidad: 'media',
  })
  assert.equal(doc.textContent, antes)
})

test('las decoraciones se reconstruyen por ID y desaparecen si se borra el bloque', () => {
  const resaltados = [
    { parrafoId: 'p1', tipo: 'hueco_argumental' as const, severidad: 'alta' as const },
  ]

  const conBloque = crearDecoracionesObservaciones(documento(), resaltados)
  assert.equal(conBloque.find().length, 1)

  const sinBloque = esquema.nodeFromJSON({
    type: 'doc',
    content: [contenido.content[1]],
  })
  const reconstruidas = crearDecoracionesObservaciones(sinBloque, resaltados)
  assert.equal(reconstruidas.find().length, 0)
})

test('el resaltado del tutor convive con el subrayado gramatical inline', () => {
  const doc = documento()
  const antes = doc.textContent
  const resaltados = crearDecoracionesObservaciones(doc, [
    { parrafoId: 'p1', tipo: 'idea_no_retomada', severidad: 'media' },
  ])

  // Simula el subrayado de LanguageTool: decoración inline sobre el texto.
  const inline = Decoration.inline(1, 6, {
    class: 'error-gramatica',
    title: 'Mensaje de prueba',
    'data-mensaje': 'Mensaje de prueba',
    'data-regla': 'PRUEBA',
  })

  const juntas = DecorationSet.create(doc, [
    inline,
    ...resaltados.find(),
  ])
  const encontradas = juntas.find()

  assert.equal(encontradas.length, 2)
  assert.ok(
    encontradas.some(
      (decoracion) => atributos(decoracion).class === 'error-gramatica',
    ),
  )
  assert.ok(
    encontradas.some((decoracion) =>
      String(atributos(decoracion).class).includes('observacion-tutor--media'),
    ),
  )
  assert.equal(doc.textContent, antes)
})
