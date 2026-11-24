import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatLateral } from './components/ChatLateral'
import { DialogoTipoDocumento } from './components/DialogoTipoDocumento'
import { EditorTexto } from './components/EditorTexto'
import { EncabezadoApp } from './components/EncabezadoApp'
import { useChatTutor } from './hooks/useChatTutor'
import { useTema } from './hooks/useTema'
import { construirResaltados } from './lib/observaciones'
import { extraerParrafosConId, unirParrafos } from './lib/parrafos'
import type { DocumentoGuardado } from './lib/storage'
import { cargarDocumento } from './lib/storage'
import type { TipoDocumentoId } from './lib/tiposDocumento'
import { TIPO_DOCUMENTO_POR_DEFECTO } from './lib/tiposDocumento'

function App() {
  const [documento, setDocumento] = useState<DocumentoGuardado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoId>(
    TIPO_DOCUMENTO_POR_DEFECTO,
  )
  const [dialogoInicialAbierto, setDialogoInicialAbierto] = useState(false)
  const [chatAbierto, setChatAbierto] = useState(
    () => !window.matchMedia('(max-width: 1023px)').matches,
  )
  const [enfocarChatAlAbrir, setEnfocarChatAlAbrir] = useState(false)
  const botonChatRef = useRef<HTMLButtonElement>(null)
  const editorRef = useRef<Editor | null>(null)

  const obtenerDocumento = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return { texto: '', idsParrafos: [] }

    // Una sola lectura del documento: el texto y la foto de IDs salen de la
    // misma lista, así que `parrafo_id` siempre apunta al bloque correcto.
    const parrafos = extraerParrafosConId(editor)

    return {
      texto: unirParrafos(parrafos.map((parrafo) => parrafo.texto)),
      idsParrafos: parrafos.map((parrafo) => parrafo.id),
    }
  }, [])

  const registrarEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const chat = useChatTutor(tipoDocumento, obtenerDocumento)
  const tema = useTema()
  const resaltados = useMemo(
    () => construirResaltados(chat.mensajes),
    [chat.mensajes],
  )

  useEffect(() => {
    let activo = true

    cargarDocumento()
      .then(({ documento: cargado, esNuevo }) => {
        if (!activo) return

        setDocumento(cargado)
        setTipoDocumento(cargado.tipoDocumento)
        setDialogoInicialAbierto(esNuevo)
      })
      .catch(() => {
        if (!activo) return
        setError(
          'No se pudo cargar el documento. Comprueba que el navegador permita usar el almacenamiento local y recarga la página.',
        )
      })

    return () => {
      activo = false
    }
  }, [])

  const cerrarChat = useCallback(() => {
    setChatAbierto(false)
    requestAnimationFrame(() => botonChatRef.current?.focus())
  }, [])

  const alternarChat = useCallback(() => {
    if (!chatAbierto) setEnfocarChatAlAbrir(true)
    setChatAbierto(!chatAbierto)
  }, [chatAbierto])

  const elegirTipoInicial = (tipo: TipoDocumentoId) => {
    setTipoDocumento(tipo)
    setDialogoInicialAbierto(false)
  }

  const omitirSeleccionInicial = () => {
    setTipoDocumento(TIPO_DOCUMENTO_POR_DEFECTO)
    setDialogoInicialAbierto(false)
  }

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-6">
        <p
          role="alert"
          className="max-w-md rounded-lg border border-line bg-surface p-6 text-center text-sm text-danger shadow-lg"
        >
          {error}
        </p>
      </main>
    )
  }

  if (!documento) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-6">
        <p aria-live="polite" className="text-sm text-muted">
          Cargando documento…
        </p>
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <EncabezadoApp
        tipoDocumento={tipoDocumento}
        onCambiarTipo={setTipoDocumento}
        chatAbierto={chatAbierto}
        onAlternarChat={alternarChat}
        botonChatRef={botonChatRef}
        temaResuelto={tema.temaResuelto}
        onCambiarTema={tema.cambiarPreferencia}
      />

      <div className="flex">
        <main className="min-w-0 flex-1">
          <EditorTexto
            documentoInicial={documento}
            tipoDocumento={tipoDocumento}
            resaltados={resaltados}
            onEditorListo={registrarEditor}
          />
        </main>

        {chatAbierto && (
          <ChatLateral
            mensajes={chat.mensajes}
            enviando={chat.enviando}
            enfocarAlAbrir={enfocarChatAlAbrir}
            onEnviar={(texto) => {
              void chat.enviar(texto)
            }}
            onCerrar={cerrarChat}
          />
        )}
      </div>

      <DialogoTipoDocumento
        abierto={dialogoInicialAbierto}
        onElegir={elegirTipoInicial}
        onOmitir={omitirSeleccionInicial}
      />
    </div>
  )
}

export default App
