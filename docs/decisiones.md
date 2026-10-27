# Decisiones técnicas

Registro de decisiones por fase. Cada entrada explica qué se eligió, por qué y
qué límites tiene.

## Fase 0 — Preparación (2026-10-26)

### Versiones y herramientas

- **Vite 8.3.5 + React 19.3.1 + TypeScript 6.0.3**, generados con
  `create-vite` (plantilla `react-ts`). Se mantiene Oxlint como linter porque
  viene incluido en la plantilla; no se añadió ESLint.
- **Tailwind CSS 4.3.3** con el plugin oficial `@tailwindcss/vite`. Se eligió
  la v4 porque no requiere `tailwind.config.js` ni PostCSS: la configuración
  vive en el CSS (`@import 'tailwindcss'`) y reduce archivos y dependencias.
- **npm 11.9.0** con `package-lock.json` versionado, para que las
  instalaciones sean reproducibles en Vercel.
- **ai 7.0.154** y **@ai-sdk/google 4.0.106**, fijados con `^`. En ai v7 la
  generación estructurada se hace con `generateText({ output: Output.array() })`;
  `generateObject` quedó obsoleto. Zod 4.6.7 es la versión soportada por el
  proveedor.

### Variables de entorno

- `GEMINI_API_KEY` y `GEMINI_MODEL` viven solo en `.env` (no versionado).
  `.env.example` documenta ambas claves.
- Deliberadamente **sin prefijo `VITE_`**: Vite solo expone al navegador las
  variables con ese prefijo, así que esta clave no puede filtrarse al bundle
  del cliente por accidente.
- `GEMINI_MODEL` es obligatorio y se lee del entorno; no hay valor por defecto
  en el código (regla 11 de `AGENTS.md`). El valor actual es `gemini-3.8-flash`.

### Prueba de humo

- El script vive en `scripts/smoke-gemini.ts` y se ejecuta con `tsx`
  (`npm run smoke`). No se importa desde `src/`, así que no forma parte del
  bundle ni del frontend: es una herramienta local de verificación.
- El ensayo de prueba (`scripts/fixtures/ensayo-prueba.txt`) es ficticio, de
  437 palabras, y contiene defectos deliberados: la introducción promete
  analizar el papel de las familias y la brecha de acceso a dispositivos, pero
  nunca los retoma; el desarrollo es un único párrafo corto; la conclusión
  introduce temas nuevos (capacitación docente, deserción escolar, costo del
  papel, evaluación).
- La salida se pide como array de observaciones con el esquema base de
  `AGENTS.md`: `{ parrafo_id, tipo_problema, observacion, pregunta_guia }`.
  `tipo_problema` es un enum cerrado. No existe ningún campo de texto
  sugerido ni de reescritura.
- **Errores separados** con códigos de salida distintos:
  - `1` validación (la respuesta no cumple el esquema Zod),
  - `2` API (red, clave inválida, cuota 429, modelo inexistente),
  - `3` configuración (falta una variable o el archivo).
  La validación se aplica dos veces: la hace el SDK y el script repite
  `safeParse` antes de imprimir, para no mostrar datos inválidos nunca.

### Límites conocidos

- No hay backend todavía: el script es la única pieza que habla con Gemini.
  El endpoint real llega en la Fase 3 y el frontend nunca llamará a Gemini
  directamente (regla 10).
- La capa gratuita de Gemini tiene cuota por minuto; el script traduce el 429
  a un mensaje claro pero no reintenta con espera.
- Sin commit de cierre de fase: queda pendiente de revisión manual.

## Fase 1 — Editor base con TipTap (2026-10-26)

### Versiones y paquetes

- Se instalaron versiones **exactas** de TipTap, sin `^`:
  `@tiptap/react@3.32.0`, `@tiptap/pm@3.32.0`,
  `@tiptap/starter-kit@3.32.0` y `@tiptap/core@3.32.0`. La decisión de fijar
  la versión se debe a que los paquetes de TipTap comparten dependencias
  internas con versión exacta; dejar rangos podría desalinearlas en una
  instalación futura.
- **No se instaló `@tiptap/extension-underline` por separado.** Se verificó
  dentro del paquete instalado (`node_modules/@tiptap/starter-kit`) que
  StarterKit 3.32.0 depende de `@tiptap/extension-underline@3.32.0` y la
  registra en su código (`if (this.options.underline !== false)
  extensions.push(Underline...)`). Instalarla aparte habría duplicado una
  extensión ya incluida.
- `@tiptap/core` se declara explícitamente porque `src/lib/storage.ts` importa
  el tipo `JSONContent` para tipar el documento persistido. Es una importación
  solo de tipos: no añade código al runtime.
- StarterKit también incluye `UndoRedo` (deshacer/rehacer) y `ListKeymap`.
  Solo se configuró `heading.levels` a `[1, 2, 3]`. Otras extensiones que trae
  el paquete (tachado, código, citas, enlaces) permanecen disponibles para
  pegar contenido, pero no tienen botones en esta fase.

### Formato del documento y almacenamiento

- El documento se guarda como **JSON de TipTap**, nunca como HTML ni texto
  plano. La forma persistida es:
  `{ id, version: 1, contenido: JSONContent, actualizadoEn }`.
- El campo `version` permite migrar el formato en el futuro. Todavía no hay
  migraciones: un documento con versión distinta o corrupto se descarta y se
  crea una hoja vacía; el registro antiguo no se borra automáticamente.
- El ID se genera con `crypto.randomUUID()` la primera vez y se conserva en
  localStorage. No está fijo en el código ni depende de una variable de
  entorno. En esta fase solo existe un documento, pero el registro ya incluye
  su ID.
- `src/lib/storage.ts` es el único módulo que toca `localStorage`. Usa las
  claves `editor-tutor-ia:documento-actual` y
  `editor-tutor-ia:documento:<id>`. El puntero al documento actual se escribe
  después del documento, para no dejarlo apuntando a un registro inexistente.
- `guardarDocumento` y `cargarDocumento` tienen firma **asíncrona** aunque
  localStorage sea síncrono. Es el punto de sustitución previsto para
  IndexedDB o una base de datos sin cambiar los componentes. `cargarDocumento`
  crea y persiste una hoja vacía si no existe, de forma idempotente.
- La carga ocurre antes de montar el editor. Así el JSON inicial se pasa como
  `content` y no se necesita un `setContent` posterior que pueda disparar
  actualizaciones o perder la selección.

### Editor, barra y estilos

- La barra se construye con botones nativos, etiquetas y tooltips en español
  (`title` y `aria-label`), más `aria-pressed` para las marcas y los formatos
  de bloque. Los iconos son SVG inline; no se añadió una librería de iconos.
- El estado activo y la disponibilidad de deshacer/rehacer se leen con
  `useEditorState` de `@tiptap/react`. Esto mantiene la barra sincronizada con
  los cambios de selección sin re-renderizar todo el editor por transacción.
- Los estilos del contenido se definen en `src/index.css` con `@apply` de
  Tailwind, acotados a `.contenido-editor`. No se instaló
  `@tailwindcss/typography`: así se controlan tamaños, márgenes y listas sin
  añadir otra dependencia. La hoja usa tipografía serif; la interfaz, sans.
- La hoja simula una página de 816 px de ancho, con fondo gris, márgenes
  amplios, sombra y un pie con el estado de guardado y el contador de palabras.

### Guardado automático

- Cada actualización del documento programa un guardado con debounce de
  **1000 ms**. Al escribir se muestra «Guardando…»; al completar, «Guardado»;
  si falla, «No se pudo guardar».
- Un contador de versión interna evita marcar como guardado un cambio que ya
  fue superado por otra edición mientras la escritura estaba en curso.
- Se escucha `pagehide` para intentar vaciar el guardado pendiente al recargar
  o cerrar la pestaña. Hoy funciona porque localStorage escribe de forma
  síncrona; si en el futuro se usa una base de datos, hará falta otra
  estrategia de vaciado.
- El contador usa `editor.getText({ blockSeparator: ' ' })` y una función pura
  que separa por espacios y descarta fragmentos sin letras ni números. No
  cuenta caracteres ni aplica reglas editoriales especiales.

### Ortografía

- El área editable se configura con `spellcheck="true"` y `lang="es"` en los
  atributos de ProseMirror. `index.html` ya tenía `lang="es"`.
- La corrección es la nativa del navegador: depende de que el usuario tenga
  instalado el diccionario español. La app no envía texto a ningún servicio.

### Variables de entorno y alcance

- No se añadieron variables de entorno: en esta fase no hay claves ni URLs de
  frontend. El ID es de ejecución y el retraso del guardado es una constante
  de comportamiento, no configuración sensible. `.env` y `.env.example` no
  cambiaron.
- Quedan fuera de esta fase el chat, el selector de tipo de documento,
  LanguageTool, los IDs por párrafo, el backend y cualquier llamada a IA.

### Verificación realizada

- `npm run typecheck`, `npm run lint` y `npm run build` terminan sin errores.
- Se probó la app en Edge headless: atributos `spellcheck`/`lang`, formato de
  negrita, cursiva, subrayado, H1/H2/H3, listas, estados activos, contador,
  autoguardado, estructura JSON persistida y recuperación del mismo ID tras
  recargar.
- La build avisa de un chunk de ~628 kB (197 kB gzip) por el peso de TipTap.
  No se aborda el code splitting en esta fase; queda para el pulido de Fase 7.

### Límites conocidos de la Fase 1

- Solo hay un documento y una pestaña. No hay resolución de conflictos entre
  pestañas ni sincronización entre dispositivos.
- localStorage tiene la cuota habitual del navegador y puede fallar si el
  usuario lo bloquea; en ese caso la app muestra un error de carga.
- La corrección ortográfica depende del diccionario del navegador.
- No hay suite de pruebas automatizada en el repositorio; la verificación
  funcional se hizo con un script temporal fuera del proyecto. La Fase 7
  cubrirá las pruebas y el pulido.
- Sin commit de cierre de fase: queda pendiente de revisión manual.
