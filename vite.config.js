import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Diagnóstico (não imprime a chave): aparece nos logs do build (ex.: Vercel)
// e confirma se `VITE_VAPID_PUBLIC_KEY` chegou no momento do build.
if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.log(
    '[vite] VITE_VAPID_PUBLIC_KEY present at build:',
    Boolean(process.env.VITE_VAPID_PUBLIC_KEY)
  )
}

export default defineConfig({
  plugins: [react()],
})
