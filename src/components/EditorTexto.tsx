import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentoGuardado } from '../lib/storage'
import { guardarDocumento } from '../lib/storage'
import { contarPalabras, formatearPalabras } from '../lib/texto'
import type { TipoDocumentoId } from '../lib/tiposDocumento'
import { BarraHerramientas } from './BarraHerramientas'

type EditorTextoProps = {
  documentoInicial: DocumentoGuardado
  tipoDocumento: TipoDocumentoId
}

type EstadoGuardado = 'guardado' | 'pendiente' | 'error'

const RETRASO_GUARDADO_MS = 1000

const TEXTO_ESTADO: Record<EstadoGuardado, string> = {
  guardado: 'Guardado',
  pendiente: 'Guardando…',
  error: 'No se pudo guardar',
}

export function EditorTexto({
  documentoInicial,
  tipoDocumento,
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
    onUpdate: ({ editor: editorActual }) => {
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

  const palabras = useEditorState({
    editor,
    selector: ({ editor: editorActual }) =>
      contarPalabras(editorActual.getText({ blockSeparator: ' ' })),
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

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
      <header className="sticky top-14 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <BarraHerramientas editor={editor} />
      </header>

      <div className="px-3 py-6 sm:px-6 sm:py-10">
        <article className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-[816px] flex-col rounded-sm bg-white px-5 py-10 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 sm:px-14 sm:py-14 lg:px-20">
          <EditorContent editor={editor} className="flex-1" />

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs">
            <p
              aria-live="polite"
              className={
                estadoGuardado === 'error'
                  ? 'font-medium text-red-600'
                  : 'text-slate-500'
              }
            >
              {TEXTO_ESTADO[estadoGuardado]}
            </p>
            <p className="font-medium text-slate-600 tabular-nums">
              {formatearPalabras(palabras)}
            </p>
          </footer>
        </article>
      </div>
    </>
  )
}
