# Editor de Texto Web con Tutor de IA

Editor de texto tipo Word con un tutor de IA en un chat lateral. El tutor
evalúa estructura y coherencia a demanda y **nunca** reescribe el texto del
usuario.

Estado actual: **Fase 8 (cuentas y documentos múltiples)**. La app arranca en
una pantalla de cuenta; tras iniciar sesión se abre «Mis documentos», desde
donde se crean, abren, renombran y borran documentos. Cada documento tiene
título editable y se guarda en PostgreSQL a través de la API. El editor
conserva la hoja de escritura con TipTap, la barra de formato, el corrector
ortográfico nativo, el contador de palabras, el selector de tipo de documento,
el chat lateral con IA real y la revisión gramatical automática. El tutor no
modifica el texto: solo devuelve observaciones y preguntas guía.

## Requisitos

- Node.js 22.12 o superior (probado con Node 24; lo exige Vite 8 y el flag
  `--env-file-if-exists`).
- npm.
- PostgreSQL local (probado con 18). La app no usa la nube: las cuentas y los
  documentos viven en una base local.
- Una clave de Gemini de [Google AI Studio](https://aistudio.google.com/apikey)
  para el chat con IA y para la prueba de humo.
- Conexión a internet y una instancia accesible de LanguageTool para la
  revisión gramatical. La API pública no requiere clave; también se puede
  apuntar `LANGUAGETOOL_URL` a un servidor propio.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # en Windows: Copy-Item .env.example .env
createdb -U postgres editor_tutor
npm run db:init
npm run dev
```

Edita `.env` con tus valores. Las claves de Gemini, la URL de PostgreSQL y el
secreto de sesión viven **solo** en el servidor:

```env
GEMINI_API_KEY=tu_clave_aqui
GEMINI_MODEL=gemini-3.5-flash-lite
LANGUAGETOOL_URL=https://api.languagetool.org
DATABASE_URL=postgresql://postgres:tu_contrasena@localhost:5432/editor_tutor
SESSION_SECRET=una_cadena_aleatoria_de_al_menos_32_caracteres
```

`SESSION_SECRET` se usa para firmar los tokens de sesión; no lo compartas ni lo
subas al repositorio. Puedes generarlo con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`npm run db:init` aplica `db/schema.sql` y es idempotente: se puede ejecutar
varias veces sin borrar datos.

`GEMINI_MODEL` debe ser un modelo disponible en tu cuenta. El backend no fija
un modelo por defecto: si la variable falta o el modelo no existe, el chat
mostrará un error de configuración. Durante el desarrollo, `gemini-3.8-flash`
dio errores de alta demanda y se cambió solo el valor de `.env`; el código no
se modificó.

`LANGUAGETOOL_URL` es la URL base del servicio de gramática; el backend le
añade `/v2/check`. Si falta, el editor sigue funcionando pero el pie muestra
«Gramática no disponible». No requiere clave con la API pública. Se puede
cambiar por la URL de una instancia propia sin tocar el código.

Nunca subas `.env` al repositorio. La clave de Gemini vive únicamente en el
servidor: el frontend llama a `/api`, nunca a Gemini ni a LanguageTool.

## Comandos

| Comando             | Qué hace                                                   |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Vite en http://localhost:5173 y API en http://localhost:3001. |
| `npm run db:init`   | Aplica `db/schema.sql` en la base local.                   |
| `npm run build`     | Comprueba tipos y genera la build de producción.           |
| `npm run typecheck` | Solo comprobación de tipos.                                |
| `npm run lint`      | Oxlint.                                                    |
| `npm run test:cuentas` | Prueba de API de cuentas y documentos contra PostgreSQL. |
| `npm run smoke`     | Prueba de humo: envía el ensayo de prueba a Gemini.        |

Para ejecutar todas las pruebas:

```bash
$archivos = Get-ChildItem scripts/prueba-*.ts | ForEach-Object { $_.FullName }
node --env-file-if-exists=.env --import tsx --test @archivos
```

Las pruebas de cuentas necesitan `DATABASE_URL` y `SESSION_SECRET` en `.env` y
crean usuarios de prueba que luego borran.

`npm run dev` usa `concurrently` para levantar el frontend y el backend. Vite
proxya `/api` al puerto 3001, así que basta con abrir
http://localhost:5173.

La prueba de humo acepta otra ruta:

```bash
npm run smoke -- ruta/a/mi-ensayo.txt
```

Códigos de salida: `0` éxito, `1` error de validación, `2` error de API,
`3` error de configuración.

## Editor (Fase 1)

- Barra de formato: negrita, cursiva, subrayado, títulos H1–H3, listas con
  viñetas y numeradas, deshacer y rehacer. Los botones muestran tooltip y
  estado activo.
- El área de escritura usa `spellcheck="true"` y `lang="es"`; la corrección
  depende del diccionario español del navegador.
- El documento se guarda automáticamente ~1 s después de dejar de escribir.
  El pie muestra `Guardando…`, `Guardado` o `No se pudo guardar` (con un botón
  `Reintentar`). Si el servidor está caído, el estado lo refleja y no se pierde
  el texto que sigue en el editor.
- Al cambiar de documento, el editor vacía el debounce y espera al guardado en
  curso. Si el guardado falla, no se cambia de documento y aparece un aviso.
- El pie muestra además el contador de palabras.
- Se guarda el JSON de TipTap, no HTML ni texto plano. El único módulo del
  frontend que sabe cómo se guardan los documentos es `src/lib/storage.ts`;
  ahora habla con la API y PostgreSQL.

## Chat y tipo de documento (Fase 2)

- **Selector de tipo de documento** en la cabecera superior: Ensayo
  Argumentativo, Reporte de Investigación o Texto Abierto / Sin Definir. Se
  puede cambiar en cualquier momento.
- **Elección inicial**: con un documento nuevo aparece un diálogo para elegir
  el tipo. Se puede omitir y seguir con Texto Abierto. La elección se guarda
  junto con el documento y se recupera al recargar.
- **Migración**: los documentos antiguos se cargan sin perder contenido; si
  falta el tipo reciben Texto Abierto y, si faltan IDs de párrafo, se reparan al
  guardar en el formato actual.
- **Chat lateral** en la derecha, plegable con el botón de la cabecera. En
  pantallas menores de 1024 px aparece como panel deslizable.
- El tutor da la bienvenida, avisa cuando cambia el tipo de documento y envía
  las revisiones al backend. Responde en español.
- `Enter` envía, `Mayús+Enter` salta de línea. Hay dos botones de sugerencia y
  el desplazamiento es automático al último mensaje.
- El historial del chat vive **solo en memoria**: al recargar se pierde.

## Chat con IA (Fase 3)

- **Tutor a demanda**: escribe «Revisa mi introducción», «Revisa la conclusión»
  o pide una revisión general. La detección es simple: «introducción» revisa la
  introducción, «conclusión» revisa la conclusión y cualquier otro mensaje
  revisa el documento completo.
- **Solo diagnóstico**: cada observación indica el número de párrafo, el tipo de
  problema, una observación concreta y una pregunta guía. El tutor nunca
  reescribe, no propone frases nuevas y no corrige ortografía.
- **Prompts por tipo de documento**: los criterios cambian entre ensayo
  argumentativo, reporte de investigación y texto abierto. El prompt se
  construye en el servidor y no se envía desde el cliente.
- **Sin problemas**: si el modelo no encuentra problemas reales, el chat lo dice
  con un mensaje normal y no inventa observaciones.
- **Estados**: mientras espera se muestra «El tutor está revisando…». Los errores
  de conexión, cuota agotada, texto vacío, texto demasiado largo y respuesta
  inválida se muestran en español.
- **Límite**: 12.000 caracteres por revisión. Si el documento es más largo, se
  pide dividirlo o revisar una sección más corta.
- **Privacidad**: la API key vive en el servidor. El frontend solo llama a
  `/api/revisar`; nunca a Gemini directamente.

### Endpoints

| Método | Ruta             | Descripción                                            |
| ------ | ---------------- | ------------------------------------------------------ |
| `GET`  | `/api/salud`     | Comprueba que el backend está en marcha.               |
| `POST` | `/api/revisar`   | Recibe `{ texto, tipoDocumento, seccion }` y devuelve observaciones validadas con Zod. |
| `POST` | `/api/gramatica` | Recibe `{ parrafos: [{ clave, texto }] }` y devuelve errores gramaticales con offsets por párrafo. |

Códigos de error del chat: `peticion_invalida`, `texto_vacio`,
`texto_demasiado_largo`, `cuota_agotada`, `configuracion`,
`respuesta_invalida`, `servicio_no_disponible`, `api_gemini`,
`tiempo_agotado`, `sin_conexion` y `error_interno`.

Códigos de error de gramática: `peticion_invalida`, `texto_vacio`,
`demasiados_parrafos`, `parrafo_demasiado_largo`, `texto_demasiado_largo`,
`configuracion`, `cuota_agotada`, `servicio_no_disponible`, `tiempo_agotado`,
`respuesta_invalida` y `error_interno`.

## Gramática en tiempo real (Fase 4)

- La revisión se lanza automáticamente **1,5 s después** de dejar de escribir y
  también al abrir el documento. El pie muestra `Revisando gramática…`,
  `Gramática revisada`, `Gramática sin texto` o `Gramática no disponible`.
- Los errores aparecen como un subrayado ondulado ámbar. Al pasar el cursor se
  muestra el mensaje de LanguageTool. Los subrayados no modifican el documento
  ni el JSON guardado.
- **Solo gramática:** las faltas de ortografía se descartan porque ya las marca
  el corrector nativo del navegador. Sin diccionario español instalado, el
  navegador no subraya faltas, aunque LanguageTool puede seguir marcando
  problemas gramaticales.
- **Límites por tanda:** 20 párrafos, 4.000 caracteres por párrafo y 12.000 en
  total. Los párrafos más largos se omiten. El cliente envía varias tandas
  secuenciales, cachea en memoria hasta 400 resultados y reintenta tras un 429
  (60 s) o un fallo de servicio (30 s).
- **Privacidad:** el texto de cada párrafo se envía al backend y este a
  `LANGUAGETOOL_URL`. No se envía a Gemini. Todavía no hay un aviso de
  privacidad específico en la interfaz (Fase 7).
- El endpoint no tiene autenticación, cuota por usuario ni rate limit del lado
  servidor (Fases 7/8).

### Cómo probar la gramática

1. Ejecuta `npm run dev` con `LANGUAGETOOL_URL` definida en `.env`.
2. Abre http://localhost:5173 y escribe una frase con un error gramatical, por
   ejemplo: `Los estudiantes esta cansados.`.
3. Espera ~1,5 s: aparece el subrayado; al pasar el cursor, el mensaje.
4. Comprueba que el pie pasa por `Revisando gramática…` y `Gramática revisada`.
5. Corrige el error y espera: el subrayado desaparece.
6. Espera a que el pie diga `Guardado` y deja terminar la revisión. No debe
   volver a `Guardando…`; la transacción que pinta los subrayados no guarda.

Pruebas automatizadas de mapeo de offsets:

```bash
node --import tsx --test scripts/prueba-gramatica.ts
```

Si el pie muestra `Gramática no disponible`, revisa que `LANGUAGETOOL_URL` sea
accesible. Tras un 429, el cliente espera 60 s antes de reintentar.

## Agente completo (Fase 5)

- **Verificaciones en código**: antes de llamar al modelo, el servidor calcula
  palabras por sección, proporciones entre introducción, desarrollo y
  conclusión, y detecta ideas anunciadas que no se retoman, ideas nuevas en la
  conclusión, desequilibrio entre secciones y desarrollo corto. Estos datos
  viajan al prompt como hechos cerrados que el modelo no debe recalcular.
- **Mapa del documento**: el modelo extrae la tesis u objetivo, las secciones y
  las ideas que anuncia la introducción. Se valida con Zod y se descartan
  índices duplicados o fuera de rango.
- **Rúbricas por tipo de documento**: ensayo argumentativo, reporte de
  investigación y texto abierto tienen cada uno sus criterios de revisión.
  Las rúbricas solo describen qué evaluar; no contienen texto sugerido.
- **Origen de cada observación**: las observaciones se fusionan y quedan
  etiquetadas como `modelo`, `codigo` o `fusionada`.
- **Documento incompleto**: si se pide revisar el documento completo (ensayo o
  reporte) y tiene menos de tres párrafos o no tiene estructura, el servidor
  responde sin llamar a Gemini, con una observación de desarrollo corto y una
  pregunta fija. «Revisa mi introducción» y «Revisa la conclusión» sí llaman al
  modelo, y el texto abierto queda fuera de esta regla.
- **Preguntas guía controladas**: cada tipo de problema tiene una pregunta fija
  como respaldo. Si el modelo propone una pregunta que invita a redactar o
  reescribir, se sustituye por la fija.
- **Textos largos**: hasta 12.000 caracteres se resuelve en una sola llamada.
  Entre 12.000 y 30.000 se usan dos: primero un mapa corto y después las
  observaciones de la sección pedida. El límite por revisión sube a
  **30.000 caracteres** (antes 12.000).
- **Plazos**: el servidor espera como máximo 55 s por revisión y el cliente
  60 s. Una respuesta inválida se reintenta una vez; el presupuesto es de tres
  llamadas por revisión.
- **Límites conocidos**: las verificaciones léxicas no detectan sinónimos ni
  paráfrasis, así que la detección fina de ideas nuevas y de coherencia depende
  del modelo. Cambiar de modelo o de prompt puede cambiar los resultados.

### Cómo probar el agente completo

1. Ejecuta `npm run dev`, abre la app y pega `scripts/fixtures/ensayo-prueba.txt`
   con el tipo **Ensayo Argumentativo**.
2. Pulsa «¿Hay huecos en mi argumento?»: debe señalar la idea no retomada de la
   introducción y las ideas nuevas de la conclusión.
3. Pega `documento-bueno.txt`: debe responder que no encontró problemas.
4. Pega `documento-solo-introduccion.txt` y pide la revisión completa: una sola
   observación de desarrollo corto con la pregunta fija. En la terminal del
   servidor debe aparecer `llamadas=0`.
5. Pega `documento-muy-largo.txt` (unos 17.000 caracteres): usa dos llamadas y
   puede tardar hasta casi un minuto.

Pruebas automatizadas:

```bash
node --import tsx --test scripts/prueba-*.ts
```

## Resaltado en el editor (Fase 6)

- **IDs de párrafo persistentes**: cada bloque del documento tiene un
  identificador estable (`data-parrafo-id`) que se guarda con el documento. No
  altera el texto visible ni el que lee el tutor. Los documentos antiguos se
  migran al formato actual sin perder contenido.
- **Resaltado de observaciones**: al recibir una revisión, el editor resalta
  los párrafos señalados mediante decoraciones, sin modificar el documento ni
  disparar el autoguardado. El resaltado usa fondo y borde, no solo color, y
  funciona en tema claro y oscuro.
- **Solo la última revisión**: cada revisión nueva reemplaza los resaltados
  anteriores. Si la revisión no encuentra problemas, el editor queda limpio. Las
  tarjetas anteriores se conservan en el chat como historial.
- **De la tarjeta al párrafo**: al pulsar una tarjeta, el editor se desplaza al
  párrafo y lo destaca unos segundos, sin mover el cursor. Cada tarjeta tiene
  además un botón «Ver en el texto» para teclado y lectores de pantalla.
- **Del párrafo a la tarjeta**: al pulsar un párrafo resaltado se marca la
  tarjeta correspondiente en el chat.
- **Quitar resaltados**: un botón en el chat los quita; una revisión nueva los
  vuelve a mostrar. Si se edita un párrafo resaltado, el resaltado se conserva;
  si se borra, desaparece.
- **Animaciones**: el énfasis respeta la preferencia del sistema de reducir
  movimiento.
- **Límites**: un párrafo borrado deja su tarjeta sin destino. Los comandos del
  chat siguen siendo simples (introducción, conclusión o documento completo) y
  no hay caché del mapa del documento.

### Cómo probar el resaltado

1. Pega `ensayo-prueba.txt` y pulsa «¿Hay huecos en mi argumento?»: se
   resaltan los párrafos de la introducción y de la conclusión.
2. Pulsa una tarjeta: el editor se desplaza al párrafo correcto.
3. Pulsa un párrafo resaltado: se marca su tarjeta en el chat.
4. Pulsa «Revisa mi introducción»: solo debe quedar resaltada la introducción.
5. Prueba con una lista y un título en el texto: el resaltado cae en el bloque
   correcto.
6. Pulsa «Quitar resaltados» y comprueba que desaparecen. Revisa que el texto,
   el contador y el estado «Guardado» no cambien al resaltar.

## Fiabilidad ante fallos del modelo (Fase 7)

- **Reintento ante 503**: si Gemini responde «servicio no disponible» (503), el
  servidor espera 1,5 s y reintenta una vez. No se reintentan los errores de
  cuota (429), de configuración ni otros fallos del servicio.
- **Modelo de respaldo opcional**: si `GEMINI_MODEL_RESPALDO` está definido en
  `.env`, ese reintento usa el modelo de respaldo. Si no está definido, se
  reintenta con el modelo principal.
- **Plazos intactos**: el reintento respeta el plazo de 55 s y el presupuesto de
  tres llamadas por revisión; si el plazo ya venció, no se reintenta.
- **Registro**: el servidor deja en la consola una línea cuando usa el modelo de
  respaldo, sin texto del documento ni claves.
- **Límites**: sigue sin haber rate limit propio ni cuota por usuario. La capa
  gratuita de Gemini puede devolver 429 o saturarse en horas de mucha demanda.
  La gramática todavía no muestra un aviso de privacidad en la interfaz, y el
  tamaño del paquete del frontend (~667 kB) queda pendiente de optimizar.

### Cómo probar la fiabilidad

1. Define en `.env` `GEMINI_MODEL_RESPALDO` con un modelo distinto del
   principal y reinicia `npm run dev`.
2. Haz varias revisiones. Si ocurre un 503, en la terminal del servidor se verá
   `Llamada 1/3`, luego el aviso del modelo de respaldo y `Llamada 2/3`.
3. Pruebas automatizadas del reintento:

```bash
node --import tsx --test scripts/prueba-reintento.ts
```

## Cuentas y documentos (Fase 8)

- **Cuenta**: la app abre en la pantalla de acceso. Se puede crear una cuenta o
  iniciar sesión. La contraseña se guarda solo como hash `scrypt` y la sesión
  viaja en una cookie `httpOnly`.
- **Mis documentos**: tras el login siempre aparece la lista de documentos, con
  tipo y fecha de actualización. Desde ahí se crea, abre, renombra y borra.
  Borrar pide confirmación en la propia tarjeta.
- **Título editable**: el título está dentro de la hoja. Se guarda con `Enter`
  o al salir del campo; `Escape` descarta el cambio.
- **Cambio de tipo inmediato**: al cambiar el tipo de documento se guarda al
  momento, sin esperar al debounce del contenido.
- **Guardado seguro al salir**: «Mis documentos» y «Cerrar sesión» esperan al
  guardado en curso, vacían el debounce y, si la API falla, no cambian de
  vista: muestran un aviso y el documento sigue abierto.
- **Chat aislado por documento**: al cambiar de documento se aborta la revisión
  del tutor en curso y se ignoran respuestas tardías. El chat, los resaltados y
  la gramática empiezan limpios.
- **Sesión caducada**: si una API protegida responde 401, la app vuelve a la
  pantalla de cuenta con un mensaje en español.

### Límites conocidos

- `/api/revisar` y `/api/gramatica` siguen siendo públicas: no exigen sesión ni
  tienen cuota por usuario. En local se acepta; para producción habría que
  protegerlas.
- Si el guardado falla, la navegación queda bloqueada para no perder cambios.
  El usuario puede reintentar cuando vuelva la conexión o recargar la página.
- No hay recuperación de contraseña, verificación por correo, roles, uso
  compartido ni despliegue en la nube.

## Estructura

```
server/
  index.ts                     Arranque de la API (Hono + Node)
  app.ts                       Rutas /api/salud, /api/revisar y /api/gramatica
  esquema.ts                   Esquemas Zod de petición y observaciones
  esquemaGramatica.ts          Validación de peticiones y respuestas de gramática
  gemini.ts                    Llamada a Gemini, timeout y errores
  languagetool.ts              Llamada a LanguageTool y mapeo de offsets
  prompts.ts                   Prompts por tipo y sección
scripts/
  fixtures/ensayo-prueba.txt   Ensayo con defectos deliberados
  smoke-gemini.ts              Verificación aislada contra Gemini
  prueba-gramatica.ts          Pruebas de mapeo y filtrado gramatical
src/
  components/
    EditorTexto.tsx            Editor, hoja, autoguardado y estado gramatical
    BarraHerramientas.tsx      Botones de formato
    EncabezadoApp.tsx          Cabecera, selector y botón del chat
    SelectorTipoDocumento.tsx  Selector de tipo de documento
    DialogoTipoDocumento.tsx   Elección inicial del tipo
    ChatLateral.tsx            Panel visual del chat
  extensions/
    GramaticaDecoraciones.ts   Subrayados sin modificar el documento
  hooks/
    useChatTutor.ts            Estado del chat y envío al backend
    useGramatica.ts            Conexión del planificador con el editor
  lib/
    storage.ts                 Persistencia (localStorage, formato v2)
    tiposDocumento.ts          Catálogo único de tipos de documento
    revisionTipos.ts           Contrato compartido y detección de sección
    parrafos.ts                Extracción de párrafos en solo lectura
    chat.ts                    Mensajes y llamada a /api/revisar
    gramaticaTipos.ts          Contrato compartido y límites de gramática
    gramaticaPosiciones.ts     Extracción y offsets de ProseMirror
    gramatica.ts               Llamada, caché y planificador de gramática
    texto.ts                   Conteo de palabras
  App.tsx                      Carga, layout y referencia del editor
docs/decisiones.md             Registro de decisiones técnicas
```

Las decisiones de cada fase se documentan en `docs/decisiones.md`.
