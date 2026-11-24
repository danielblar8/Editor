import type { MensajeChat } from './chat'
import type { Severidad, TipoProblema } from './revisionTipos'

/**
 * Observación ya resuelta a un bloque concreto del documento.
 *
 * El editor usa `parrafoId`; la tarjeta sigue mostrando el número de párrafo
 * del servidor. Si el bloque se borra, su decoración desaparece sola.
 */
export type ResaltadoParrafo = {
  parrafoId: string
  tipo: TipoProblema
  severidad: Severidad
}

const SEVERIDAD_POR_TIPO: Record<TipoProblema, Severidad> = {
  hueco_argumental: 'alta',
  idea_no_retomada: 'media',
  desarrollo_corto: 'media',
  conclusion_incoherente: 'alta',
  idea_nueva_en_conclusion: 'alta',
  desequilibrio_entre_secciones: 'baja',
}

const ORDEN_SEVERIDAD: Record<Severidad, number> = {
  baja: 0,
  media: 1,
  alta: 2,
}

/**
 * Severidad que decide el estilo del resaltado. Se usa la que calcula el
 * servidor cuando existe; si el modelo no la envía, se deriva del tipo de
 * problema de forma determinista.
 */
export function severidadEfectiva(observacion: {
  tipo_problema: TipoProblema
  severidad?: Severidad
}): Severidad {
  return observacion.severidad ?? SEVERIDAD_POR_TIPO[observacion.tipo_problema]
}

/**
 * Foco de navegación entre chat y editor. `origen` distingue quién lo pidió:
 * solo `chat` dispara el resaltado temporal en el documento.
 */
export type FocoObservacion = {
  parrafoId: string
  idRevision: string
  origen: 'chat' | 'editor'
  secuencia: number
}

/**
 * ID de la revisión más reciente del historial. `undefined` si el usuario aún
 * no ha pedido ninguna revisión.
 */
export function obtenerIdUltimaRevision(
  mensajes: readonly MensajeChat[],
): string | undefined {
  let ultima: string | undefined

  for (const mensaje of mensajes) {
    if (mensaje.idRevision) ultima = mensaje.idRevision
  }

  return ultima
}

/**
 * Convierte los mensajes de la última revisión en la lista de bloques a
 * resaltar.
 *
 * Solo se tienen en cuenta las tarjetas de la revisión más reciente: una nueva
 * revisión reemplaza los resaltados anteriores y una revisión sin problemas
 * deja el editor limpio. Las tarjetas antiguas siguen en el chat como
 * historial, y los mensajes de error no cuentan como revisión.
 *
 * Solo incluye observaciones que se pudieron resolver a un ID persistente en
 * el momento de la petición. Si hay varias observaciones sobre el mismo
 * párrafo, se muestra la de mayor severidad (la primera en caso de empate).
 */
export function construirResaltados(
  mensajes: readonly MensajeChat[],
): ResaltadoParrafo[] {
  const ultimaRevision = obtenerIdUltimaRevision(mensajes)

  if (!ultimaRevision) return []

  const porParrafo = new Map<string, ResaltadoParrafo>()

  for (const mensaje of mensajes) {
    if (mensaje.idRevision !== ultimaRevision) continue

    const observacion = mensaje.observacion
    const parrafoId = mensaje.parrafoId

    if (!observacion || !parrafoId) continue

    const severidad = severidadEfectiva(observacion)
    const anterior = porParrafo.get(parrafoId)

    if (
      !anterior ||
      ORDEN_SEVERIDAD[severidad] > ORDEN_SEVERIDAD[anterior.severidad]
    ) {
      porParrafo.set(parrafoId, {
        parrafoId,
        tipo: observacion.tipo_problema,
        severidad,
      })
    }
  }

  return [...porParrafo.values()]
}

/**
 * Una tarjeta solo es navegable si pertenece a la revisión visible y su
 * observación se pudo resolver a un bloque que sigue resaltado.
 */
export function mensajeEsNavegable(
  mensaje: MensajeChat,
  idRevisionActual: string | undefined,
  resaltados: readonly ResaltadoParrafo[],
): boolean {
  return Boolean(
    mensaje.observacion &&
      mensaje.idRevision &&
      mensaje.idRevision === idRevisionActual &&
      mensaje.parrafoId &&
      resaltados.some((resaltado) => resaltado.parrafoId === mensaje.parrafoId),
  )
}

/** True cuando el párrafo señalado corresponde a esta tarjeta. */
export function esTarjetaActiva(
  mensaje: MensajeChat,
  foco: FocoObservacion | null,
): boolean {
  return Boolean(
    foco &&
      mensaje.observacion &&
      mensaje.idRevision === foco.idRevision &&
      mensaje.parrafoId === foco.parrafoId,
  )
}
