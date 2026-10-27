/**
 * Prueba de humo de la Fase 0.
 *
 * Lee un ensayo en texto plano, lo envía a Gemini y muestra observaciones de
 * estructura y coherencia. El texto del autor viaja en modo lectura: el modelo
 * no puede ni debe reescribirlo.
 *
 * Uso:
 *   npm run smoke                        # usa el ensayo de prueba incluido
 *   npm run smoke -- ruta/al/ensayo.txt  # usa otro archivo
 *
 * Códigos de salida:
 *   0  Éxito.
 *   1  Error de validación: la salida del modelo no cumple el esquema Zod.
 *   2  Error de API: red, credenciales, cuota, modelo inexistente, etc.
 *   3  Error de configuración: falta una variable de entorno o el archivo.
 *      También se usa si no se puede escribir el resultado en scripts/output/.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, relative, resolve } from 'node:path'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  APICallError,
  NoObjectGeneratedError,
  Output,
  TypeValidationError,
  generateText,
} from 'ai'
import { z } from 'zod'

const RUTA_POR_DEFECTO = 'scripts/fixtures/ensayo-prueba.txt'

const TIPOS_DE_PROBLEMA = [
  'hueco_argumental',
  'idea_no_retomada',
  'desarrollo_corto',
  'conclusion_incoherente',
  'idea_nueva_en_conclusion',
  'desequilibrio_entre_secciones',
] as const

type TipoProblema = (typeof TIPOS_DE_PROBLEMA)[number]

const ETIQUETAS_TIPO_PROBLEMA: Record<TipoProblema, string> = {
  hueco_argumental: 'Hueco argumental',
  idea_no_retomada: 'Idea no retomada',
  desarrollo_corto: 'Desarrollo corto',
  conclusion_incoherente: 'Conclusión incoherente',
  idea_nueva_en_conclusion: 'Idea nueva en la conclusión',
  desequilibrio_entre_secciones: 'Desequilibrio entre secciones',
}

type UsoDeTokens = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

const esquemaObservacion = z.object({
  parrafo_id: z
    .number()
    .int()
    .positive()
    .describe('Número del párrafo observado, tal como aparece en [PÁRRAFO N].'),
  tipo_problema: z
    .enum(TIPOS_DE_PROBLEMA)
    .describe('Categoría del problema detectado.'),
  observacion: z
    .string()
    .min(1)
    .describe(
      'Diagnóstico breve y concreto, en español, sin reescribir el texto del autor.',
    ),
  pregunta_guia: z
    .string()
    .min(1)
    .describe(
      'Pregunta abierta para que el autor revise su propio texto sin recibir una versión corregida.',
    ),
})

const esquemaSalida = z.array(esquemaObservacion)

const PROMPT_SISTEMA = `Eres un tutor de escritura académica en español. Evalúas la estructura y la coherencia de un ensayo argumentativo.

Reglas obligatorias:
- No reescribas el texto del autor, ni total ni parcialmente.
- No propongas frases, párrafos ni "versiones mejoradas".
- No corrijas ortografía ni gramática: no forman parte de esta revisión.
- Cada observación debe describir un problema concreto y verificable en el texto.
- Cada pregunta_guia debe ayudar al autor a decidir cómo revisar su propio texto.
- Si un párrafo no presenta problemas, no lo incluyas.
- Responde siempre en español.`

const TAREA = `Analiza la estructura y la coherencia del documento y devuelve solo los problemas reales que encuentres.

Busca específicamente:
- Huecos argumentales: afirmaciones que no se justifican.
- Ideas anunciadas en la introducción que nunca se retoman.
- Desarrollo demasiado corto en relación con lo prometido.
- Conclusiones incoherentes con el desarrollo.
- Ideas nuevas que aparecen en la conclusión sin haber sido trabajadas.
- Desequilibrio entre secciones.

Devuelve una lista de observaciones. Usa el número de párrafo que aparece entre corchetes como parrafo_id. No devuelvas una lista vacía si hay problemas evidentes.`

class ErrorDeConfiguracion extends Error {}
class ErrorDeValidacion extends Error {}
class ErrorDeAPI extends Error {}
class ErrorDeSalida extends Error {}

function leerVariable(nombre: string): string {
  const valor = process.env[nombre]?.trim()
  if (!valor) {
    throw new ErrorDeConfiguracion(
      `Falta la variable de entorno ${nombre}. Revísala en tu archivo .env (toma como referencia .env.example).`,
    )
  }
  return valor
}

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

  const parrafos = contenido
    .split(/\r?\n\s*\r?\n/)
    .map((parrafo) => parrafo.trim())
    .filter((parrafo) => parrafo.length > 0)

  if (parrafos.length === 0) {
    throw new ErrorDeConfiguracion(`El archivo "${ruta}" está vacío.`)
  }

  return { ruta, parrafos }
}

function construirPrompt(parrafos: string[]): string {
  const documento = parrafos
    .map((parrafo, indice) => `[PÁRRAFO ${indice + 1}]\n${parrafo}`)
    .join('\n\n')

  return `${TAREA}\n\nDOCUMENTO A EVALUAR (solo lectura, no lo modifiques):\n\n${documento}`
}

function describirErrorDeValidacion(error: unknown): string {
  const causa = error instanceof NoObjectGeneratedError ? error.cause : undefined

  if (causa instanceof TypeValidationError) {
    return 'La respuesta del modelo no cumple el esquema esperado (Zod). No se imprimen observaciones para no mostrar datos inválidos.'
  }
  if (causa instanceof Error && causa.name === 'AI_JSONParseError') {
    return 'La respuesta del modelo no es JSON válido. No se imprimen observaciones para no mostrar datos inválidos.'
  }
  if (error instanceof NoObjectGeneratedError) {
    return `El modelo no devolvió un objeto interpretable (motivo de finalización: ${error.finishReason ?? 'desconocido'}).`
  }
  return 'La salida del modelo no superó la validación local con Zod.'
}

function describirErrorDeAPI(error: unknown): string {
  if (error instanceof APICallError) {
    const cuerpo = error.responseBody?.replace(/\s+/g, ' ').slice(0, 300)
    const detalle = cuerpo ? `\nDetalle del proveedor: ${cuerpo}` : ''

    switch (error.statusCode) {
      case 400:
        if (/API_KEY_INVALID|API key not valid/i.test(error.responseBody ?? '')) {
          return `La clave de API no es válida (400). Revisa GEMINI_API_KEY.${detalle}`
        }
        return `Gemini rechazó la solicitud (400). Revisa el modelo configurado en GEMINI_MODEL.${detalle}`
      case 401:
      case 403:
        return `La clave de API no es válida o no tiene permisos (${error.statusCode}). Revisa GEMINI_API_KEY.${detalle}`
      case 404:
        return `No se encontró el modelo "${process.env.GEMINI_MODEL ?? ''}" (404). Revisa GEMINI_MODEL.${detalle}`
      case 429:
        return `Se agotó la cuota de la capa gratuita o hay demasiadas solicitudes (429). Espera un momento y vuelve a intentarlo.${detalle}`
      default:
        return `La API de Gemini respondió con un error${error.statusCode ? ` ${error.statusCode}` : ''}.${detalle}`
    }
  }

  if (error instanceof Error) {
    return `No se pudo completar la llamada a Gemini: ${error.message}`
  }

  return 'No se pudo completar la llamada a Gemini por un error desconocido.'
}

function contarPalabras(parrafos: string[]): number {
  return parrafos
    .join(' ')
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0).length
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
  parrafos: string[],
  observaciones: z.infer<typeof esquemaSalida>,
  uso: UsoDeTokens,
): string {
  const lineas = [
    '# Resultado de la prueba de humo',
    '',
    `- **Archivo:** ${rutaEnsayo}`,
    `- **Modelo:** ${modelo}`,
    `- **Párrafos:** ${parrafos.length}`,
    `- **Palabras:** ${contarPalabras(parrafos)}`,
    `- **Observaciones:** ${observaciones.length}`,
    `- **Tokens:** entrada ${uso.inputTokens ?? '?'} · salida ${uso.outputTokens ?? '?'} · total ${uso.totalTokens ?? '?'}`,
    `- **Generado:** ${fechaLegible(new Date())}`,
    '',
  ]

  if (observaciones.length === 0) {
    lineas.push('Sin observaciones para este documento.', '')
  } else {
    for (const observacion of observaciones) {
      lineas.push(
        `## Párrafo ${observacion.parrafo_id} — ${ETIQUETAS_TIPO_PROBLEMA[observacion.tipo_problema]}`,
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
  parrafos: string[],
  observaciones: z.infer<typeof esquemaSalida>,
  uso: UsoDeTokens,
): Promise<string> {
  const directorio = resolve('scripts/output')
  const rutaSalida = resolve(
    directorio,
    `resultado-${nombreArchivoSeguro(rutaEnsayo)}-${fechaParaArchivo(new Date())}.md`,
  )
  const contenido = construirMarkdown(
    rutaEnsayo,
    modelo,
    parrafos,
    observaciones,
    uso,
  )

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

function imprimirResultado(
  ruta: string,
  parrafos: string[],
  modelo: string,
  observaciones: z.infer<typeof esquemaSalida>,
  uso: UsoDeTokens,
  rutaSalida: string,
) {
  console.log(`Archivo: ${ruta}`)
  console.log(
    `Párrafos: ${parrafos.length} · Palabras: ${contarPalabras(parrafos)} · Modelo: ${modelo}`,
  )
  console.log(`Observaciones: ${observaciones.length}`)
  console.log('')
  console.log(JSON.stringify(observaciones, null, 2))
  console.log('')
  console.log(
    `Tokens: entrada ${uso.inputTokens ?? '?'} · salida ${uso.outputTokens ?? '?'} · total ${uso.totalTokens ?? '?'}`,
  )
  console.log(`Guardado en: ${relative(process.cwd(), rutaSalida)}`)
}

async function main() {
  const { ruta, parrafos } = await cargarEnsayo(process.argv[2])
  const apiKey = leerVariable('GEMINI_API_KEY')
  const modelo = leerVariable('GEMINI_MODEL')

  const proveedor = createGoogleGenerativeAI({ apiKey })

  let resultado
  try {
    resultado = await generateText({
      model: proveedor(modelo),
      system: PROMPT_SISTEMA,
      prompt: construirPrompt(parrafos),
      output: Output.array({
        element: esquemaObservacion,
        name: 'observaciones',
        description:
          'Lista de problemas de estructura y coherencia detectados en el ensayo.',
      }),
      temperature: 0.2,
      maxRetries: 1,
    })
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new ErrorDeValidacion(describirErrorDeValidacion(error), {
        cause: error,
      })
    }
    if (TypeValidationError.isInstance(error)) {
      throw new ErrorDeValidacion(describirErrorDeValidacion(error), {
        cause: error,
      })
    }
    if (APICallError.isInstance(error)) {
      throw new ErrorDeAPI(describirErrorDeAPI(error), { cause: error })
    }
    if (error instanceof Error) {
      throw new ErrorDeAPI(describirErrorDeAPI(error), { cause: error })
    }
    throw new ErrorDeAPI('Error desconocido al llamar a Gemini.', { cause: error })
  }

  // Validación local redundante a propósito: el script nunca imprime datos que
  // no hayan pasado por Zod, aunque el SDK ya los haya validado.
  const validacion = esquemaSalida.safeParse(resultado.output)
  if (!validacion.success) {
    throw new ErrorDeValidacion(
      `La salida del modelo no superó la validación local con Zod:\n${z.prettifyError(validacion.error)}`,
    )
  }

  const rutaSalida = await guardarResultado(
    ruta,
    modelo,
    parrafos,
    validacion.data,
    resultado.totalUsage,
  )

  imprimirResultado(
    ruta,
    parrafos,
    modelo,
    validacion.data,
    resultado.totalUsage,
    rutaSalida,
  )
}

main().catch((error: unknown) => {
  if (error instanceof ErrorDeValidacion) {
    console.error(`\n[ERROR DE VALIDACIÓN] ${error.message}`)
    process.exitCode = 1
    return
  }
  if (error instanceof ErrorDeAPI) {
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
