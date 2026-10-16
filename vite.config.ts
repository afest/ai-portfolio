import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base — адрес на GitHub Pages: afest.github.io/ai-portfolio/
// порт свой: 5173 и 5174 — dev-серверы сервиса поставщиков, 5178 — лаборатория Linza
export default defineConfig({
  base: '/ai-portfolio/',
  plugins: [react()],
  server: { port: 5186, strictPort: true, host: '127.0.0.1' },
  preview: { port: 5187, strictPort: true, host: '127.0.0.1' },
})
