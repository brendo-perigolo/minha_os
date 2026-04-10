import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Diagnóstico (não imprime a chave): aparece nos logs do build (ex.: Vercel)
  // e confirma se `VITE_VAPID_PUBLIC_KEY` foi carregada pelo Vite no build.
  if (mode === 'production') {
    const env = loadEnv(mode, process.cwd(), '')
    // eslint-disable-next-line no-console
    console.log(
      '[vite] VITE_VAPID_PUBLIC_KEY present at build:',
      Boolean(String(env.VITE_VAPID_PUBLIC_KEY || '').trim())
    )
  }

  return {
    plugins: [react()],
  }
})
