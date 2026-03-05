// ═══════════════════════════════════════════════════════════
//  WITZ Multi-AI Provider Service
//  Mendukung: Anthropic Claude, OpenAI GPT, Google Gemini, Groq Llama
//  API Key dibaca dari .env — TIDAK pernah disimpan di kode
// ═══════════════════════════════════════════════════════════

// ── Provider Registry ────────────────────────────────────────
export const PROVIDERS = {
  anthropic: {
    id:      'anthropic',
    name:    'Claude (Anthropic)',
    model:   'claude-sonnet-4-20250514',
    icon:    '◬',
    color:   '#C06AFF',
    envKey:  'VITE_ANTHROPIC_API_KEY',
    desc:    'Paling akurat untuk analisis keuangan',
    tag:     'Direkomendasikan',
  },
  openai: {
    id:      'openai',
    name:    'GPT-4o (OpenAI)',
    model:   'gpt-4o',
    icon:    '◈',
    color:   '#10A37F',
    envKey:  'VITE_OPENAI_API_KEY',
    desc:    'Model flagship OpenAI',
    tag:     'Populer',
  },
  gemini: {
    id:      'gemini',
    name:    'Gemini Pro (Google)',
    model:   'gemini-1.5-pro',
    icon:    '◑',
    color:   '#4285F4',
    envKey:  'VITE_GEMINI_API_KEY',
    desc:    'AI Google, kuat untuk riset pasar',
    tag:     'Gratis Tier Besar',
  },
  groq: {
    id:      'groq',
    name:    'Llama 3.3 (Groq)',
    model:   'llama-3.3-70b-versatile',
    icon:    '⬡',
    color:   '#F55036',
    envKey:  'VITE_GROQ_API_KEY',
    desc:    'Ultra-cepat, gratis, open-source',
    tag:     '100% Gratis',
  },
}

// ── Deteksi provider yang tersedia dari .env ─────────────────
export function getAvailableProviders() {
  return Object.values(PROVIDERS).filter(p => {
    const key = import.meta.env[p.envKey]
    return key && key.length > 10 && !key.includes('ganti-dengan')
  })
}

// ── System prompt builder (sama untuk semua provider) ────────
function buildSystemPrompt(assets, globalData) {
  const total  = assets.reduce((s, a) => s + a.value, 0)
  const pnl    = assets.reduce((s, a) => s + (a.value * a.d24 / 100), 0)

  const rows = assets
    .sort((a, b) => b.value - a.value)
    .map(a =>
      `  ${a.sym.padEnd(5)} | $${a.value.toFixed(0).padStart(8)} | ${a.d24 >= 0 ? '+' : ''}${a.d24}% 24h | ${a.alloc || ((a.value/total*100).toFixed(1))}% bobot | risiko: ${a.risk}`
    ).join('\n')

  const mkt = globalData
    ? `BTC Dom: ${globalData.btcDominance?.toFixed(1)}% | MCap Total: $${(globalData.totalMcap/1e12).toFixed(2)}T | Perubahan 24h: ${globalData.change24h >= 0 ? '+' : ''}${globalData.change24h?.toFixed(2)}%`
    : 'Data pasar sedang dimuat...'

  return `Kamu adalah WITZ AI, analis portofolio kripto elite yang tertanam dalam aplikasi WITZ. Kamu tajam, presisi, dan berbasis data.

═══ PORTOFOLIO LIVE ═══
Total Nilai : $${total.toFixed(0)}
P&L 24 Jam  : ${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(0)} (${pnl >= 0 ? '+' : ''}${total ? (pnl/total*100).toFixed(2) : 0}%)
Jumlah Aset : ${assets.length} posisi

${rows}

═══ KONTEKS PASAR ═══
${mkt}

ATURAN RESPONS:
- Gunakan angka spesifik dari portofolio di atas
- Jawab dalam Bahasa Indonesia yang jelas dan profesional
- Akhiri setiap respons dengan "⚡ SINYAL WITZ:" lalu 1 baris kesimpulan
- Maksimal 200 kata kecuali analisis mendalam diminta
- Ini untuk tujuan edukasi, bukan saran keuangan resmi`
}

// ── Anthropic Claude ─────────────────────────────────────────
async function callAnthropic(prompt, assets, globalData) {
  const res = await fetch('/api/anthropic/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      PROVIDERS.anthropic.model,
      max_tokens: 1000,
      system:     buildSystemPrompt(assets, globalData),
      messages:   [{ role: 'user', content: prompt }],
    }),
  })
  if (res.status === 401) throw new Error('KEY_INVALID')
  if (!res.ok)            throw new Error(`HTTP_${res.status}`)
  const d = await res.json()
  return d.content?.[0]?.text ?? 'Respons tidak tersedia.'
}

// ── OpenAI GPT ───────────────────────────────────────────────
async function callOpenAI(prompt, assets, globalData) {
  const res = await fetch('/api/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: PROVIDERS.openai.model,
      max_tokens: 1000,
      messages: [
        { role: 'system',  content: buildSystemPrompt(assets, globalData) },
        { role: 'user',    content: prompt },
      ],
    }),
  })
  if (res.status === 401) throw new Error('KEY_INVALID')
  if (!res.ok)            throw new Error(`HTTP_${res.status}`)
  const d = await res.json()
  return d.choices?.[0]?.message?.content ?? 'Respons tidak tersedia.'
}

// ── Google Gemini ────────────────────────────────────────────
async function callGemini(prompt, assets, globalData) {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  const url = `/api/gemini/v1beta/models/${PROVIDERS.gemini.model}:generateContent?key=${key}`
  const sys = buildSystemPrompt(assets, globalData)

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${sys}\n\nPertanyaan: ${prompt}` }]
      }],
      generationConfig: { maxOutputTokens: 1000 },
    }),
  })
  if (res.status === 400 || res.status === 403) throw new Error('KEY_INVALID')
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  const d = await res.json()
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Respons tidak tersedia.'
}

// ── Groq Llama ───────────────────────────────────────────────
async function callGroq(prompt, assets, globalData) {
  const res = await fetch('/api/groq/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: PROVIDERS.groq.model,
      max_tokens: 1000,
      messages: [
        { role: 'system',  content: buildSystemPrompt(assets, globalData) },
        { role: 'user',    content: prompt },
      ],
    }),
  })
  if (res.status === 401) throw new Error('KEY_INVALID')
  if (!res.ok)            throw new Error(`HTTP_${res.status}`)
  const d = await res.json()
  return d.choices?.[0]?.message?.content ?? 'Respons tidak tersedia.'
}

// ── Router utama ─────────────────────────────────────────────
const CALLERS = {
  anthropic: callAnthropic,
  openai:    callOpenAI,
  gemini:    callGemini,
  groq:      callGroq,
}

export async function askAI(prompt, assets, globalData, providerId) {
  const caller = CALLERS[providerId]
  if (!caller) throw new Error('PROVIDER_NOT_FOUND')

  const available = getAvailableProviders()
  const isAvail   = available.find(p => p.id === providerId)
  if (!isAvail)   throw new Error('KEY_NOT_SET')

  return caller(prompt, assets, globalData)
}
