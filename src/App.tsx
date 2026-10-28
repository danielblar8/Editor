import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatLateral } from './components/ChatLateral'
import { DialogoTipoDocumento } from './components/DialogoTipoDocumento'
import { EditorTexto } from './components/EditorTexto'
import { EncabezadoApp } from './components/EncabezadoApp'
import { useChatTutor } from './hooks/useChatTutor'
import { extraerParrafos, unirParrafos } from './lib/parrafos'
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

  const obtenerTexto = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return ''

    return unirParrafos(extraerParrafos(editor))
  }, [])

  const registrarEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const chat = useChatTutor(tipoDocumento, obtenerTexto)

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
      <main className="flex min-h-dvh items-center justify-center bg-slate-200 px-6">
        <p
          role="alert"
          className="max-w-md rounded-lg bg-white p-6 text-center text-sm text-red-700 shadow-lg"
        >
          {error}
        </p>
      </main>
    )
  }

  if (!documento) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-200 px-6">
        <p aria-live="polite" className="text-sm text-slate-600">
          Cargando documento…
        </p>
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-200/80">
      <EncabezadoApp
        tipoDocumento={tipoDocumento}
        onCambiarTipo={setTipoDocumento}
        chatAbierto={chatAbierto}
        onAlternarChat={alternarChat}
        botonChatRef={botonChatRef}
      />

      <div className="flex">
        <main className="min-w-0 flex-1">
          <EditorTexto
            documentoInicial={documento}
            tipoDocumento={tipoDocumento}
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
