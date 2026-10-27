import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Solo se leen variables con prefijo API_ para configurar el proxy de
  // desarrollo. Las claves de Gemini no se exponen al cliente.
  const env = loadEnv(mode, process.cwd(), 'API_')
  const objetivoApi = env.API_PROXY_TARGET || 'http://localhost:3001'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: objetivoApi,
          changeOrigin: true,
        },
      },
    },
  }
})
