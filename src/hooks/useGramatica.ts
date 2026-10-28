import type { Editor } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import {
  CacheGramatica,
  CLAVE_META_GRAMATICA,
  PlanificadorGramatica,
} from '../lib/gramatica'
import type { PayloadMetaGramatica } from '../lib/gramatica'
import type { EstadoGramatica } from '../lib/gramaticaTipos'
import { extraerParrafosConPosiciones } from '../lib/gramaticaPosiciones'

/**
 * Mantiene la revisión gramatical del documento.
 *
 * La caché vive fuera del efecto para conservar los resultados entre montajes
 * del editor. El hook solo lee el documento y despacha una transacción de
 * metadatos: nunca modifica el contenido que escribe el usuario.
 */
export function useGramatica(editor: Editor | null): EstadoGramatica {
  const [estado, setEstado] = useState<EstadoGramatica>('inactivo')
  const cacheRef = useRef<CacheGramatica | null>(null)

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const cache = cacheRef.current ?? new CacheGramatica()
    cacheRef.current = cache

    const planificador = new PlanificadorGramatica({
      obtenerParrafos: () => extraerParrafosConPosiciones(editor.state.doc),
      aplicarDecoraciones: (errores) => {
        const payload: PayloadMetaGramatica = { errores }
        editor.view.dispatch(
          editor.state.tr.setMeta(CLAVE_META_GRAMATICA, payload),
        )
      },
      alCambiarEstado: setEstado,
      cache,
    })

    const alActualizar = ({
      transaction,
    }: {
      transaction: { docChanged: boolean }
    }) => {
      if (!transaction.docChanged) return
      planificador.programarRevision()
    }

    editor.on('update', alActualizar)
    planificador.programarRevision()

    return () => {
      editor.off('update', alActualizar)
      planificador.detener()
    }
  }, [editor])

  return editor && !editor.isDestroyed ? estado : 'inactivo'
}
