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
