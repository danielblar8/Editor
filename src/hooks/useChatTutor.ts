import { useCallback, useEffect, useRef, useState } from 'react'
import type { MensajeChat } from '../lib/chat'
import {
  crearAvisoCambioTipo,
  crearMensajeBienvenida,
  crearMensajeTutor,
  crearMensajeUsuario,
  responderTutorSimulado,
} from '../lib/chat'
import type { TipoDocumentoId } from '../lib/tiposDocumento'

/**
 * Estado del chat del tutor.
 *
 * El historial vive solo en memoria: no se guarda en localStorage. Cuando la
 * Fase 3 añada el backend, solo hay que cambiar la llamada a
 * `responderTutorSimulado`; la interfaz seguirá usando este mismo hook.
 */
export function useChatTutor(tipoDocumento: TipoDocumentoId) {
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
        const respuesta = await responderTutorSimulado({
          mensaje: limpio,
          tipoDocumento,
        })

        setMensajes((anteriores) => [
          ...anteriores,
          crearMensajeTutor(respuesta),
        ])
      } catch {
        setMensajes((anteriores) => [
          ...anteriores,
          crearMensajeTutor(
            'No se pudo obtener respuesta del tutor. Inténtalo de nuevo.',
          ),
        ])
      } finally {
        enviandoRef.current = false
        setEnviando(false)
      }
    },
    [tipoDocumento],
  )

  return { mensajes, enviando, enviar }
}
