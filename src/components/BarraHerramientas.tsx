import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import {
  aplicarFuente,
  aplicarTamano,
  leerAtributoTextStyle,
  OPCIONES_FUENTE,
  OPCIONES_TAMANO,
} from '../lib/formatosTexto'
import {
  BotonBarra,
  Icono,
  SelectorBarra,
  Separador,
} from './barra/Controles'

type BarraHerramientasProps = {
  editor: Editor
}

export function BarraHerramientas({ editor }: BarraHerramientasProps) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: editorActual }) => {
      const alineacion = editorActual.isActive({ textAlign: 'center' })
        ? 'center'
        : editorActual.isActive({ textAlign: 'right' })
          ? 'right'
          : editorActual.isActive({ textAlign: 'justify' })
            ? 'justify'
            : 'left'

      return {
        negrita: editorActual.isActive('bold'),
        cursiva: editorActual.isActive('italic'),
        subrayado: editorActual.isActive('underline'),
        tachado: editorActual.isActive('strike'),
        subindice: editorActual.isActive('subscript'),
        superindice: editorActual.isActive('superscript'),
        fuente: leerAtributoTextStyle(editorActual, 'fontFamily'),
        tamano: leerAtributoTextStyle(editorActual, 'fontSize'),
        alineacion,
        cita: editorActual.isActive('blockquote'),
        titulo1: editorActual.isActive('heading', { level: 1 }),
        titulo2: editorActual.isActive('heading', { level: 2 }),
        titulo3: editorActual.isActive('heading', { level: 3 }),
        listaVinietas: editorActual.isActive('bulletList'),
        listaNumerada: editorActual.isActive('orderedList'),
        puedeDeshacer: editorActual.can().undo(),
        puedeRehacer: editorActual.can().redo(),
      }
    },
  })

  return (
    <div
      role="toolbar"
      aria-label="Formato del texto"
      className="mx-auto flex w-full max-w-[960px] flex-wrap items-center gap-1 px-3 py-2 sm:px-4"
    >
      <SelectorBarra
        etiqueta="Tipo de letra"
        valor={estado.fuente}
        opciones={OPCIONES_FUENTE}
        onChange={(valor) => aplicarFuente(editor, valor)}
      />

      <SelectorBarra
        etiqueta="Tamaño de letra"
        valor={estado.tamano}
        opciones={OPCIONES_TAMANO}
        onChange={(valor) => aplicarTamano(editor, valor)}
      />

      <Separador />

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

      <BotonBarra
        etiqueta="Tachado"
        activo={estado.tachado}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Icono>
          <path d="M4 12h16" />
          <path d="M7 8a4 4 0 0 1 4-3h2a4 4 0 0 1 3.5 2" />
          <path d="M6.5 16A4 4 0 0 0 10 19h3a4 4 0 0 0 3.6-2.3" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Subíndice"
        atajo="Ctrl+,"
        activo={estado.subindice}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      >
        <span aria-hidden="true" className="text-xs font-semibold">
          x₂
        </span>
      </BotonBarra>

      <BotonBarra
        etiqueta="Superíndice"
        atajo="Ctrl+."
        activo={estado.superindice}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      >
        <span aria-hidden="true" className="text-xs font-semibold">
          x²
        </span>
      </BotonBarra>

      <BotonBarra
        etiqueta="Limpiar formato"
        onClick={() => editor.chain().focus().unsetAllMarks().unsetTextAlign().run()}
      >
        <Icono>
          <path d="m4 20 4.5-4.5" />
          <path d="M13.5 5.5 18.5 10.5 9 20H4v-5z" />
          <path d="m11 8 5 5" />
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
        etiqueta="Alinear a la izquierda"
        atajo="Ctrl+Mayús+L"
        activo={estado.alineacion === 'left'}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <Icono>
          <path d="M4 6h16" />
          <path d="M4 10h10" />
          <path d="M4 14h16" />
          <path d="M4 18h10" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Centrar"
        atajo="Ctrl+Mayús+E"
        activo={estado.alineacion === 'center'}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <Icono>
          <path d="M4 6h16" />
          <path d="M7 10h10" />
          <path d="M4 14h16" />
          <path d="M7 18h10" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Alinear a la derecha"
        atajo="Ctrl+Mayús+R"
        activo={estado.alineacion === 'right'}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <Icono>
          <path d="M4 6h16" />
          <path d="M10 10h10" />
          <path d="M4 14h16" />
          <path d="M10 18h10" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Justificar"
        atajo="Ctrl+Mayús+J"
        activo={estado.alineacion === 'justify'}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
      >
        <Icono>
          <path d="M4 6h16" />
          <path d="M4 10h16" />
          <path d="M4 14h16" />
          <path d="M4 18h16" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Cita"
        activo={estado.cita}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Icono>
          <path d="M7 7h4v4H7a3 3 0 0 1 0-6z" />
          <path d="M15 7h4v4h-4a3 3 0 0 1 0-6z" />
          <path d="M7 11c0 4-2 6-4 7" />
          <path d="M15 11c0 4-2 6-4 7" />
        </Icono>
      </BotonBarra>

      <BotonBarra
        etiqueta="Línea horizontal"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Icono>
          <path d="M4 12h5" />
          <path d="M13 12h7" />
          <path d="M11 9v6" />
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
