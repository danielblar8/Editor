import { useEffect, useState } from 'react'
import { EditorTexto } from './components/EditorTexto'
import type { DocumentoGuardado } from './lib/storage'
import { cargarDocumento } from './lib/storage'

function App() {
  const [documento, setDocumento] = useState<DocumentoGuardado | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    cargarDocumento()
      .then((cargado) => {
        if (activo) setDocumento(cargado)
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

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-200 px-6">
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
      <main className="flex min-h-screen items-center justify-center bg-slate-200 px-6">
        <p aria-live="polite" className="text-sm text-slate-600">
          Cargando documento…
        </p>
      </main>
    )
  }

  return <EditorTexto documentoInicial={documento} />
}

export default App
