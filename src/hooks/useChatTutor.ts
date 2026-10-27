import { useCallback, useEffect, useRef, useState } from 'react'
import type { MensajeChat } from '../lib/chat'
import {
  crearAvisoCambioTipo,
  crearMensajeBienvenida,
  crearMensajeDocumentoVacio,
  crearMensajeTutor,
  crearMensajeTextoLargo,
  crearMensajeUsuario,
  crearMensajesRevision,
  ErrorTutor,
  responderTutor,
} from '../lib/chat'
import { LIMITE_CARACTERES_TEXTO } from '../lib/revisionTipos'
import type { TipoDocumentoId } from '../lib/tiposDocumento'

/**
 * Estado del chat del tutor.
 *
 * El historial vive solo en memoria: no se guarda en localStorage. El texto
 * del documento se obtiene en el momento de enviar con `obtenerTexto`, de modo
 * que el hook nunca escribe en el editor.
 */
export function useChatTutor(
  tipoDocumento: TipoDocumentoId,
  obtenerTexto: () => string,
) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>(() => [
    crearMensajeBienvenida(tipoDocumento),
  ])
  const [enviando, setEnviando] = useState(false)
  const tipoAnteriorRef = useRef(tipoDocumento)
  const enviandoRef = useRef(false)

  useEffect(() => {
    if (tipoAnteriorRef.current === tipoDocumento) return

    tipoAnteriorRef.current = tipoDocumento

    setMensajes((anteriores) => {
      const soloBienvenida =
        anteriores.length === 1 && anteriores[0]?.variante === 'bienvenida'

      // Si el usuario aún no ha conversado (por ejemplo, acaba de elegir el
      // tipo en el diálogo inicial), se actualiza el saludo en lugar de
      // añadir un aviso que confunda.
      return soloBienvenida
        ? [crearMensajeBienvenida(tipoDocumento)]
        : [...anteriores, crearAvisoCambioTipo(tipoDocumento)]
    })
  }, [tipoDocumento])

  const enviar = useCallback(
    async (texto: string) => {
      const limpio = texto.trim()
      if (!limpio || enviandoRef.current) return

      enviandoRef.current = true
      setEnviando(true)
      setMensajes((anteriores) => [
        ...anteriores,
        crearMensajeUsuario(limpio),
      ])

      try {
        const documento = obtenerTexto().trim()

        if (!documento) {
          setMensajes((anteriores) => [
            ...anteriores,
            crearMensajeDocumentoVacio(),
          ])
          return
        }

        if (documento.length > LIMITE_CARACTERES_TEXTO) {
          setMensajes((anteriores) => [
            ...anteriores,
            crearMensajeTextoLargo(),
          ])
          return
        }

        const respuesta = await responderTutor({
          mensaje: limpio,
          tipoDocumento,
          texto: documento,
        })

        setMensajes((anteriores) => [
          ...anteriores,
          ...crearMensajesRevision(
            respuesta.seccion,
            respuesta.observaciones,
          ),
        ])
      } catch (error) {
        const mensaje =
          error instanceof ErrorTutor
            ? error.message
            : 'No se pudo obtener la revisión. Inténtalo de nuevo.'

        setMensajes((anteriores) => [
          ...anteriores,
          crearMensajeTutor(mensaje),
        ])
      } finally {
        enviandoRef.current = false
        setEnviando(false)
      }
    },
    [obtenerTexto, tipoDocumento],
  )

  return { mensajes, enviando, enviar }
}
