import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        // ── CoinGecko (market data, no key needed) ──────────────
        '/api/coingecko': {
          target:       'https://api.coingecko.com/api/v3',
          changeOrigin: true,
          rewrite:      p => p.replace(/^\/api\/coingecko/, ''),
        },

        // ── Anthropic Claude ────────────────────────────────────
        '/api/anthropic': {
          target:       'https://api.anthropic.com',
          changeOrigin: true,
          rewrite:      p => p.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-api-key',           env.VITE_ANTHROPIC_API_KEY || '')
              proxyReq.setHeader('anthropic-version',   '2023-06-01')
              proxyReq.setHeader('Content-Type',        'application/json')
            })
          },
        },

        // ── OpenAI GPT-4 ────────────────────────────────────────
        '/api/openai': {
          target:       'https://api.openai.com',
          changeOrigin: true,
          rewrite:      p => p.replace(/^\/api\/openai/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_OPENAI_API_KEY || ''}`)
              proxyReq.setHeader('Content-Type',  'application/json')
            })
          },
        },

        // ── Google Gemini ───────────────────────────────────────
        '/api/gemini': {
          target:       'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite:      p => p.replace(/^\/api\/gemini/, ''),
        },

        // ── Groq (Llama ultra-fast) ──────────────────────────────
        '/api/groq': {
          target:       'https://api.groq.com',
          changeOrigin: true,
          rewrite:      p => p.replace(/^\/api\/groq/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_GROQ_API_KEY || ''}`)
              proxyReq.setHeader('Content-Type',  'application/json')
            })
          },
        },
      },
    },
  }
})
