import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // O SDK do Firebase é a maior parte do pacote e quase nunca muda.
        // Em pedaço próprio, um deploy do CRM não invalida o cache dele no
        // navegador de quem já usou o sistema — só o código da aplicação
        // volta a ser baixado.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          if (id.includes('react-router')) return 'router'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'react'
        },
      },
    },
  },
})
