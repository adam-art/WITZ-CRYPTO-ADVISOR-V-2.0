export const Security = {
  sanitize:    s => String(s).replace(/<[^>]*>/g, '').trim().substring(0, 1000),
  maskAddress: a => a ? `${a.slice(0, 6)}····${a.slice(-4)}` : '',
  nonce:       () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  rateLimit: (() => {
    const calls = {}
    return (key, max = 20) => {
      const now = Date.now()
      calls[key] = (calls[key] || []).filter(t => now - t < 60000)
      if (calls[key].length >= max) return false
      calls[key].push(now)
      return true
    }
  })(),
}
