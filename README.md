# Editor de Texto Web con Tutor de IA

Editor de texto tipo Word con un tutor de IA en un chat lateral. El tutor
evalúa estructura y coherencia a demanda y **nunca** reescribe el texto del
usuario.

Estado actual: **Fase 1 (editor base)**. Ya existe la hoja de escritura con
TipTap, la barra de formato, el corrector ortográfico nativo, el contador de
palabras y el autoguardado. El chat y el tutor de IA llegan en fases
posteriores.

## Requisitos

- Node.js 22.12 o superior (probado con Node 24; lo exige Vite 8 y el flag
  `--env-file-if-exists`).
- npm.
- Una clave de Gemini de [Google AI Studio](https://aistudio.google.com/apikey)
  solo si vas a ejecutar la prueba de humo.

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

Nunca subas `.env` al repositorio.

## Comandos

| Comando             | Qué hace                                              |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo (http://localhost:5173).       |
| `npm run build`     | Comprueba tipos y genera la build de producción.      |
| `npm run typecheck` | Solo comprobación de tipos.                           |
| `npm run lint`      | Oxlint.                                               |
| `npm run smoke`     | Prueba de humo: envía el ensayo de prueba a Gemini.   |

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

## Estructura

```
scripts/
  fixtures/ensayo-prueba.txt   Ensayo con defectos deliberados
  smoke-gemini.ts              Verificación aislada contra Gemini
src/
  components/
    EditorTexto.tsx            Editor, hoja y autoguardado
    BarraHerramientas.tsx      Botones de formato
  lib/
    storage.ts                 Persistencia (localStorage)
    texto.ts                   Conteo de palabras
  App.tsx                      Carga inicial del documento
docs/decisiones.md             Registro de decisiones técnicas
```

Las decisiones de cada fase se documentan en `docs/decisiones.md`.
