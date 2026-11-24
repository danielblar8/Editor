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
 * Convierte los mensajes con observación en la lista de bloques a resaltar.
 *
 * Solo incluye observaciones que se pudieron resolver a un ID persistente en
 * el momento de la petición. Si hay varias observaciones sobre el mismo
 * párrafo, se muestra la de mayor severidad (la primera en caso de empate).
 */
export function construirResaltados(
  mensajes: readonly MensajeChat[],
): ResaltadoParrafo[] {
  const porParrafo = new Map<string, ResaltadoParrafo>()

  for (const mensaje of mensajes) {
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
