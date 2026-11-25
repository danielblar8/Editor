import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GramaticaDecoraciones } from '../extensions/GramaticaDecoraciones'
import type {
  PayloadMetaFoco,
  PayloadMetaObservaciones,
} from '../extensions/ObservacionesDecoraciones'
import {
  CLAVE_META_FOCO,
  CLAVE_META_OBSERVACIONES,
  ObservacionesDecoraciones,
} from '../extensions/ObservacionesDecoraciones'
import { ParrafoId } from '../extensions/ParrafoId'
import { useGramatica } from '../hooks/useGramatica'
import type { EstadoGramatica } from '../lib/gramaticaTipos'
import type { FocoObservacion, ResaltadoParrafo } from '../lib/observaciones'
import type { DocumentoGuardado } from '../lib/storage'
import { guardarDocumento } from '../lib/storage'
import { contarPalabras, formatearPalabras } from '../lib/texto'
import type { TipoDocumentoId } from '../lib/tiposDocumento'
import { BarraHerramientas } from './BarraHerramientas'
import { CampoTituloDocumento } from './CampoTituloDocumento'

type EditorTextoProps = {
  documentoInicial: DocumentoGuardado
  titulo: string
  onGuardarTitulo: (titulo: string) => Promise<void>
  onCancelarTitulo?: () => void
  tipoDocumento: TipoDocumentoId
  resaltados: readonly ResaltadoParrafo[]
  foco: FocoObservacion | null
  idRevisionActual: string | undefined
  onParrafoResaltadoClic: (parrafoId: string) => void
  onQuitarResaltados: () => void
  onEditorListo?: (editor: Editor | null) => void
  /**
   * Expone una función para forzar el guardado antes de salir del documento.
   * Devuelve `true` si no queda nada pendiente o si el guardado terminó bien.
   */
  onGuardarListo?: (guardar: (() => Promise<boolean>) | null) => void
}

type EstadoGuardado = 'guardado' | 'pendiente' | 'error'

const RETRASO_GUARDADO_MS = 1000
const DURACION_FOCO_MS = 2400

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
  titulo,
  onGuardarTitulo,
  onCancelarTitulo,
  tipoDocumento,
  resaltados,
  foco,
  idRevisionActual,
  onParrafoResaltadoClic,
  onQuitarResaltados,
  onEditorListo,
  onGuardarListo,
}: EditorTextoProps) {
  const [estadoGuardado, setEstadoGuardado] =
    useState<EstadoGuardado>('guardado')
  const documentoRef = useRef(documentoInicial)
  const cabeceraRef = useRef<HTMLElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guardadoPendienteRef = useRef(false)
  const guardadoEnCursoRef = useRef<Promise<boolean> | null>(null)
  const versionRef = useRef(0)
  const tipoPersistidoRef = useRef(documentoInicial.tipoDocumento)
  const resaltadosRef = useRef(resaltados)
  const alClicParrafoRef = useRef(onParrafoResaltadoClic)

  useEffect(() => {
    resaltadosRef.current = resaltados
  }, [resaltados])

  useEffect(() => {
    alClicParrafoRef.current = onParrafoResaltadoClic
  }, [onParrafoResaltadoClic])

  // La barra pasa a ocupar varias filas en pantallas estrechas. Publicar la
  // altura real de la cabecera evita que el resaltado de una observación quede
  // debajo de ella al llegar desde una tarjeta del chat.
  useEffect(() => {
    const cabecera = cabeceraRef.current
    if (!cabecera || typeof ResizeObserver === 'undefined') return

    const actualizar = () => {
      document.documentElement.style.setProperty(
        '--altura-cabecera-editor',
        `${cabecera.offsetHeight}px`,
      )
    }

    actualizar()
    const observador = new ResizeObserver(actualizar)
    observador.observe(cabecera)

    return () => {
      observador.disconnect()
      document.documentElement.style.removeProperty('--altura-cabecera-editor')
    }
  }, [])

  const persistir = useCallback(
    (editorActual: Editor, forzar = false): Promise<boolean> => {
      if (!forzar && !guardadoPendienteRef.current) {
        return Promise.resolve(true)
      }

      if (temporizadorRef.current !== null) {
        clearTimeout(temporizadorRef.current)
        temporizadorRef.current = null
      }

      // Serializa los guardados: si ya hay uno en curso, el siguiente espera
      // su resultado y vuelve a comprobar si queda algo pendiente. Así una
      // salida del documento no puede adelantar a una escritura anterior.
      const anterior = guardadoEnCursoRef.current ?? Promise.resolve(true)
      const siguiente = anterior.then(async () => {
        if (!forzar && !guardadoPendienteRef.current) return true

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
          return true
        } catch {
          guardadoPendienteRef.current = true
          setEstadoGuardado('error')
          return false
        }
      })

      guardadoEnCursoRef.current = siguiente
      void siguiente.finally(() => {
        if (guardadoEnCursoRef.current === siguiente) {
          guardadoEnCursoRef.current = null
        }
      })

      return siguiente
    },
    [],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Subscript,
      Superscript,
      TextAlign.configure({ types: ['paragraph', 'heading'] }),
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
      // Solo avisa al chat; devuelve false para que ProseMirror siga haciendo
      // lo suyo con el clic (colocar el cursor, por ejemplo).
      handleClickOn: (_view, _pos, nodo) => {
        const id: unknown = nodo.attrs.parrafoId
        if (typeof id !== 'string') return false
        if (!resaltadosRef.current.some((resaltado) => resaltado.parrafoId === id)) {
          return false
        }
        alClicParrafoRef.current(id)
        return false
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

  // Enfatizar un bloque es solo una decoración: la transacción no toca el
  // documento ni la selección, y el desplazamiento se hace en el DOM sin dar
  // el foco al editor.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (foco?.origen !== 'chat' || foco.idRevision !== idRevisionActual) return

    const quitarFoco = () => {
      if (editor.isDestroyed) return
      const payload: PayloadMetaFoco = { parrafoId: null }
      editor.view.dispatch(editor.state.tr.setMeta(CLAVE_META_FOCO, payload))
    }

    const payload: PayloadMetaFoco = { parrafoId: foco.parrafoId }
    editor.view.dispatch(editor.state.tr.setMeta(CLAVE_META_FOCO, payload))

    const bloque = Array.from(
      editor.view.dom.querySelectorAll<HTMLElement>('[data-parrafo-id]'),
    ).find((elemento) => elemento.getAttribute('data-parrafo-id') === foco.parrafoId)
    const sinMovimiento = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    bloque?.scrollIntoView({
      block: 'center',
      behavior: sinMovimiento ? 'auto' : 'smooth',
    })

    const temporizador = setTimeout(quitarFoco, DURACION_FOCO_MS)

    return () => {
      clearTimeout(temporizador)
      quitarFoco()
    }
  }, [editor, foco, idRevisionActual])

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

  /**
   * Vacía el debounce y espera al guardado en curso. Si no hay cambios
   * pendientes, termina sin escribir en la API.
   */
  const guardarAhora = useCallback(async (): Promise<boolean> => {
    const editorActual = editorRef.current
    if (!editorActual || editorActual.isDestroyed) return true

    return persistir(editorActual)
  }, [persistir])

  useEffect(() => {
    onGuardarListo?.(guardarAhora)

    return () => {
      onGuardarListo?.(null)
    }
  }, [guardarAhora, onGuardarListo])

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
      <header
        ref={cabeceraRef}
        className="sticky top-14 z-20 border-b border-line bg-surface/95 shadow-sm backdrop-blur"
      >
        <BarraHerramientas editor={editor} />

        {resaltados.length > 0 && (
          <div className="mx-auto flex w-full max-w-[816px] justify-end px-3 pb-2 sm:px-6">
            <button
              type="button"
              onClick={onQuitarResaltados}
              className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Quitar resaltados
            </button>
          </div>
        )}
      </header>

      <div className="px-3 py-6 sm:px-6 sm:py-10">
        <article className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-[816px] flex-col rounded-sm border border-sheet-border bg-sheet px-5 py-10 text-ink shadow-xl shadow-slate-900/10 ring-1 ring-line/20 dark:shadow-black/50 sm:px-14 sm:py-14 lg:px-20">
          <CampoTituloDocumento
            titulo={titulo}
            onGuardar={onGuardarTitulo}
            onCancelar={onCancelarTitulo}
          />

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
              {estadoGuardado === 'error' && (
                <button
                  type="button"
                  onClick={() => {
                    const editorActual = editorRef.current
                    if (editorActual) void persistir(editorActual, true)
                  }}
                  className="rounded-md border border-line px-2 py-0.5 text-xs font-medium text-muted transition-colors hover:border-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Reintentar
                </button>
              )}
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
