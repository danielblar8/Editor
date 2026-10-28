import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import type { ReactNode } from 'react'

type BarraHerramientasProps = {
  editor: Editor
}

type BotonBarraProps = {
  etiqueta: string
  atajo?: string
  activo?: boolean
  deshabilitado?: boolean
  onClick: () => void
  children: ReactNode
}

function BotonBarra({
  etiqueta,
  atajo,
  activo,
  deshabilitado = false,
  onClick,
  children,
}: BotonBarraProps) {
  const titulo = atajo ? `${etiqueta} (${atajo})` : etiqueta

  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      disabled={deshabilitado}
      onClick={onClick}
      className={[
        'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
        'disabled:pointer-events-none disabled:opacity-40',
        activo
          ? 'bg-slate-900 text-white shadow-sm'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Separador() {
  return (
    <span
      className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:block"
      aria-hidden="true"
    />
  )
}

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function BarraHerramientas({ editor }: BarraHerramientasProps) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: editorActual }) => ({
      negrita: editorActual.isActive('bold'),
      cursiva: editorActual.isActive('italic'),
      subrayado: editorActual.isActive('underline'),
      titulo1: editorActual.isActive('heading', { level: 1 }),
      titulo2: editorActual.isActive('heading', { level: 2 }),
      titulo3: editorActual.isActive('heading', { level: 3 }),
      listaVinietas: editorActual.isActive('bulletList'),
      listaNumerada: editorActual.isActive('orderedList'),
      puedeDeshacer: editorActual.can().undo(),
      puedeRehacer: editorActual.can().redo(),
    }),
  })

  return (
    <div
      role="toolbar"
      aria-label="Formato del texto"
      className="mx-auto flex w-full max-w-[960px] flex-wrap items-center gap-1 px-3 py-2 sm:px-4"
    >
      <BotonBarra
        etiqueta="Negrita"
        atajo="Ctrl+B"
        activo={estado.negrita}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Icono>
          <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Cursiva"
        atajo="Ctrl+I"
        activo={estado.cursiva}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Icono>
          <path d="M19 4h-9" />
          <path d="M14 20H5" />
          <path d="M15 4 9 20" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Subrayado"
        atajo="Ctrl+U"
        activo={estado.subrayado}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Icono>
          <path d="M6 4v6a6 6 0 0 0 12 0V4" />
          <path d="M4 20h16" />
        </Icono>
      </BotonBarra>

      <Separador />

      <BotonBarra
        etiqueta="Título 1"
        activo={estado.titulo1}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
      >
        <span className="text-[0.7rem] font-semibold tracking-tight">H1</span>
      </BotonBarra>

      <BotonBarra
        etiqueta="Título 2"
        activo={estado.titulo2}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <span className="text-[0.7rem] font-semibold tracking-tight">H2</span>
      </BotonBarra>

      <BotonBarra
        etiqueta="Título 3"
        activo={estado.titulo3}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        <span className="text-[0.7rem] font-semibold tracking-tight">H3</span>
      </BotonBarra>

      <Separador />

      <BotonBarra
        etiqueta="Lista con viñetas"
        activo={estado.listaVinietas}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <Icono>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Lista numerada"
        activo={estado.listaNumerada}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <Icono>
          <path d="M10 6h11" />
          <path d="M10 12h11" />
          <path d="M10 18h11" />
          <path d="M4 6h1v4" />
          <path d="M4 10h2" />
          <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
        </Icono>
      </BotonBarra>

      <Separador />

      <BotonBarra
        etiqueta="Deshacer"
        atajo="Ctrl+Z"
        deshabilitado={!estado.puedeDeshacer}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Icono>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Rehacer"
        atajo="Ctrl+Mayús+Z"
        deshabilitado={!estado.puedeRehacer}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Icono>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </Icono>
      </BotonBarra>
    </div>
  )
}
