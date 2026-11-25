import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChatTutor } from '../hooks/useChatTutor'
import { ErrorApi, esErrorNoAutenticado } from '../lib/api'
import type { MensajeChat } from '../lib/chat'
import type { FocoObservacion } from '../lib/observaciones'
import {
  construirResaltados,
  obtenerIdUltimaRevision,
} from '../lib/observaciones'
import { extraerParrafosConId, unirParrafos } from '../lib/parrafos'
import type { DocumentoGuardado } from '../lib/storage'
import {
  cargarDocumento,
  renombrarDocumento,
} from '../lib/storage'
import type { PreferenciaTema, TemaResuelto } from '../lib/tema'
import type { TipoDocumentoId } from '../lib/tiposDocumento'
import { TIPO_DOCUMENTO_POR_DEFECTO } from '../lib/tiposDocumento'
import { ChatLateral } from './ChatLateral'
import { DialogoTipoDocumento } from './DialogoTipoDocumento'
import { EditorTexto } from './EditorTexto'
import { EncabezadoApp } from './EncabezadoApp'

type VistaEditorProps = {
  idDocumento: string
  esNuevo: boolean
  temaResuelto: TemaResuelto
  onCambiarTema: (preferencia: PreferenciaTema) => TemaResuelto
  onAbrirDocumentos: () => void
  onCerrarSesion: () => void | Promise<void>
  onSesionExpirada: () => void
}

/**
 * Vista del editor para un documento concreto.
 *
 * Se monta con una `key` por documento desde `App`: al cambiar de documento se
 * reinician el chat, los resaltados y la gramática sin compartir estado entre
 * documentos.
 */
export function VistaEditor({
  idDocumento,
  esNuevo,
  temaResuelto,
  onCambiarTema,
  onAbrirDocumentos,
  onCerrarSesion,
  onSesionExpirada,
}: VistaEditorProps) {
  const [documento, setDocumento] = useState<DocumentoGuardado | null>(null)
  const [titulo, setTitulo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoId>(
    TIPO_DOCUMENTO_POR_DEFECTO,
  )
  const [dialogoInicialAbierto, setDialogoInicialAbierto] = useState(false)
  const [chatAbierto, setChatAbierto] = useState(
    () => !window.matchMedia('(max-width: 1023px)').matches,
  )
  const [enfocarChatAlAbrir, setEnfocarChatAlAbrir] = useState(false)
  const [foco, setFoco] = useState<FocoObservacion | null>(null)
  const [revisionOculta, setRevisionOculta] = useState<string | null>(null)
  const [saliendo, setSaliendo] = useState(false)
  const [avisoGuardado, setAvisoGuardado] = useState<string | null>(null)
  const botonChatRef = useRef<HTMLButtonElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const guardarRef = useRef<(() => Promise<boolean>) | null>(null)
  const tituloEnCursoRef = useRef<Promise<void> | null>(null)
  const tituloFallidoRef = useRef(false)
  const secuenciaFocoRef = useRef(0)

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

  const registrarGuardado = useCallback(
    (guardar: (() => Promise<boolean>) | null) => {
      guardarRef.current = guardar
    },
    [],
  )

  const chat = useChatTutor(tipoDocumento, obtenerDocumento)
  const idRevisionActual = obtenerIdUltimaRevision(chat.mensajes)
  const resaltadosDeRevision = useMemo(
    () => construirResaltados(chat.mensajes),
    [chat.mensajes],
  )
  const resaltados = useMemo(
    () =>
      revisionOculta && revisionOculta === idRevisionActual
        ? []
        : resaltadosDeRevision,
    [idRevisionActual, resaltadosDeRevision, revisionOculta],
  )

  useEffect(() => {
    let activo = true

    cargarDocumento(idDocumento)
      .then(({ documento: cargado }) => {
        if (!activo) return

        setDocumento(cargado)
        setTipoDocumento(cargado.tipoDocumento)
        setTitulo(cargado.titulo)
        setDialogoInicialAbierto(esNuevo)
      })
      .catch((fallo: unknown) => {
        if (!activo) return

        if (esErrorNoAutenticado(fallo)) {
          onSesionExpirada()
          return
        }

        if (fallo instanceof ErrorApi && fallo.estado === 404) {
          setError('El documento no existe o se ha borrado.')
          return
        }

        setError(
          'No se pudo cargar el documento. Comprueba que el servidor esté en marcha e inténtalo de nuevo.',
        )
      })

    return () => {
      activo = false
    }
  }, [esNuevo, idDocumento, onSesionExpirada])

  const verEnTexto = useCallback((mensaje: MensajeChat) => {
    if (!mensaje.parrafoId || !mensaje.idRevision) return

    secuenciaFocoRef.current += 1
    setFoco({
      parrafoId: mensaje.parrafoId,
      idRevision: mensaje.idRevision,
      origen: 'chat',
      secuencia: secuenciaFocoRef.current,
    })
  }, [])

  const senalarDesdeEditor = useCallback(
    (parrafoId: string) => {
      if (!idRevisionActual) return

      secuenciaFocoRef.current += 1
      setFoco({
        parrafoId,
        idRevision: idRevisionActual,
        origen: 'editor',
        secuencia: secuenciaFocoRef.current,
      })
    },
    [idRevisionActual],
  )

  const quitarResaltados = useCallback(() => {
    if (idRevisionActual) setRevisionOculta(idRevisionActual)
    setFoco(null)
  }, [idRevisionActual])

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

  const limpiarFalloTitulo = useCallback(() => {
    // Escape descarta la edición: vuelve al último título guardado, así que ya
    // no hay cambios que bloqueen la salida.
    tituloFallidoRef.current = false
  }, [])

  const guardarTitulo = useCallback(
    async (nuevo: string) => {
      if (!documento) return

      tituloFallidoRef.current = false
      const peticion = (async () => {
        const actualizado = await renombrarDocumento(documento.id, nuevo)
        setTitulo(actualizado.titulo)
      })()

      tituloEnCursoRef.current = peticion

      try {
        await peticion
      } catch (fallo) {
        tituloFallidoRef.current = true
        if (esErrorNoAutenticado(fallo)) onSesionExpirada()
        throw fallo
      } finally {
        if (tituloEnCursoRef.current === peticion) {
          tituloEnCursoRef.current = null
        }
      }
    },
    [documento, onSesionExpirada],
  )

  /**
   * Espera al guardado de contenido y al de título que ya estén en curso.
   * Devuelve `false` si alguno falla para que la navegación no pierda cambios.
   */
  const guardarAntesDeSalir = useCallback(async (): Promise<boolean> => {
    const guardar = guardarRef.current
    const titulo = tituloEnCursoRef.current

    const [contenidoOk, tituloOk] = await Promise.all([
      guardar ? guardar() : Promise.resolve(true),
      titulo
        ? titulo.then(
            () => true,
            () => false,
          )
        : Promise.resolve(true),
    ])

    return contenidoOk && tituloOk && !tituloFallidoRef.current
  }, [])

  const volverADocumentos = useCallback(async () => {
    setSaliendo(true)
    setAvisoGuardado(null)

    const guardadoOk = await guardarAntesDeSalir()
    setSaliendo(false)

    if (!guardadoOk) {
      setAvisoGuardado(
        'No se pudo guardar el documento. Revisa la conexión e inténtalo de nuevo. No se cambió de documento.',
      )
      return
    }

    onAbrirDocumentos()
  }, [guardarAntesDeSalir, onAbrirDocumentos])

  const cerrarSesion = useCallback(async () => {
    setSaliendo(true)
    setAvisoGuardado(null)

    const guardadoOk = await guardarAntesDeSalir()
    setSaliendo(false)

    if (!guardadoOk) {
      setAvisoGuardado(
        'No se pudo guardar el documento. Revisa la conexión e inténtalo de nuevo. No se cerró la sesión.',
      )
      return
    }

    await onCerrarSesion()
  }, [guardarAntesDeSalir, onCerrarSesion])

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-6">
        <div className="max-w-md rounded-lg border border-line bg-surface p-6 text-center shadow-lg">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={onAbrirDocumentos}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-medium text-muted transition-colors hover:border-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Volver a mis documentos
          </button>
        </div>
      </main>
    )
  }

  if (!documento) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6">
        <p aria-live="polite" className="text-sm text-muted">
          Cargando documento…
        </p>
        <button
          type="button"
          onClick={onAbrirDocumentos}
          className="inline-flex h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-medium text-muted transition-colors hover:border-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Volver a mis documentos
        </button>
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
        temaResuelto={temaResuelto}
        onCambiarTema={onCambiarTema}
        ocupado={saliendo}
        onAbrirDocumentos={() => {
          void volverADocumentos()
        }}
        onCerrarSesion={() => {
          void cerrarSesion()
        }}
      />

      {avisoGuardado && (
        <div
          role="alert"
          className="border-b border-line bg-surface-muted px-3 py-2 text-center text-sm font-medium text-danger sm:px-4"
        >
          {avisoGuardado}
        </div>
      )}

      <div className="flex">
        <main className="min-w-0 flex-1">
          <EditorTexto
            documentoInicial={documento}
            titulo={titulo}
            onGuardarTitulo={guardarTitulo}
            onCancelarTitulo={limpiarFalloTitulo}
            tipoDocumento={tipoDocumento}
            resaltados={resaltados}
            foco={foco}
            idRevisionActual={idRevisionActual}
            onParrafoResaltadoClic={senalarDesdeEditor}
            onQuitarResaltados={quitarResaltados}
            onEditorListo={registrarEditor}
            onGuardarListo={registrarGuardado}
          />
        </main>

        {chatAbierto && (
          <ChatLateral
            mensajes={chat.mensajes}
            enviando={chat.enviando}
            enfocarAlAbrir={enfocarChatAlAbrir}
            foco={foco}
            idRevisionActual={idRevisionActual}
            resaltados={resaltados}
            onEnviar={(texto) => {
              void chat.enviar(texto)
            }}
            onVerEnTexto={verEnTexto}
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
