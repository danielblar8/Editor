# Editor de Texto Web con Tutor de IA

Editor de texto tipo Word con un tutor de IA en un chat lateral. El tutor
evalúa estructura y coherencia a demanda y **nunca** reescribe el texto del
usuario.

Estado actual: **Fase 3 (agente tutor conectado a Gemini)**. Ya existe la hoja
de escritura con TipTap, la barra de formato, el corrector ortográfico nativo,
el contador de palabras, el autoguardado, el selector de tipo de documento y un
chat lateral que revisa estructura y coherencia con IA real a demanda. El tutor
no modifica el texto: solo devuelve observaciones y preguntas guía.

## Requisitos

- Node.js 22.12 o superior (probado con Node 24; lo exige Vite 8 y el flag
  `--env-file-if-exists`).
- npm.
- Una clave de Gemini de [Google AI Studio](https://aistudio.google.com/apikey)
  para el chat con IA y para la prueba de humo.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # en Windows: Copy-Item .env.example .env
```

Edita `.env` y pega tu clave:

```env
GEMINI_API_KEY=tu_clave_aqui
GEMINI_MODEL=gemini-2.5-flash
```

`GEMINI_MODEL` debe ser un modelo disponible en tu cuenta. El backend no fija
un modelo por defecto: si la variable falta o el modelo no existe, el chat
mostrará un error de configuración. Durante el desarrollo, `gemini-3.8-flash`
dio errores de alta demanda y se cambió solo el valor de `.env`; el código no
se modificó.

Nunca subas `.env` al repositorio. La clave vive únicamente en el servidor: el
frontend llama a `/api`, nunca a Gemini.

## Comandos

| Comando             | Qué hace                                                   |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Vite en http://localhost:5173 y API en http://localhost:3001. |
| `npm run build`     | Comprueba tipos y genera la build de producción.           |
| `npm run typecheck` | Solo comprobación de tipos.                                |
| `npm run lint`      | Oxlint.                                                    |
| `npm run smoke`     | Prueba de humo: envía el ensayo de prueba a Gemini.        |

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
- El documento se guarda automáticamente ~1 s después de dejar de escribir y
  se recupera al recargar. El estado «Guardado» aparece en el pie de la hoja.
- El pie muestra además el contador de palabras.
- Se guarda el JSON de TipTap, no HTML ni texto plano. El único módulo que
  toca localStorage es `src/lib/storage.ts`.

## Chat y tipo de documento (Fase 2)

- **Selector de tipo de documento** en la cabecera superior: Ensayo
  Argumentativo, Reporte de Investigación o Texto Abierto / Sin Definir. Se
  puede cambiar en cualquier momento.
- **Elección inicial**: con un documento nuevo aparece un diálogo para elegir
  el tipo. Se puede omitir y seguir con Texto Abierto. La elección se guarda
  junto con el documento y se recupera al recargar.
- **Migración**: los documentos guardados en la Fase 1 se cargan sin perder
  contenido; reciben el tipo Texto Abierto y se reescriben en el formato v2.
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

| Método | Ruta           | Descripción                                            |
| ------ | -------------- | ------------------------------------------------------ |
| `GET`  | `/api/salud`   | Comprueba que el backend está en marcha.               |
| `POST` | `/api/revisar` | Recibe `{ texto, tipoDocumento, seccion }` y devuelve observaciones validadas con Zod. |

Códigos de error del backend: `peticion_invalida`, `texto_vacio`,
`texto_demasiado_largo`, `cuota_agotada`, `configuracion`,
`respuesta_invalida`, `servicio_no_disponible`, `api_gemini`,
`tiempo_agotado`, `sin_conexion` y `error_interno`.

## Estructura

```
server/
  index.ts                     Arranque de la API (Hono + Node)
  app.ts                       Rutas /api/salud y /api/revisar
  esquema.ts                   Esquemas Zod de petición y observaciones
  gemini.ts                    Llamada a Gemini, timeout y errores
  prompts.ts                   Prompts por tipo y sección
scripts/
  fixtures/ensayo-prueba.txt   Ensayo con defectos deliberados
  smoke-gemini.ts              Verificación aislada contra Gemini
src/
  components/
    EditorTexto.tsx            Editor, hoja y autoguardado
    BarraHerramientas.tsx      Botones de formato
    EncabezadoApp.tsx          Cabecera, selector y botón del chat
    SelectorTipoDocumento.tsx  Selector de tipo de documento
    DialogoTipoDocumento.tsx   Elección inicial del tipo
    ChatLateral.tsx            Panel visual del chat
  hooks/
    useChatTutor.ts            Estado del chat y envío al backend
  lib/
    storage.ts                 Persistencia (localStorage, formato v2)
    tiposDocumento.ts          Catálogo único de tipos de documento
    revisionTipos.ts           Contrato compartido y detección de sección
    parrafos.ts                Extracción de párrafos en solo lectura
    chat.ts                    Mensajes y llamada a /api/revisar
    texto.ts                   Conteo de palabras
  App.tsx                      Carga, layout y referencia del editor
docs/decisiones.md             Registro de decisiones técnicas
```

Las decisiones de cada fase se documentan en `docs/decisiones.md`.
