import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { MapaDocumento } from '../server/esquemaMapa.ts'
import { calcularMetricas } from '../server/metricas.ts'
import {
  deduplicarObservaciones,
  normalizarMapa,
  tokensDe,
  verificarDocumento,
  type ObservacionDeterminista,
} from '../server/verificacion.ts'

async function parrafosFixture(nombre: string): Promise<string[]> {
  const ruta = new URL(`./fixtures/${nombre}`, import.meta.url)
  const contenido = await readFile(ruta, 'utf8')
  return contenido
    .split(/\r?\n\s*\r?\n/)
    .map((parrafo) => parrafo.trim())
    .filter((parrafo) => parrafo.length > 0)
}

const mapaBueno: MapaDocumento = {
  tesis_o_objetivo: 'La lectura pausada mejora la comprensión de los textos extensos.',
  secciones: [
    {
      id: 'introduccion',
      rol: 'Presenta el tema y anuncia dos prácticas',
      idea_principal: 'La lectura pausada mejora la comprensión',
      ideas_clave: ['notas marginales', 'ritmo de lectura'],
      parrafos: [1],
    },
    {
      id: 'desarrollo',
      rol: 'Explica las dos prácticas',
      idea_principal: 'Las notas marginales y el ritmo sostienen la comprensión',
      ideas_clave: ['notas marginales', 'ritmo de lectura', 'texto extenso'],
      parrafos: [2, 3],
    },
    {
      id: 'conclusion',
      rol: 'Retoma la tesis',
      idea_principal: 'La lectura pausada mejora la comprensión con notas y ritmo constante',
      ideas_clave: ['notas marginales', 'ritmo de lectura'],
      parrafos: [4],
    },
  ],
  ideas_anunciadas: [
    { idea: 'El papel de las notas marginales al releer', parrafo: 1 },
    { idea: 'La influencia del ritmo de lectura en la comprensión', parrafo: 1 },
  ],
}

test('los tokens se normalizan por prefijo para absorber plurales', () => {
  const tokens = tokensDe('Las familias y la familia leen libros con ritmo')
  assert.equal(tokens.has('famil'), true)
  assert.equal(tokens.has('libro'), true)
  assert.equal(tokens.has('ritmo'), true)
  assert.equal(tokens.has('las'), false)
})

test('normalizarMapa descarta índices fuera de rango y duplicados', () => {
  const mapa = normalizarMapa(
    {
      ...mapaBueno,
      secciones: [
        { ...mapaBueno.secciones[0]!, parrafos: [1, 1, 9] },
        { ...mapaBueno.secciones[1]!, parrafos: [2, 3] },
      ],
      ideas_anunciadas: [{ idea: 'Algo', parrafo: 99 }],
    },
    4,
  )

  assert.deepEqual(mapa.secciones[0]?.parrafos, [1])
  assert.equal(mapa.ideas_anunciadas.length, 0)
})

test('el documento bueno no genera ninguna observación emitida por código', async () => {
  const parrafos = await parrafosFixture('documento-bueno.txt')
  const metricas = calcularMetricas(parrafos)

  assert.equal(metricas.total_parrafos, 4)
  assert.equal(metricas.es_corto, false)
  assert.equal(metricas.sin_estructura, false)

  const observaciones = verificarDocumento({
    tipoDocumento: 'ensayo-argumentativo',
    mapa: mapaBueno,
    metricas,
    parrafos,
  })

  assert.deepEqual(observaciones, [])
})

test('la conclusión con sinónimos no genera observaciones del código', async () => {
  const parrafos = await parrafosFixture('documento-bueno-sinonimos.txt')
  const mapa: MapaDocumento = {
    tesis_o_objetivo:
      'La constancia en la escritura importa más que la inspiración porque convierte la composición en una rutina manejable y permite revisar con calma lo escrito.',
    secciones: [
      {
        id: 'introduccion',
        rol: 'Presentar el tema y la tesis del ensayo junto con los argumentos principales.',
        idea_principal:
          'La constancia es más importante que la inspiración para escribir con éxito.',
        ideas_clave: [
          'La constancia se sostiene con decisiones pequeñas.',
          'La repetición convierte la composición en rutina.',
          'El hábito permite revisar con más calma.',
        ],
        parrafos: [1],
      },
      {
        id: 'desarrollo',
        rol: 'Desarrollar los argumentos anunciados y abordar posibles objeciones.',
        idea_principal:
          'La práctica diaria facilita el acto de escribir, mejora la corrección y canaliza la creatividad.',
        ideas_clave: [
          'La repetición reduce la distancia entre idea y frase.',
          'La escritura frecuente favorece la corrección sin apego excesivo.',
          'La rutina da cauce a la creatividad en lugar de apagarla.',
        ],
        parrafos: [2, 3, 4],
      },
      {
        id: 'conclusion',
        rol: 'Reafirmar la tesis sintetizando las ideas principales sin introducir conceptos nuevos.',
        idea_principal:
          'Cultivar la palabra cada día es más fecundo que aguardar la inspiración.',
        ideas_clave: [
          'La constancia como disciplina.',
          'La práctica continuada como forma de atención.',
        ],
        parrafos: [5],
      },
    ],
    ideas_anunciadas: [
      {
        idea: 'la repetición convierte la composición en una rutina manejable',
        parrafo: 1,
      },
      {
        idea: 'el hábito permite revisar con más calma lo que antes parecía definitivo',
        parrafo: 1,
      },
    ],
  }

  const observaciones = verificarDocumento({
    tipoDocumento: 'ensayo-argumentativo',
    mapa,
    metricas: calcularMetricas(parrafos),
    parrafos,
  })

  assert.deepEqual(observaciones, [])
})

test('el documento vacío no produce métricas de cuerpo', async () => {
  const parrafos = await parrafosFixture('documento-vacio.txt')
  const metricas = calcularMetricas(parrafos)

  assert.equal(parrafos.length, 0)
  assert.equal(metricas.total_palabras, 0)
  assert.equal(metricas.total_parrafos, 0)
})

test('solo introducción se dice explícitamente', async () => {
  const parrafos = await parrafosFixture('documento-solo-introduccion.txt')
  const observaciones = verificarDocumento({
    tipoDocumento: 'ensayo-argumentativo',
    mapa: {
      ...mapaBueno,
      secciones: [{ ...mapaBueno.secciones[0]!, parrafos: [1] }],
      ideas_anunciadas: [
        {
          idea: 'Se ofrecen razones para considerar la lectura pausada una estrategia útil',
          parrafo: 1,
        },
      ],
    },
    metricas: calcularMetricas(parrafos),
    parrafos,
  })

  assert.equal(observaciones.length, 1)
  assert.match(observaciones[0]!.observacion, /Solo hay introducción y falta el desarrollo/)
  assert.equal(
    observaciones[0]!.pregunta_guia,
    '¿Qué argumentos sostendrán la tesis que planteas en la introducción?',
  )
  assert.equal(observaciones[0]!.severidad, 'alta')
})

test('el código es conservador en el ensayo defectuoso anclado', async () => {
  const parrafos = await parrafosFixture('ensayo-prueba.txt')
  const observaciones = verificarDocumento({
    tipoDocumento: 'ensayo-argumentativo',
    mapa: {
      tesis_o_objetivo:
        'La lectura digital sin hábitos de regulación reduce la comprensión profunda y favorece una lectura fragmentada.',
      secciones: [
        {
          id: 'introduccion',
          rol: 'Presenta la tesis y anuncia dos temas',
          idea_principal: 'La lectura digital sin regulación reduce la comprensión',
          ideas_clave: ['familias', 'brecha de acceso a dispositivos'],
          parrafos: [1],
        },
        {
          id: 'desarrollo',
          rol: 'Analiza el soporte y la comprensión',
          idea_principal: 'El soporte no explica por sí solo la comprensión',
          ideas_clave: ['diferencias entre papel y pantalla', 'comprensión'],
          parrafos: [2, 3],
        },
        {
          id: 'conclusion',
          rol: 'Cierra el ensayo',
          idea_principal:
            'La lectura sin mediación empobrece la comprensión y requiere capacitación docente, deserción escolar, costo del papel y evaluación',
          ideas_clave: [
            'capacitación docente',
            'deserción escolar',
            'costo del papel',
            'evaluación',
          ],
          parrafos: [4],
        },
      ],
      ideas_anunciadas: [
        { idea: 'El papel de las familias en los hábitos lectores', parrafo: 1 },
        {
          idea: 'La brecha de acceso a dispositivos en las comunidades',
          parrafo: 1,
        },
      ],
    },
    metricas: calcularMetricas(parrafos),
    parrafos,
  })

  assert.deepEqual(observaciones, [])
})

test('texto-abierto no exige introducción ni conclusión', async () => {
  const parrafos = await parrafosFixture('documento-solo-introduccion.txt')
  const observaciones = verificarDocumento({
    tipoDocumento: 'texto-abierto',
    mapa: {
      ...mapaBueno,
      secciones: [{ ...mapaBueno.secciones[0]!, parrafos: [1] }],
      ideas_anunciadas: [],
    },
    metricas: calcularMetricas(parrafos),
    parrafos,
  })

  assert.ok(observaciones.length > 0)
  assert.ok(
    observaciones.every(
      (observacion) =>
        observacion.tipo_problema === 'desarrollo_corto' &&
        !observacion.criterio_id.startsWith('estructura.'),
    ),
  )
})

test('un resumen pobre del mapa no genera falsos positivos en un documento largo', async () => {
  const parrafos = await parrafosFixture('documento-muy-largo.txt')
  const desarrollo = Array.from({ length: 29 }, (_, indice) => indice + 2)

  const observaciones = verificarDocumento({
    tipoDocumento: 'ensayo-argumentativo',
    mapa: {
      tesis_o_objetivo: parrafos[0]!,
      secciones: [
        {
          id: 'introduccion',
          rol: 'Presenta el tema',
          idea_principal: 'Lectura pausada',
          ideas_clave: ['actitud'],
          parrafos: [1],
        },
        {
          id: 'desarrollo',
          rol: 'Desarrolla el tema',
          idea_principal: 'Resumen pobre',
          ideas_clave: ['estructura'],
          parrafos: desarrollo,
        },
        {
          id: 'conclusion',
          rol: 'Cierra el tema',
          idea_principal: 'Cierre',
          ideas_clave: ['lectura'],
          parrafos: [31],
        },
      ],
      ideas_anunciadas: [
        {
          idea: 'identificar qué afirma el autor, qué ejemplos emplea y qué relación existe entre esos ejemplos y la idea central',
          parrafo: 1,
        },
      ],
    },
    metricas: calcularMetricas(parrafos),
    parrafos,
  })

  assert.equal(
    observaciones.some(
      (observacion) => observacion.tipo_problema === 'idea_no_retomada',
    ),
    false,
  )
  assert.equal(
    observaciones.some(
      (observacion) =>
        observacion.tipo_problema === 'idea_nueva_en_conclusion',
    ),
    false,
  )
})

test('la deduplicación aplica criterio_id y parrafo_id junto al tipo', () => {
  const observaciones: ObservacionDeterminista[] = [
    {
      parrafo_id: 2,
      tipo_problema: 'idea_no_retomada',
      observacion: 'primera',
      pregunta_guia: '¿Dónde?',
      criterio_id: 'ensayo.ideas-retomadas',
      severidad: 'baja',
    },
    {
      parrafo_id: 3,
      tipo_problema: 'idea_no_retomada',
      observacion: 'segunda',
      pregunta_guia: '¿Dónde?',
      criterio_id: 'ensayo.ideas-retomadas',
      severidad: 'baja',
    },
    {
      parrafo_id: 2,
      tipo_problema: 'idea_no_retomada',
      observacion: 'tercera',
      pregunta_guia: '¿Dónde?',
      criterio_id: 'otro.criterio',
      severidad: 'baja',
    },
  ]

  const resultado = deduplicarObservaciones(observaciones)
  assert.equal(resultado.length, 1)
  assert.equal(resultado[0]?.observacion, 'primera')
})
