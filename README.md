# Editor de Texto Web con Tutor de IA

Editor de texto tipo Word con un tutor de IA en un chat lateral. El tutor
evalúa estructura y coherencia a demanda y **nunca** reescribe el texto del
usuario.

Estado actual: **Fase 0 (preparación)**. Todavía no hay editor ni chat.

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

## Estructura

```
scripts/
  fixtures/ensayo-prueba.txt   Ensayo con defectos deliberados
  smoke-gemini.ts              Verificación aislada contra Gemini
src/                           Frontend React (Fase 0: pantalla base)
docs/decisiones.md             Registro de decisiones técnicas
```

Las decisiones de cada fase se documentan en `docs/decisiones.md`.
