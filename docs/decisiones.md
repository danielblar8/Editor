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

## Fase 2 — Layout con chat y tipo de documento (2026-10-27)

### Formato v2 y migración

- El documento guardado pasa a
  `{ id, version: 2, tipoDocumento, contenido, actualizadoEn }`. Las claves de
  localStorage no cambian, así que los documentos de la Fase 1 se leen sin
  pasos manuales.
- La migración es de lectura: un registro `version: 1` se acepta, recibe
  `tipoDocumento: 'texto-abierto'` y se reescribe como v2 conservando el mismo
  ID y `actualizadoEn`. Un v2 con un tipo desconocido cae al valor por defecto.
  Las versiones no reconocidas siguen descartándose.
- `cargarDocumento` devuelve ahora `{ documento, esNuevo }`. `esNuevo` solo es
  `true` cuando no había ningún documento y se acaba de crear; un documento
  migrado no dispara la elección inicial.
- La promesa de carga se memoiza durante la sesión. React StrictMode ejecuta
  los efectos dos veces en desarrollo: sin la caché, la segunda llamada
  encontraría el documento creado por la primera y respondería
  `esNuevo: false`, ocultando el diálogo inicial. Si la carga falla, la promesa
  se descarta para permitir reintentar.
- El tipo de documento se persiste desde `EditorTexto`, que es quien tiene el
  JSON actual de TipTap. Al cambiarlo, se actualiza la referencia interna y se
  fuerza un guardado inmediato, sin esperar al debounce del contenido. `App`
  mantiene el tipo como estado de interfaz para el selector y el chat, pero no
  duplica el contenido: así ningún guardado puede escribir un JSON atrasado.

### Catálogo de tipos

- `src/lib/tiposDocumento.ts` es la única fuente de identificadores, nombres
  visibles y descripciones. De ahí salen el selector, el diálogo inicial, el
  chat y la validación del almacenamiento. En la Fase 3 se reutilizará para
  elegir el prompt base.
- IDs: `ensayo-argumentativo`, `reporte-investigacion` y `texto-abierto`. El
  valor por defecto es `texto-abierto`.
- El selector es un `<select>` nativo: mantiene el comportamiento del sistema,
  es accesible con teclado y ocupa poco en la cabecera. La etiqueta visible se
  oculta en pantallas estrechas, pero el control conserva `aria-label`.

### Elección inicial

- El diálogo se muestra solo cuando `esNuevo` es `true`. Usa el elemento nativo
  `<dialog>` con `showModal()`, lo que aporta foco atrapado, cierre con Escape y
  restauración del foco sin librerías.
- Las tres tarjetas eligen directamente; «Omitir: seguir con Texto Abierto» y
  Escape dejan el tipo por defecto.
- El documento nuevo ya se guarda al crearse con Texto Abierto. Si el usuario
  recarga mientras el diálogo sigue abierto, ya existe un documento y el
  diálogo no vuelve a aparecer; el selector superior sigue disponible. Se
  acepta como límite de esta fase.

### Chat sin IA

- `src/lib/chat.ts` contiene el modelo de mensaje, las fábricas de bienvenida y
  aviso, y `responderTutorSimulado()`. Esta última es una promesa sin red ni
  IA: en la Fase 3 se sustituirá por la llamada al backend sin tocar la
  interfaz.
- `src/hooks/useChatTutor.ts` mantiene los mensajes, el estado `enviando` y el
  cambio de tipo. El historial vive solo en memoria y se pierde al recargar.
- `src/components/ChatLateral.tsx` es presentacional: no conoce Gemini, el
  backend ni localStorage.
- Si el usuario cambia el tipo antes de conversar (por ejemplo, al elegir en el
  diálogo inicial), se reemplaza el mensaje de bienvenida; si ya hay
  conversación, se añade un aviso con el nuevo tipo. Así no queda una
  bienvenida que mencione un tipo distinto al seleccionado.
- La respuesta simulada menciona siempre el tipo actual: «Todavía no estoy
  conectado a la IA. Revisaré tu documento («…») en la Fase 3.»
- Las sugerencias «Revisa mi introducción» y «¿Hay huecos en mi argumento?» se
  envían como mensajes del usuario y conservan el foco en el campo.
- `Enter` envía y `Mayús+Enter` inserta un salto de línea. Se respeta
  `isComposing` para no interferir con teclados IME. El auto-scroll respeta
  `prefers-reduced-motion`.
- Un guard `enviandoRef` evita dobles envíos. Si la respuesta fallara, se
  muestra un mensaje neutro en el chat; no hay estados de carga ni de error de
  red porque todavía no hay red.

### Layout y accesibilidad

- Cabecera superior sticky con título, selector y botón de chat
  (`aria-expanded` + `aria-controls`). La barra de formato queda sticky justo
  debajo, a `3.5rem`.
- En escritorio el chat es una columna lateral de 22–24 rem, con altura de
  viewport y scroll interno propio.
- En pantallas menores de 1024 px el chat es un panel deslizable desde la
  derecha, con fondo oscurecido, `role="dialog"`, `aria-modal`, bloqueo del
  scroll de la página, foco atrapado dentro del panel y cierre con Escape,
  botón o fondo.
- Por defecto el chat está abierto en escritorio y cerrado en móvil, para no
  cubrir el editor al entrar.
- Al abrir o reabrir el chat el foco va al campo de texto; al cerrarlo vuelve
  al botón de la cabecera que lo abrió.
- La lista de mensajes usa `role="log"`, `aria-live="polite"` y una etiqueta
  por autor. Los botones y el campo tienen etiquetas en español.

### Alcance, dependencias y verificación

- No se añadieron dependencias, variables de entorno ni backend. El frontend
  sigue sin llamar a Gemini.
- `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores.
- Se verificaron en Edge headless 43 comprobaciones: diálogo inicial, elección
  y omisión, persistencia del tipo, migración v1→v2, bienvenida, envío con
  Enter, Mayús+Enter, sugerencias, aviso de cambio de tipo, colapso y reapertura,
  historial en memoria, autoguardado existente, panel móvil, foco, Escape,
  fondo y restauración del foco.

### Límites conocidos de la Fase 2

- El tutor responde con un texto fijo; no hay IA ni backend (Fase 3).
- El historial del chat no se guarda y desaparece al recargar.
- Solo existe un documento.
- El diálogo inicial no se repite tras una recarga, aunque se haya omitido.
- La migración cubre únicamente v1→v2.
- Sin commit de cierre de fase: queda pendiente de revisión manual.

## Fase 3: agente tutor conectado a Gemini

### Alcance de los pasos 4 y 5

- El chat deja de usar respuestas simuladas y llama a `POST /api/revisar`.
- El tutor solo diagnostica estructura y coherencia. No reescribe, no propone
  texto nuevo y no corrige ortografía.
- Cada observación mantiene el contrato acordado: `parrafo_id`,
  `tipo_problema`, `observacion` y `pregunta_guia`.
- Quedan fuera de esta fase el mapa del documento, la verificación cruzada, las
  métricas calculadas, LanguageTool, el resaltado en el editor, los IDs
  persistidos, la caché y el historial del chat.

### Backend y contrato

- `server/` contiene el backend con Hono. `api/` se reserva para el adaptador
  de Vercel en la Fase 8.
- `npm run dev` levanta Vite en el puerto 5173 y la API en el 3001 con
  `concurrently`. Vite proxya `/api` al backend, así que el cliente siempre usa
  rutas relativas y no conoce la URL del servidor.
- `src/lib/revisionTipos.ts` es el contrato compartido: tipos de problema,
  secciones, etiquetas en español, límite de 12.000 caracteres y
  `detectarSeccion()`.
- `server/esquema.ts` valida con Zod la petición y la salida del modelo. La
  validación de la petición es estricta; la de las observaciones se aplica
  también a la respuesta de Gemini mediante `Output.array`.
- La API key y el modelo se leen solo en el servidor desde `GEMINI_API_KEY` y
  `GEMINI_MODEL`. Si falta cualquiera de las dos, la API responde con
  `configuracion` y un mensaje que indica qué revisar.
- `GET /api/salud` devuelve `{ ok: true, mensaje: "hola" }` para comprobar que
  el backend está en marcha.

### Prompts por tipo de documento

- `server/prompts.ts` construye el prompt y no se envía desde el cliente. Así
  las reglas no dependen de lo que llegue en la petición.
- Hay una base común: actuar como tutor, no reescribir ni proponer frases, no
  corregir ortografía, describir problemas verificables, formular una sola
  pregunta abierta de 20 palabras como máximo, usar solo los números de
  párrafo del documento, no inventar problemas y responder en español.
- Los criterios cambian por tipo:
  - Ensayo argumentativo: tesis, argumentos justificados, ideas anunciadas que
    se desarrollan, cierre coherente y equilibrio entre secciones.
  - Reporte de investigación: objetivo, método, resultados, conclusiones
    sustentadas y proporción entre secciones.
  - Texto abierto: coherencia, progresión, desarrollo y cierre, sin rúbrica
    rígida.
- El enfoque cambia por sección: introducción, conclusión o documento completo.
  Si no se reconoce la sección pedida, el prompt pide decirlo sin inventar
  contenido.
- El servidor divide el texto por líneas en blanco y numera los párrafos solo
  para el prompt (`[PÁRRAFO N]`). Esos IDs no se persisten.
- El documento se marca como material de solo lectura para evitar que el modelo
  siga instrucciones incluidas en el texto del usuario.
- Si no hay problemas reales, el modelo debe devolver una lista vacía. El
  cliente lo convierte en un mensaje normal, sin inventar tarjetas.

### Llamada a Gemini y errores

- `server/gemini.ts` usa Vercel AI SDK (`generateText` + `Output.array`) y
  valida la salida con Zod. La llamada tiene un timeout de 45 s.
- Los errores se traducen a códigos estables y mensajes en español:
  `peticion_invalida` (400), `texto_vacio` (400), `texto_demasiado_largo`
  (413), `cuota_agotada` (429), `respuesta_invalida` (502),
  `servicio_no_disponible` (503), `tiempo_agotado` (504), `configuracion`
  (500), `api_gemini` (502), `sin_conexion` (503) y `error_interno` (500).
- El cliente traduce esos códigos a mensajes legibles. Si el `fetch` falla por
  red o timeout, muestra un mensaje de conexión o de tiempo agotado.
- **Cambio de modelo por alta demanda:** el modelo configurado al principio
  (`gemini-3.8-flash`) respondió con errores de alta demanda y timeouts. Se
  cambió el valor de `GEMINI_MODEL` únicamente en `.env`, sin tocar el código.
  El backend no fija ningún modelo por defecto: si la variable falta o el
  modelo no está disponible, devuelve `configuracion` o
  `servicio_no_disponible`. Para reproducir el entorno hay que usar un modelo
  disponible en la cuenta y actualizar `.env.example` solo si se decide cambiar
  el valor de referencia.

### Cliente: chat, editor y presentación

- `src/lib/chat.ts` contiene `responderTutor()`, que llama a `/api/revisar` con
  `{ texto, tipoDocumento, seccion }`, valida ligeramente la respuesta y
  devuelve `{ seccion, observaciones }`. No conoce Gemini ni recibe el editor.
- `detectarSeccion()` normaliza el mensaje (quita tildes y pasa a minúsculas):
  si menciona «introducción» revisa la introducción; si menciona «conclusión»,
  la conclusión; cualquier otro mensaje, incluidos «huecos» y «argumento»,
  revisa el documento completo. La detección fina llegará en fases posteriores.
- `src/lib/parrafos.ts` extrae los bloques de nivel superior del editor con
  `editor.state.doc` y `textBetween`. Es solo lectura: no usa comandos de
  TipTap ni cambia la selección. Los bloques vacíos se descartan y se unen con
  una línea en blanco.
- `src/hooks/useChatTutor.ts` recibe `obtenerTexto`, comprueba que el documento
  no esté vacío y que no supere el límite antes de llamar al backend, y maneja
  `enviando` con un guard para evitar dobles envíos.
- `App` guarda la referencia del editor mediante `onEditorListo` y la pasa al
  hook. El editor no se modifica en ningún momento.
- `ChatLateral` muestra «El tutor está revisando…» mientras espera. Las
  observaciones se presentan como tarjetas con el número de párrafo, el tipo de
  problema, la observación y la pregunta guía. Los mensajes de error y el aviso
  de documento vacío o demasiado largo aparecen como mensajes normales del
  tutor.
- La cabecera del chat indica «Revisión con IA · no modifica tu texto».

### Verificación

- `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores.
- Se comprobó que el prompt cambia por tipo de documento (tesis, objetivo y
  método, rúbrica abierta) y por sección (introducción y conclusión).
- Se probó la lógica del cliente con `fetch` simulado: detección de secciones,
  cuerpo enviado, respuesta válida, 429, respuesta inválida y mensaje cuando no
  hay problemas.
- Se hizo una llamada real a `POST /api/revisar` con la sección `introduccion`:
  respondió `200` con observaciones que cumplen el esquema.
- Se comprobó en Edge headless que la aplicación renderiza la cabecera, el
  selector de tipo, la barra de formato y el editor.

### Límites conocidos de la Fase 3

- Sin mapa del documento, verificación cruzada ni métricas calculadas: el
  modelo recibe el texto completo y decide qué observar.
- Sin gramática ni ortografía automática más allá del corrector nativo.
- Sin resaltado de observaciones en el editor ni IDs de párrafo persistentes.
- Sin caché ni historial del chat: cada envío vuelve a llamar a Gemini y el
  historial se pierde al recargar.
- Sin autenticación ni cuota por usuario. El límite de 12.000 caracteres es la
  única protección de tamaño.
- La calidad depende del modelo configurado y de la cuota gratuita disponible.
- Sin commit de cierre de fase: queda pendiente de revisión manual.

## Fase 4 — Gramática en tiempo real con LanguageTool (2026-10-28)

### Alcance y arquitectura

- La revisión gramatical se ejecuta automáticamente tras una pausa de escritura
  de **1500 ms** y también al abrir el documento. No hay botón de «revisar
  gramática»: el resultado aparece como subrayado mientras se escribe.
- El frontend nunca llama a LanguageTool. Envía los párrafos a
  `POST /api/gramatica`; el backend es el único que conoce
  `LANGUAGETOOL_URL` y el único que habla con el servicio externo.
- El contrato compartido vive en `src/lib/gramaticaTipos.ts`: tipos de petición
  y respuesta, códigos de error, estados de la interfaz y límites. El cliente y
  el servidor importan los mismos valores.
- La petición usa `{ parrafos: [{ clave, texto }] }` y la respuesta correcta
  `{ ok: true, errores: [{ clave, inicio, fin, mensaje, regla }] }`. No existe
  ningún campo de texto corregido ni de reescritura: el agente y LanguageTool
  solo diagnostican.
- Los offsets son **UTF-16**, igual que los de JavaScript y ProseMirror. No se
  normalizan tildes, comillas ni espacios antes de enviar el texto.

### Extracción y contrato de párrafos

- `src/lib/gramaticaPosiciones.ts` recorre el documento con `doc.descendants` y
  extrae cada textblock por separado. No reutiliza `src/lib/parrafos.ts` porque
  ese módulo normaliza espacios y uniría bloques, lo que rompería la
  correspondencia con LanguageTool.
- El texto de cada bloque se obtiene desde `pos + 1`; `hardBreak` se convierte
  en `"\n"` y los nodos inline atómicos en `"\uFFFC"`. Así la longitud del texto
  coincide con `content.size` y los offsets se trasladan sin ajustes.
- Las claves actuales son efímeras: `p{indice}-{hash-del-texto}`. La caché se
  indexa por el texto, no por la clave, para sobrevivir a cambios de posición.
  Persistir IDs por párrafo queda para la Fase 6.
- Límites por petición: **20 párrafos**, **4.000 caracteres por párrafo** y
  **12.000 caracteres en total**. El servidor rechaza una petición que no los
  cumpla. Los párrafos vacíos y los que superan 4.000 caracteres no se envían.
- El cliente divide el documento en tandas secuenciales que respetan esos
  límites. Si una tanda falla, no se envían las siguientes; se conservan los
  subrayados ya cacheados.

### Backend

- `server/app.ts` expone `POST /api/gramatica`. `server/esquemaGramatica.ts`
  valida la forma con Zod y aplica los límites con códigos específicos;
  `server/languagetool.ts` realiza la llamada externa.
- `LANGUAGETOOL_URL` es obligatoria y se lee solo en el servidor. Se le quitan
  las barras finales y se añade `/v2/check`; no hay URL fija en el código. Si
  falta, la API responde `configuracion` y el cliente desactiva la revisión
  durante esa sesión.
- LanguageTool recibe `language=es` y los párrafos unidos con `"\n\n"`. El
  backend busca el rango de cada coincidencia y la descarta si cruza párrafos,
  si sale del rango o si sus límites no son válidos.
- **Ortografía:** se descartan las coincidencias con
  `rule.issueType === "misspelling"` y, como respaldo para respuestas sin
  `issueType`, las reglas cuyo ID empieza por `MORFOLOGIK_` o `HUNSPELL_`. La
  ortografía sigue siendo responsabilidad del corrector nativo del navegador;
  así se evitan dos subrayados distintos para la misma falta.
- El servidor usa un timeout de **8 s** combinado con la señal de aborto de la
  petición. El cliente usa **10 s** para no quedarse esperando una respuesta
  que el servidor ya abandonó.
- Errores traducidos: `peticion_invalida` (400), `texto_vacio` (400),
  `demasiados_parrafos` y `parrafo_demasiado_largo` (413),
  `texto_demasiado_largo` (413), `configuracion` (500), `cuota_agotada` (429),
  `servicio_no_disponible` (503), `tiempo_agotado` (504),
  `respuesta_invalida` (502) y `error_interno` (500).

### Cliente: planificador, caché y estados

- `src/lib/gramatica.ts` contiene la llamada `revisarGramatica`, la caché y el
  `PlanificadorGramatica`. `src/hooks/useGramatica.ts` conecta el planificador
  con el editor y expone el estado a la interfaz.
- La caché es **en memoria**, de 400 entradas como máximo. Se indexa por un
  hash FNV-1a más la longitud y guarda también el texto completo para descartar
  colisiones. Solo se piden a la red los párrafos que no están cacheados.
- Las tandas son secuenciales para no saturar la API pública. Una revisión
  nueva aborta la anterior y usa un contador de secuencia para ignorar
  respuestas viejas.
- Si el servicio responde `429`, se espera **60 s** antes de reintentar; si
  responde `5xx` o hay un fallo de red, **30 s**. Un timeout o una respuesta
  inválida se muestran como no disponibles sin bloquear la escritura. Un
  `configuracion` desactiva la revisión durante la sesión.
- Los estados visibles en el pie son `inactivo`, `revisando`, `listo` y
  `no_disponible`. Los subrayados ya cacheados se mantienen si una revisión
  posterior falla.

### Decoraciones y autoguardado

- `src/extensions/GramaticaDecoraciones.ts` registra un plugin con
  `PluginKey`. Las decoraciones se guardan en el estado del plugin como
  `DecorationSet`.
- Cuando llega el metadato `gramaticaDecoraciones`, se reconstruyen las
  decoraciones a partir de los errores. En cualquier otra transacción con
  cambios de documento se usa
  `decoracionesAnteriores.map(transaccion.mapping, transaccion.doc)`; en las
  transacciones que no cambian el documento se reutiliza el mismo
  `DecorationSet`. No se recalcula todo en cada transacción.
- Las decoraciones son `Decoration.inline` con la clase `error-gramatica`,
  `title`, `data-mensaje` y `data-regla`. No crean marcas ni modifican el JSON
  del documento. El estilo es un subrayado ondulado ámbar y un tooltip CSS al
  pasar el cursor.
- La transacción que aplica los errores solo lleva metadatos y tiene
  `docChanged === false`. `EditorTexto` ignora explícitamente las
  actualizaciones sin cambios de documento, así que revisar la gramática no
  dispara el autoguardado ni cambia «Guardado» a «Guardando…».

### Verificación realizada

- `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores.
- `node --import tsx --test scripts/prueba-gramatica.ts` ejecuta 8 pruebas:
  mapeo de errores simples, tildes, emoji UTF-16, listas con viñetas y
  numeradas, `hardBreak`, rangos inválidos y filtrado de `MORFOLOGIK` /
  `HUNSPELL` conservando una regla de concordancia.
- La Fase 4 pasó las pruebas manuales en el editor: subrayado tras la pausa,
  tooltip, transición de estados en el pie, desaparición del subrayado al
  corregir y autoguardado sin disparos por la transacción de metadatos.

### Límites conocidos de la Fase 4

- Los IDs de párrafo no son persistentes: se recalculan con la posición y el
  texto. El formato de documento sigue siendo v2; los IDs estables y el formato
  v3 corresponden a la Fase 6.
- LanguageTool se consulta sin caché ni límite de peticiones en el servidor.
  Cada cliente puede generar varias tandas por edición. Una caché o un rate
  limit del lado servidor queda para las Fases 7/8.
- El endpoint no tiene autenticación ni cuota por usuario. Queda para la
  Fase 8.
- Se usa la API pública de LanguageTool. En Vercel muchas instancias pueden
  compartir IP de salida, así que el límite por IP puede afectar a todos los
  usuarios a la vez. El cliente espera 60 s tras un 429, pero no hay una
  solución distribuida; queda para la Fase 8.
- El texto de los párrafos se envía a LanguageTool, un servicio externo. La
  interfaz todavía no muestra un aviso de privacidad específico; queda para la
  Fase 7.
- Los subrayados no son navegables por teclado: no tienen `tabindex` para no
  interferir con la edición. La navegación por teclado entre errores queda para
  la Fase 7.
- Sin diccionario español en el navegador no se marcan las faltas de
  ortografía. La gramática de LanguageTool sí puede seguir funcionando, pero el
  resaltado ortográfico nativo desaparece.
- La caché es solo de sesión: al recargar se vuelve a revisar el documento.
- Solo se admite español (`es`); no hay selección de variantes regionales.
- El resaltado del tutor en el editor no está implementado. Los subrayados
  actuales son solo gramaticales; el resaltado de observaciones del tutor queda
  para la Fase 6.
- Sin commit de cierre de fase: queda pendiente de revisión manual.

## Modo oscuro (2026-10-28)

### Alcance y persistencia

- Se mantienen tres valores internos: `sistema`, `claro` y `oscuro`. `sistema`
  solo se usa como valor inicial y respaldo; la interfaz alterna únicamente
  entre `claro` y `oscuro`. La preferencia se guarda en la clave independiente
  `editor-tutor-ia:tema` y nunca cambia el formato del documento.
- `src/lib/storage.ts` expone `cargarPreferenciaTema` y
  `guardarPreferenciaTema`. Un valor inválido o un fallo de localStorage se
  traduce a `sistema`; un fallo al guardar no impide cambiar el tema durante la
  sesión.
- El script inline de `index.html` aplica el tema antes de cargar React para
  evitar el destello claro. Solo acepta los tres valores válidos y usa
  `try/catch`; la clave y los valores están duplicados deliberadamente con
  `storage.ts`, y ambos archivos lo advierten en un comentario.
- `data-theme` usa los valores en español (`claro` / `oscuro`), mientras que
  `color-scheme` usa los valores CSS en inglés (`light` / `dark`). Por eso el
  selector de `index.css` es `:root[data-theme='oscuro']` y la variante de
  Tailwind también busca `oscuro`.
- No hay sincronización entre pestañas: cada una resuelve el tema al cargar y
  responde a sus propios cambios. Se decidió no añadir un listener de
  `storage` para mantener el comportamiento simple.

### Tokens y componentes

- `src/index.css` define variables para ambos temas y las expone como tokens con
  `@theme inline`. La variante `dark` se declara con
  `@custom-variant dark (&:where([data-theme='oscuro'], [data-theme='oscuro'] *));`
  sin añadir `tailwind.config.js`.
- Los componentes usan tokens semánticos (`bg-surface`, `text-ink`,
  `border-line`, `bg-chat-user`, etc.) en lugar de colores fijos. La hoja oscura
  usa `#0f172a` y un borde de `1px #1e293b`.
- El subrayado y el tooltip gramaticales leen `--grammar`, `--grammar-hover`,
  `--tooltip` y `--tooltip-ink`. No se modificó
  `src/extensions/GramaticaDecoraciones.ts` ni la lógica de LanguageTool.
- `src/hooks/useTema.ts` mantiene la preferencia, aplica el tema con
  `useLayoutEffect` y solo registra el listener de `prefers-color-scheme`
  mientras la preferencia es `sistema`.
- `src/components/ControlTema.tsx` usa un botón de 36 px con icono, sin etiqueta
  visible «Tema». Muestra un sol cuando el tema resuelto es oscuro y una luna
  cuando es claro; el SVG es inline y tiene `aria-hidden="true"`.
- Al pulsar, el botón cambia al tema contrario del resuelto, guarda esa
  preferencia explícita con `cambiarPreferencia` y convierte `sistema` en una
  elección explícita en la primera pulsación. `aria-label` y `title` describen
  la acción en español. El `role="status"` solo anuncia el cambio cuando el
  usuario pulsa, nunca al montar.
- El botón se colocó en la cabecera entre el selector de tipo de documento y el
  botón del chat. Sin el antiguo selector de tema, el selector de tipo recupera
  su ancho base de `11.5rem` y puede reducirse con `min-w-0` en pantallas
  estrechas.

### Verificación realizada

- `npm run typecheck`, `npm run lint` y `npm run build` pasan sin errores.
- Se comprobó en el CSS generado que aparece `:root[data-theme=oscuro]`, que la
  variante usa `oscuro` y que no queda ninguna referencia a `data-theme=dark`.
- Queda pendiente la revisión visual manual de la matriz completo/oscuro,
  incluyendo la recarga sin destello, el cambio del tema del sistema, el
  contraste del subrayado gramatical y el anuncio del `role="status"` al pulsar
  el botón.

### Límites conocidos

- El botón solo alterna entre claro y oscuro; no se puede volver a `sistema`
  desde la interfaz, aunque sigue siendo el valor inicial y de respaldo.
- No hay atajo de teclado específico para cambiar el tema; se usa el botón de la
  cabecera.
- No se sincroniza el tema entre pestañas abiertas.
- La preferencia se guarda en localStorage: si el navegador la bloquea, el tema
  funciona solo durante la sesión.
- Sin commit de cierre: los cambios quedan pendientes de revisión manual.
