function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <p className="text-sm font-medium tracking-widest text-slate-500 uppercase">
        Fase 0 · Preparación
      </p>
      <h1 className="text-3xl font-semibold text-slate-900">
        Editor de Texto Web con Tutor de IA
      </h1>
      <p className="max-w-xl text-slate-600">
        Proyecto base listo. El editor con TipTap llega en la Fase 1; el tutor
        de IA, en la Fase 3.
      </p>
      <p className="text-xs text-slate-400">
        Prueba de humo: <code className="font-mono">npm run smoke</code>
      </p>
    </main>
  )
}

export default App
