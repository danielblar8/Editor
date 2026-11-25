import { useCallback, useState } from 'react'
import { PantallaCuenta } from './components/PantallaCuenta'
import { PantallaDocumentos } from './components/PantallaDocumentos'
import { VistaEditor } from './components/VistaEditor'
import { useSesion } from './hooks/useSesion'
import { useTema } from './hooks/useTema'
import type {
  PeticionLogin,
  PeticionRegistro,
} from './lib/cuentasTipos'

type DocumentoAbierto = {
  id: string
  esNuevo: boolean
}

function App() {
  const tema = useTema()
  const {
    usuario,
    cargando,
    errorSesion,
    iniciarSesion,
    registrarse,
    cerrarSesion,
    marcarSesionExpirada,
    limpiarError,
  } = useSesion()
  const [documentoAbierto, setDocumentoAbierto] =
    useState<DocumentoAbierto | null>(null)

  const abrirDocumento = useCallback((id: string, esNuevo: boolean) => {
    setDocumentoAbierto({ id, esNuevo })
  }, [])

  const volverADocumentos = useCallback(() => {
    setDocumentoAbierto(null)
  }, [])

  const manejarInicioSesion = useCallback(
    async (datos: PeticionLogin) => {
      setDocumentoAbierto(null)
      await iniciarSesion(datos)
    },
    [iniciarSesion],
  )

  const manejarRegistro = useCallback(
    async (datos: PeticionRegistro) => {
      setDocumentoAbierto(null)
      await registrarse(datos)
    },
    [registrarse],
  )

  const manejarSesionExpirada = useCallback(() => {
    setDocumentoAbierto(null)
    marcarSesionExpirada()
  }, [marcarSesionExpirada])

  if (cargando) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-6">
        <p aria-live="polite" className="text-sm text-muted">
          Comprobando sesión…
        </p>
      </main>
    )
  }

  if (!usuario) {
    return (
      <PantallaCuenta
        onIniciarSesion={manejarInicioSesion}
        onRegistrarse={manejarRegistro}
        onLimpiarErrorSesion={limpiarError}
        errorSesion={errorSesion}
        temaResuelto={tema.temaResuelto}
        onCambiarTema={tema.cambiarPreferencia}
      />
    )
  }

  if (documentoAbierto) {
    return (
      <VistaEditor
        key={documentoAbierto.id}
        idDocumento={documentoAbierto.id}
        esNuevo={documentoAbierto.esNuevo}
        temaResuelto={tema.temaResuelto}
        onCambiarTema={tema.cambiarPreferencia}
        onAbrirDocumentos={volverADocumentos}
        onCerrarSesion={cerrarSesion}
        onSesionExpirada={manejarSesionExpirada}
      />
    )
  }

  return (
    <PantallaDocumentos
      usuario={usuario}
      temaResuelto={tema.temaResuelto}
      onCambiarTema={tema.cambiarPreferencia}
      onCerrarSesion={cerrarSesion}
      onAbrirDocumento={abrirDocumento}
      onSesionExpirada={manejarSesionExpirada}
    />
  )
}

export default App
