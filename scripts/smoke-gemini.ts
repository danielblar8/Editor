import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, relative, resolve } from 'node:path'
import { ETIQUETAS_TIPO_PROBLEMA } from '../src/lib/revisionTipos.ts'
import {
  esTipoDocumentoId,
  type TipoDocumentoId,
} from '../src/lib/tiposDocumento.ts'
import { ETIQUETAS_ORIGEN_OBSERVACION } from '../server/esquema.ts'
import {
  ErrorRevision,
  dividirParrafos,
  revisarConGemini,
  type ResultadoRevision,
} from '../server/gemini.ts'

const RUTA_POR_DEFECTO = 'scripts/fixtures/ensayo-prueba.txt'
const TIPO_POR_DEFECTO: TipoDocumentoId = 'ensayo-argumentativo'

class ErrorDeConfiguracion extends Error {}
class ErrorDeSalida extends Error {}

async function cargarEnsayo(rutaArgumento?: string) {
  const ruta = resolve(rutaArgumento ?? RUTA_POR_DEFECTO)

  let contenido: string
  try {
    contenido = await readFile(ruta, 'utf8')
  } catch {
    throw new ErrorDeConfiguracion(
      `No se pudo leer el ensayo en "${ruta}". Verifica la ruta e inténtalo de nuevo.`,
    )
  }

  const parrafos = dividirParrafos(contenido)
  if (parrafos.length === 0) {
    throw new ErrorDeConfiguracion(`El archivo "${ruta}" está vacío.`)
  }

  return { ruta, parrafos }
}

function leerTipo(tipoArgumento?: string): TipoDocumentoId {
  if (!tipoArgumento) return TIPO_POR_DEFECTO
  if (esTipoDocumentoId(tipoArgumento)) return tipoArgumento

  throw new ErrorDeConfiguracion(
    `El tipo de documento "${tipoArgumento}" no es válido. Usa ensayo-argumentativo, reporte-investigacion o texto-abierto.`,
  )
}

const dosDigitos = (numero: number) => String(numero).padStart(2, '0')

function nombreArchivoSeguro(rutaEnsayo: string): string {
  const sinExtension = basename(rutaEnsayo, extname(rutaEnsayo))
  const limpio = sinExtension
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return limpio || 'ensayo'
}

function fechaParaArchivo(fecha: Date): string {
  const dia = `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
  const hora = `${dosDigitos(fecha.getHours())}-${dosDigitos(fecha.getMinutes())}-${dosDigitos(fecha.getSeconds())}`
  return `${dia}_${hora}`
}

function fechaLegible(fecha: Date): string {
  const dia = `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
  const hora = `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`
  return `${dia} ${hora}`
}

function construirMarkdown(
  rutaEnsayo: string,
  modelo: string,
  tipoDocumento: TipoDocumentoId,
  revision: ResultadoRevision,
): string {
  const lineas = [
    '# Resultado de la prueba de humo',
    '',
    `- **Archivo:** ${rutaEnsayo}`,
    `- **Tipo de documento:** ${tipoDocumento}`,
    `- **Modelo:** ${modelo}`,
    `- **Párrafos:** ${revision.metricas.total_parrafos}`,
    `- **Palabras:** ${revision.metricas.total_palabras}`,
    `- **Observaciones:** ${revision.observaciones.length}`,
    `- **Tokens:** entrada ${revision.uso?.inputTokens ?? '?'} · salida ${revision.uso?.outputTokens ?? '?'} · total ${revision.uso?.totalTokens ?? '?'}`,
    `- **Generado:** ${fechaLegible(new Date())}`,
    '',
    '## Mapa del documento',
    '',
    '```json',
    JSON.stringify(revision.mapa, null, 2),
    '```',
    '',
    '## Métricas',
    '',
    '```json',
    JSON.stringify(
      {
        total_palabras: revision.metricas.total_palabras,
        total_parrafos: revision.metricas.total_parrafos,
        por_seccion: revision.metricas.por_seccion,
        es_corto: revision.metricas.es_corto,
        sin_estructura: revision.metricas.sin_estructura,
      },
      null,
      2,
    ),
    '```',
    '',
  ]

  if (revision.observaciones.length === 0) {
    lineas.push('Sin observaciones para este documento.', '')
  } else {
    for (const observacion of revision.observaciones) {
      lineas.push(
        `## Párrafo ${observacion.parrafo_id} — ${ETIQUETAS_TIPO_PROBLEMA[observacion.tipo_problema]}`,
        '',
        `- **Criterio:** ${observacion.criterio_id ?? 'sin criterio'}`,
        `- **Origen:** ${ETIQUETAS_ORIGEN_OBSERVACION[observacion.origen]}`,
        `- **Severidad:** ${observacion.severidad ?? 'sin severidad'}`,
        '',
        `**Observación:** ${observacion.observacion}`,
        '',
        `**Pregunta guía:** ${observacion.pregunta_guia}`,
        '',
      )
    }
  }

  return lineas.join('\n')
}

async function guardarResultado(
  rutaEnsayo: string,
  modelo: string,
  tipoDocumento: TipoDocumentoId,
  revision: ResultadoRevision,
): Promise<string> {
  const directorio = resolve('scripts/output')
  const rutaSalida = resolve(
    directorio,
    `resultado-${nombreArchivoSeguro(rutaEnsayo)}-${fechaParaArchivo(new Date())}.md`,
  )
  const contenido = construirMarkdown(rutaEnsayo, modelo, tipoDocumento, revision)

  try {
    await mkdir(directorio, { recursive: true })
    await writeFile(rutaSalida, contenido, 'utf8')
  } catch (error) {
    throw new ErrorDeSalida(
      `No se pudo guardar el resultado en "${rutaSalida}": ${
        error instanceof Error ? error.message : 'error desconocido'
      }`,
    )
  }

  return rutaSalida
}

async function main() {
  const { ruta, parrafos } = await cargarEnsayo(process.argv[2])
  const tipoDocumento = leerTipo(process.argv[3])
  const modelo = process.env.GEMINI_MODEL?.trim() ?? 'desconocido'

  const revision = await revisarConGemini({
    texto: parrafos.join('\n\n'),
    tipoDocumento,
    seccion: 'documento',
  })
  const rutaSalida = await guardarResultado(ruta, modelo, tipoDocumento, revision)

  console.log(`Archivo: ${ruta}`)
  console.log(`Tipo: ${tipoDocumento} · Modelo: ${modelo}`)
  console.log(
    `Párrafos: ${revision.metricas.total_parrafos} · Palabras: ${revision.metricas.total_palabras}`,
  )
  console.log(`Observaciones: ${revision.observaciones.length}`)
  console.log('')
  console.log(JSON.stringify(revision.observaciones, null, 2))
  console.log('')
  console.log(
    `Tokens: entrada ${revision.uso?.inputTokens ?? '?'} · salida ${revision.uso?.outputTokens ?? '?'} · total ${revision.uso?.totalTokens ?? '?'}`,
  )
  console.log(`Guardado en: ${relative(process.cwd(), rutaSalida)}`)
}

main().catch((error: unknown) => {
  if (error instanceof ErrorRevision) {
    if (error.codigo === 'respuesta_invalida') {
      console.error(`\n[ERROR DE VALIDACIÓN] ${error.message}`)
      process.exitCode = 1
      return
    }
    if (error.codigo === 'configuracion') {
      console.error(`\n[ERROR DE CONFIGURACIÓN] ${error.message}`)
      process.exitCode = 3
      return
    }
    console.error(`\n[ERROR DE API] ${error.message}`)
    process.exitCode = 2
    return
  }
  if (error instanceof ErrorDeConfiguracion) {
    console.error(`\n[ERROR DE CONFIGURACIÓN] ${error.message}`)
    process.exitCode = 3
    return
  }
  if (error instanceof ErrorDeSalida) {
    console.error(`\n[ERROR DE SALIDA] ${error.message}`)
    process.exitCode = 3
    return
  }

  console.error('\n[ERROR INESPERADO]', error)
  process.exitCode = 3
})
