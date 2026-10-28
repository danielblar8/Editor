import {
  CODIGOS_ERROR_GRAMATICA,
  DEBOUNCE_GRAMATICA_MS,
  ESPERA_CUOTA_MS,
  ESPERA_SERVICIO_MS,
  MAX_CARACTERES_POR_PARRAFO,
  MAX_CARACTERES_POR_PETICION,
  MAX_ENTRADAS_CACHE_GRAMATICA,
  MAX_PARRAFOS_POR_PETICION,
  TIMEOUT_CLIENTE_GRAMATICA_MS,
} from './gramaticaTipos'
import type {
  CodigoErrorGramatica,
  ErrorDecoracionGramatica,
  ErrorGramatica,
  EstadoGramatica,
  ParrafoGramatica,
  RespuestaGramatica,
} from './gramaticaTipos'
import type { ParrafoExtraido } from './gramaticaPosiciones'

export const CLAVE_META_GRAMATICA = 'gramaticaDecoraciones'

export type PayloadMetaGramatica = {
  errores: ErrorDecoracionGramatica[]
}

export type ErrorGramaticaLocal = Pick<
  ErrorGramatica,
  'inicio' | 'fin' | 'mensaje' | 'regla'
>

type EntradaCacheGramatica = {
  texto: string
  errores: ErrorGramaticaLocal[]
}

export type ResultadoRevisionGramatica =
  | { ok: true; errores: ErrorGramatica[] }
  | { ok: false; codigo: CodigoErrorGramatica }

export type RevisarGramatica = (
  parrafos: ParrafoGramatica[],
  signal: AbortSignal,
) => Promise<ResultadoRevisionGramatica>

export function hashTextoGramatica(texto: string): string {
  let hash = 0x811c9dc5

  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function claveCacheGramatica(texto: string): string {
  return `${hashTextoGramatica(texto)}:${texto.length}`
}

export class CacheGramatica {
  private readonly entradas = new Map<string, EntradaCacheGramatica>()
  private readonly maximo: number

  constructor(maximo = MAX_ENTRADAS_CACHE_GRAMATICA) {
    this.maximo = Math.max(1, Math.floor(maximo))
  }

  obtener(texto: string): ErrorGramaticaLocal[] | undefined {
    const clave = claveCacheGramatica(texto)
    const entrada = this.entradas.get(clave)
    if (!entrada || entrada.texto !== texto) return undefined

    this.entradas.delete(clave)
    this.entradas.set(clave, entrada)

    return entrada.errores
  }

  tiene(texto: string): boolean {
    const clave = claveCacheGramatica(texto)
    const entrada = this.entradas.get(clave)
    return entrada !== undefined && entrada.texto === texto
  }

  guardar(texto: string, errores: ErrorGramaticaLocal[]): void {
    const clave = claveCacheGramatica(texto)
    this.entradas.delete(clave)
    this.entradas.set(clave, { texto, errores })

    while (this.entradas.size > this.maximo) {
      const masAntigua = this.entradas.keys().next().value
      if (masAntigua === undefined) break
      this.entradas.delete(masAntigua)
    }
  }

  get tamano(): number {
    return this.entradas.size
  }
}

export function agruparParrafosEnTandas(
  parrafos: ParrafoGramatica[],
): ParrafoGramatica[][] {
  const tandas: ParrafoGramatica[][] = []
  let actual: ParrafoGramatica[] = []
  let caracteres = 0

  for (const parrafo of parrafos) {
    const superaCantidad = actual.length >= MAX_PARRAFOS_POR_PETICION
    const superaTotal =
      caracteres + parrafo.texto.length > MAX_CARACTERES_POR_PETICION

    if (actual.length > 0 && (superaCantidad || superaTotal)) {
      tandas.push(actual)
      actual = []
      caracteres = 0
    }

    actual.push(parrafo)
    caracteres += parrafo.texto.length
  }

  if (actual.length > 0) tandas.push(actual)

  return tandas
}

function esCodigoErrorGramatica(
  valor: unknown,
): valor is CodigoErrorGramatica {
  return (
    typeof valor === 'string' &&
    CODIGOS_ERROR_GRAMATICA.some((codigo) => codigo === valor)
  )
}

function esErrorGramatica(valor: unknown): valor is ErrorGramatica {
  if (typeof valor !== 'object' || valor === null) return false

  const error = valor as Record<string, unknown>

  return (
    typeof error.clave === 'string' &&
    typeof error.inicio === 'number' &&
    Number.isInteger(error.inicio) &&
    typeof error.fin === 'number' &&
    Number.isInteger(error.fin) &&
    typeof error.mensaje === 'string' &&
    typeof error.regla === 'string'
  )
}

function esRespuestaGramatica(valor: unknown): valor is RespuestaGramatica {
  if (typeof valor !== 'object' || valor === null) return false

  const respuesta = valor as Record<string, unknown>

  return (
    respuesta.ok === true &&
    Array.isArray(respuesta.errores) &&
    respuesta.errores.every(esErrorGramatica)
  )
}

function codigoDeRespuestaError(datos: unknown): CodigoErrorGramatica | null {
  if (typeof datos !== 'object' || datos === null) return null

  const respuesta = datos as Record<string, unknown>
  if (respuesta.ok !== false) return null

  return esCodigoErrorGramatica(respuesta.codigo) ? respuesta.codigo : null
}

export async function revisarGramatica(
  parrafos: ParrafoGramatica[],
  signal: AbortSignal,
): Promise<ResultadoRevisionGramatica> {
  const controlador = new AbortController()
  let motivo: 'tiempo' | 'externo' | null = null

  const abortarPorExterno = () => {
    motivo = 'externo'
    controlador.abort()
  }

  if (signal.aborted) {
    abortarPorExterno()
  } else {
    signal.addEventListener('abort', abortarPorExterno, { once: true })
  }

  const temporizador = setTimeout(() => {
    if (controlador.signal.aborted) return
    motivo = 'tiempo'
    controlador.abort()
  }, TIMEOUT_CLIENTE_GRAMATICA_MS)

  try {
    let respuesta: Response

    try {
      respuesta = await fetch('/api/gramatica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parrafos }),
        signal: controlador.signal,
      })
    } catch (error) {
      if (motivo === 'externo' || signal.aborted) {
        throw error instanceof Error
          ? error
          : new DOMException('Solicitud cancelada', 'AbortError')
      }
      if (motivo === 'tiempo') {
        return { ok: false, codigo: 'tiempo_agotado' }
      }
      return { ok: false, codigo: 'servicio_no_disponible' }
    }

    let datos: unknown
    let parseado = false

    try {
      datos = await respuesta.json()
      parseado = true
    } catch (error) {
      if (motivo === 'externo' || signal.aborted) {
        throw error instanceof Error
          ? error
          : new DOMException('Solicitud cancelada', 'AbortError')
      }
      if (motivo === 'tiempo') {
        return { ok: false, codigo: 'tiempo_agotado' }
      }
    }

    if (!respuesta.ok) {
      if (parseado) {
        const codigo = codigoDeRespuestaError(datos)
        if (codigo) return { ok: false, codigo }
      }

      if (respuesta.status === 429) {
        return { ok: false, codigo: 'cuota_agotada' }
      }
      if (respuesta.status >= 500) {
        return { ok: false, codigo: 'servicio_no_disponible' }
      }
      return { ok: false, codigo: 'respuesta_invalida' }
    }

    if (!parseado || !esRespuestaGramatica(datos)) {
      return { ok: false, codigo: 'respuesta_invalida' }
    }

    return { ok: true, errores: datos.errores }
  } finally {
    clearTimeout(temporizador)
    signal.removeEventListener('abort', abortarPorExterno)
  }
}

function claveParrafoGramatica(parrafo: ParrafoExtraido): string {
  return `p${parrafo.indice}-${hashTextoGramatica(parrafo.texto)}`
}

function esErrorAborto(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export type OpcionesPlanificadorGramatica = {
  obtenerParrafos: () => ParrafoExtraido[]
  aplicarDecoraciones: (errores: ErrorDecoracionGramatica[]) => void
  alCambiarEstado: (estado: EstadoGramatica) => void
  revisar?: RevisarGramatica
  cache?: CacheGramatica
  ahora?: () => number
  debounceMs?: number
  esperaCuotaMs?: number
  esperaServicioMs?: number
}

export class PlanificadorGramatica {
  private readonly obtenerParrafos: () => ParrafoExtraido[]
  private readonly aplicarDecoraciones: (
    errores: ErrorDecoracionGramatica[],
  ) => void
  private readonly alCambiarEstado: (estado: EstadoGramatica) => void
  private readonly revisar: RevisarGramatica
  private readonly cache: CacheGramatica
  private readonly ahora: () => number
  private readonly debounceMs: number
  private readonly esperaCuotaMs: number
  private readonly esperaServicioMs: number

  private temporizadorRevision: ReturnType<typeof setTimeout> | null = null
  private temporizadorReintento: ReturnType<typeof setTimeout> | null = null
  private aborto: AbortController | null = null
  private secuencia = 0
  private desactivada = false
  private esperaHasta = 0
  private activo = true

  constructor(opciones: OpcionesPlanificadorGramatica) {
    this.obtenerParrafos = opciones.obtenerParrafos
    this.aplicarDecoraciones = opciones.aplicarDecoraciones
    this.alCambiarEstado = opciones.alCambiarEstado
    this.revisar = opciones.revisar ?? revisarGramatica
    this.cache = opciones.cache ?? new CacheGramatica()
    this.ahora = opciones.ahora ?? (() => Date.now())
    this.debounceMs = opciones.debounceMs ?? DEBOUNCE_GRAMATICA_MS
    this.esperaCuotaMs = opciones.esperaCuotaMs ?? ESPERA_CUOTA_MS
    this.esperaServicioMs = opciones.esperaServicioMs ?? ESPERA_SERVICIO_MS
  }

  programarRevision(): void {
    if (!this.activo || this.desactivada) return

    this.secuencia += 1
    this.aborto?.abort()
    this.aborto = null
    this.limpiarRevision()
    this.limpiarReintento()

    this.temporizadorRevision = setTimeout(() => {
      this.temporizadorRevision = null
      void this.ejecutar()
    }, this.debounceMs)
  }

  detener(): void {
    this.activo = false
    this.secuencia += 1
    this.limpiarRevision()
    this.limpiarReintento()
    this.aborto?.abort()
    this.aborto = null
  }

  private async ejecutar(): Promise<void> {
    if (!this.activo || this.desactivada) return

    const ahora = this.ahora()
    if (ahora < this.esperaHasta) {
      this.alCambiarEstado('no_disponible')
      this.programarReintento(this.esperaHasta - ahora)
      return
    }

    this.esperaHasta = 0
    this.aborto?.abort()
    this.aborto = null

    const secuencia = ++this.secuencia
    const todos = this.obtenerParrafos()
    const revisables = todos.filter(
      (parrafo) =>
        parrafo.texto.trim().length > 0 &&
        parrafo.texto.length <= MAX_CARACTERES_POR_PARRAFO,
    )
    const pendientes = revisables.filter(
      (parrafo) => !this.cache.tiene(parrafo.texto),
    )

    if (pendientes.length === 0) {
      this.aplicarDesdeCache()
      this.alCambiarEstado(revisables.length > 0 ? 'listo' : 'inactivo')
      return
    }

    this.alCambiarEstado('revisando')

    const tandas = agruparParrafosEnTandas(
      pendientes.map((parrafo) => ({
        clave: claveParrafoGramatica(parrafo),
        texto: parrafo.texto,
      })),
    )

    for (const tanda of tandas) {
      if (!this.activo || this.desactivada || secuencia !== this.secuencia) {
        return
      }

      const ahoraTanda = this.ahora()
      if (ahoraTanda < this.esperaHasta) {
        this.alCambiarEstado('no_disponible')
        this.programarReintento(this.esperaHasta - ahoraTanda)
        return
      }

      const controlador = new AbortController()
      this.aborto = controlador

      let resultado: ResultadoRevisionGramatica

      try {
        resultado = await this.revisar(tanda, controlador.signal)
      } catch (error) {
        if (!this.activo || secuencia !== this.secuencia) return
        if (esErrorAborto(error)) return

        this.aplicarDesdeCache()
        this.alCambiarEstado('no_disponible')
        return
      } finally {
        if (this.aborto === controlador) this.aborto = null
      }

      if (!this.activo || this.desactivada || secuencia !== this.secuencia) {
        return
      }

      if (!resultado.ok) {
        this.aplicarDesdeCache()
        this.manejarFallo(resultado.codigo)
        return
      }

      this.guardarEnCache(tanda, resultado.errores)
      this.esperaHasta = 0
      this.aplicarDesdeCache()
    }

    if (this.activo && secuencia === this.secuencia) {
      this.alCambiarEstado('listo')
    }
  }

  private aplicarDesdeCache(): void {
    const parrafos = this.obtenerParrafos()
    const errores: ErrorDecoracionGramatica[] = []

    for (const parrafo of parrafos) {
      const locales = this.cache.obtener(parrafo.texto)
      if (!locales) continue

      for (const local of locales) {
        const from = parrafo.inicio + local.inicio
        const to = parrafo.inicio + local.fin

        if (to <= from || to > parrafo.fin) continue

        errores.push({
          from,
          to,
          mensaje: local.mensaje,
          regla: local.regla,
        })
      }
    }

    this.aplicarDecoraciones(errores)
  }

  private guardarEnCache(
    tanda: ParrafoGramatica[],
    errores: ErrorGramatica[],
  ): void {
    const porClave = new Map<string, ErrorGramaticaLocal[]>()
    const textos = new Map<string, string>()

    for (const parrafo of tanda) {
      porClave.set(parrafo.clave, [])
      textos.set(parrafo.clave, parrafo.texto)
    }

    for (const error of errores) {
      const lista = porClave.get(error.clave)
      const texto = textos.get(error.clave)
      if (!lista || texto === undefined) continue

      if (
        error.inicio < 0 ||
        error.fin <= error.inicio ||
        error.fin > texto.length
      ) {
        continue
      }

      lista.push({
        inicio: error.inicio,
        fin: error.fin,
        mensaje: error.mensaje,
        regla: error.regla,
      })
    }

    for (const parrafo of tanda) {
      this.cache.guardar(parrafo.texto, porClave.get(parrafo.clave) ?? [])
    }
  }

  private manejarFallo(codigo: CodigoErrorGramatica): void {
    if (codigo === 'configuracion') {
      this.desactivada = true
      this.limpiarRevision()
      this.limpiarReintento()
      this.alCambiarEstado('no_disponible')
      return
    }

    if (codigo === 'cuota_agotada') {
      this.esperaHasta = this.ahora() + this.esperaCuotaMs
      this.alCambiarEstado('no_disponible')
      this.programarReintento(this.esperaCuotaMs)
      return
    }

    if (codigo === 'servicio_no_disponible' || codigo === 'error_interno') {
      this.esperaHasta = this.ahora() + this.esperaServicioMs
      this.alCambiarEstado('no_disponible')
      this.programarReintento(this.esperaServicioMs)
      return
    }

    this.alCambiarEstado('no_disponible')
  }

  private programarReintento(ms: number): void {
    if (!this.activo || this.desactivada) return

    this.limpiarReintento()
    this.temporizadorReintento = setTimeout(() => {
      this.temporizadorReintento = null
      void this.ejecutar()
    }, Math.max(0, ms))
  }

  private limpiarRevision(): void {
    if (this.temporizadorRevision === null) return
    clearTimeout(this.temporizadorRevision)
    this.temporizadorRevision = null
  }

  private limpiarReintento(): void {
    if (this.temporizadorReintento === null) return
    clearTimeout(this.temporizadorReintento)
    this.temporizadorReintento = null
  }
}
