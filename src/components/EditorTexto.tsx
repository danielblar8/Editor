import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GramaticaDecoraciones } from '../extensions/GramaticaDecoraciones'
import type { PayloadMetaObservaciones } from '../extensions/ObservacionesDecoraciones'
import {
  CLAVE_META_OBSERVACIONES,
  ObservacionesDecoraciones,
} from '../extensions/ObservacionesDecoraciones'
import { ParrafoId } from '../extensions/ParrafoId'
import { useGramatica } from '../hooks/useGramatica'
import type { EstadoGramatica } from '../lib/gramaticaTipos'
import type { ResaltadoParrafo } from '../lib/observaciones'
import type { DocumentoGuardado } from '../lib/storage'
import { guardarDocumento } from '../lib/storage'
import { contarPalabras, formatearPalabras } from '../lib/texto'
import type { TipoDocumentoId } from '../lib/tiposDocumento'
import { BarraHerramientas } from './BarraHerramientas'

type EditorTextoProps = {
  documentoInicial: DocumentoGuardado
  tipoDocumento: TipoDocumentoId
  resaltados: readonly ResaltadoParrafo[]
  onEditorListo?: (editor: Editor | null) => void
}

type EstadoGuardado = 'guardado' | 'pendiente' | 'error'

const RETRASO_GUARDADO_MS = 1000

const TEXTO_ESTADO: Record<EstadoGuardado, string> = {
  guardado: 'Guardado',
  pendiente: 'Guardando…',
  error: 'No se pudo guardar',
}

const TEXTO_GRAMATICA: Record<EstadoGramatica, string> = {
  inactivo: 'Gramática sin texto',
  revisando: 'Revisando gramática…',
  listo: 'Gramática revisada',
  no_disponible: 'Gramática no disponible',
}

const PUNTO_GRAMATICA: Record<EstadoGramatica, string> = {
  inactivo: 'bg-subtle',
  revisando: 'bg-warning',
  listo: 'bg-success',
  no_disponible: 'bg-danger',
}

const COLOR_GRAMATICA: Record<EstadoGramatica, string> = {
  inactivo: 'text-muted',
  revisando: 'text-warning',
  listo: 'text-success',
  no_disponible: 'text-danger',
}

export function EditorTexto({
  documentoInicial,
  tipoDocumento,
  resaltados,
  onEditorListo,
}: EditorTextoProps) {
  const [estadoGuardado, setEstadoGuardado] =
    useState<EstadoGuardado>('guardado')
  const documentoRef = useRef(documentoInicial)
  const editorRef = useRef<Editor | null>(null)
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guardadoPendienteRef = useRef(false)
  const versionRef = useRef(0)
  const tipoPersistidoRef = useRef(documentoInicial.tipoDocumento)

  const persistir = useCallback(
    async (editorActual: Editor, forzar = false) => {
      if (!forzar && !guardadoPendienteRef.current) return

      if (temporizadorRef.current !== null) {
        clearTimeout(temporizadorRef.current)
        temporizadorRef.current = null
      }

      setEstadoGuardado('pendiente')
      const versionAlGuardar = versionRef.current

      try {
        await guardarDocumento({
          ...documentoRef.current,
          contenido: editorActual.getJSON(),
          actualizadoEn: new Date().toISOString(),
        })

        if (versionRef.current === versionAlGuardar) {
          guardadoPendienteRef.current = false
          setEstadoGuardado('guardado')
        }
      } catch {
        guardadoPendienteRef.current = true
        setEstadoGuardado('error')
      }
    },
    [],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ParrafoId,
      GramaticaDecoraciones,
      ObservacionesDecoraciones,
    ],
    content: documentoInicial.contenido,
    editorProps: {
      attributes: {
        class: 'contenido-editor',
        spellcheck: 'true',
        lang: 'es',
        'aria-label': 'Hoja de escritura',
      },
    },
    onUpdate: ({ editor: editorActual, transaction }) => {
      if (!transaction.docChanged) return

      versionRef.current += 1
      guardadoPendienteRef.current = true
      setEstadoGuardado('pendiente')

      if (temporizadorRef.current !== null) {
        clearTimeout(temporizadorRef.current)
      }

      temporizadorRef.current = setTimeout(() => {
        temporizadorRef.current = null
        void persistir(editorActual)
      }, RETRASO_GUARDADO_MS)
    },
  })

  const estadoGramatica = useGramatica(editor)

  // Las decoraciones se aplican con una transacción de metadatos: no cambian
  // el documento, así que no disparan autoguardado ni la revisión gramatical.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const payload: PayloadMetaObservaciones = {
      resaltados: [...resaltados],
    }

    editor.view.dispatch(
      editor.state.tr.setMeta(CLAVE_META_OBSERVACIONES, payload),
    )
  }, [editor, resaltados])

  const palabras = useEditorState({
    editor,
    selector: ({ editor: editorActual }) =>
      contarPalabras(editorActual.getText({ blockSeparator: ' ' })),
  })

  useEffect(() => {
    editorRef.current = editor
    onEditorListo?.(editor)

    return () => {
      onEditorListo?.(null)
    }
  }, [editor, onEditorListo])

  // El tipo de documento es una acción discreta del usuario: se guarda de
  // inmediato, sin esperar al debounce del contenido, para que sobreviva a una
  // recarga aunque no se vuelva a escribir.
  useEffect(() => {
    if (tipoPersistidoRef.current === tipoDocumento) return

    documentoRef.current = { ...documentoRef.current, tipoDocumento }
    guardadoPendienteRef.current = true

    if (!editor) return

    tipoPersistidoRef.current = tipoDocumento
    // Persistir aquí sincroniza el documento con localStorage; el cambio de
    // tipo es una acción externa al ciclo de render.
    // oxlint-disable-next-line react/set-state-in-effect
    void persistir(editor, true)
  }, [editor, persistir, tipoDocumento])

  useEffect(() => {
    const vaciarPendiente = () => {
      const editorActual = editorRef.current
      if (editorActual) void persistir(editorActual)
    }

    window.addEventListener('pagehide', vaciarPendiente)

    return () => {
      window.removeEventListener('pagehide', vaciarPendiente)

      if (temporizadorRef.current !== null) {
        clearTimeout(temporizadorRef.current)
        temporizadorRef.current = null
      }
    }
  }, [persistir])

  return (
    <>
      <header className="sticky top-14 z-20 border-b border-line bg-surface/95 shadow-sm backdrop-blur">
        <BarraHerramientas editor={editor} />
      </header>

      <div className="px-3 py-6 sm:px-6 sm:py-10">
        <article className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-[816px] flex-col rounded-sm border border-sheet-border bg-sheet px-5 py-10 text-ink shadow-xl shadow-slate-900/10 ring-1 ring-line/20 dark:shadow-black/50 sm:px-14 sm:py-14 lg:px-20">
          <EditorContent editor={editor} className="flex-1" />

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p
                aria-live="polite"
                className={
                  estadoGuardado === 'error'
                    ? 'font-medium text-danger'
                    : 'text-muted'
                }
              >
                {TEXTO_ESTADO[estadoGuardado]}
              </p>
              <p
                aria-live="polite"
                className={`flex items-center gap-1.5 font-medium ${COLOR_GRAMATICA[estadoGramatica]}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${PUNTO_GRAMATICA[estadoGramatica]}`}
                />
                {TEXTO_GRAMATICA[estadoGramatica]}
              </p>
            </div>
            <p className="font-medium text-muted tabular-nums">
              {formatearPalabras(palabras)}
            </p>
          </footer>
        </article>
      </div>
    </>
  )
}
