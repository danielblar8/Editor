# Proyecto: Editor de Texto Web con Tutor de IA

## Descripción
Editor de texto web tipo Word con un agente de IA en un chat lateral.
El usuario elige el tipo de documento (Ensayo Argumentativo, Reporte de
Investigación o Texto Abierto) al inicio o durante la sesión.
- El lienzo ofrece corrección ortográfica y gramatical en tiempo real.
- El agente actúa como TUTOR A DEMANDA: evalúa coherencia, flujo
  argumentativo y estructura solo cuando el usuario lo pide
  (ej. "Revisa mi introducción").
- El agente NUNCA redacta, reescribe ni modifica el contenido del usuario.

## Qué debe detectar el agente
Huecos argumentales, ideas de la introducción que nunca se retoman,
desarrollo demasiado corto, conclusión incoherente con el desarrollo,
ideas nuevas en la conclusión, desequilibrio entre secciones.

## Stack (todo gratuito)
- Frontend: React + Vite + TypeScript + Tailwind (+ shadcn/ui opcional)
- Editor: TipTap
- Ortografía: spellcheck nativo del navegador
- Gramática: LanguageTool (API pública), fase posterior
- IA: Gemini API (capa gratuita) con Vercel AI SDK + Zod
- Backend: API routes / Hono (la API key SOLO vive en el backend, en .env)
- Hosting: Vercel
- Guardado: localStorage/IndexedDB

## Reglas NO negociables
1. El agente de IA nunca modifica el editor. Solo recibe el texto en lectura.
2. La salida del agente se valida con Zod y NO incluye campo de "texto
   sugerido" ni de reescritura. Esquema base:
   { parrafo_id, tipo_problema, observacion, pregunta_guia }
3. La API key jamás va en el código del cliente ni en el repositorio.
   Usar .env y .env.example. Incluir .env en .gitignore.
4. Todo texto de la interfaz y del agente está en español.
5. Trabajar UNA fase a la vez. No adelantar funciones de fases futuras.
6. Antes de implementar cada fase, presentar un plan y esperar aprobación.
7. Al terminar cada fase: explicar cómo probarla y registrar las decisiones
   técnicas en docs/decisiones.md.
8. El guardado vive en un solo módulo (src/lib/storage.ts) con funciones
   guardarDocumento y cargarDocumento. Hoy usa localStorage; debe poder
   cambiarse por una base de datos sin tocar el resto de la app.
9. El documento se guarda como JSON de TipTap (no texto plano) y cada
   documento tiene un ID único desde el inicio.
10. El frontend nunca llama a Gemini directamente: siempre pasa por el
   backend.
11. Toda configuración (claves, URLs) va en variables de entorno, nunca
   fija en el código.

## Plan por fases
- Fase 0: Preparación (repo, proyecto base, variables de entorno,
  script de prueba de humo con Gemini)
- Fase 1: Editor base con TipTap (negritas, cursivas, subrayado,
  encabezados, listas, deshacer/rehacer, hoja de escritura, barra de
  herramientas, spellcheck nativo, guardado automático)
- Fase 2: Layout editor + chat lateral, selector de tipo de documento
  (modificable en cualquier momento), chat visual sin IA real
- Fase 3: Agente simple (endpoint backend, comando "Revisa mi
  introducción", JSON validado con Zod, prompt base por tipo de documento)
- Fase 4: Gramática en tiempo real con LanguageTool (debounce 1-2 s)
- Fase 5: Agente completo (mapa del documento, verificación cruzada,
  métricas calculadas en código, rúbricas por tipo de documento)
- Fase 6: Integración con el editor (ID por párrafo, resaltado de
  observaciones, interpretación de comandos, caché del mapa)
- Fase 7: Pruebas y pulido (manejo de errores, estados de carga)
- Fase 8: Despliegue en Vercel y documentación

## Fase actual: 1