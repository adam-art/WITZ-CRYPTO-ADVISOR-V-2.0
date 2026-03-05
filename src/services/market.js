// ═══════════════════════════════════════════════════════════
//  WITZ Market Data Service — CoinGecko Free API
//  Tidak memerlukan API key
// ═══════════════════════════════════════════════════════════

const BASE = '/api/coingecko'

export const COIN_IDS = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  SOL:   'solana',
  AAVE:  'aave',
  UNI:   'uniswap',
  LINK:  'chainlink',
  ARB:   'arbitrum',
  MATIC: 'matic-network',
}

export const HOLDINGS = {
  BTC: 0.842, ETH: 4.21, SOL: 28.5,
  AAVE: 12.3, UNI: 85.0, LINK: 45.0,
  ARB: 320,   MATIC: 210,
}

export const ASSET_META = {
  BTC:   { name: 'Bitcoin',   color: '#F7931A', risk: 'LOW',    sector: 'Store of Value' },
  ETH:   { name: 'Ethereum',  color: '#627EEA', risk: 'LOW',    sector: 'Smart Contract' },
  SOL:   { name: 'Solana',    color: '#9945FF', risk: 'MEDIUM', sector: 'Smart Contract' },
  AAVE:  { name: 'Aave',      color: '#B6509E', risk: 'MEDIUM', sector: 'DeFi Lending'   },
  UNI:   { name: 'Uniswap',   color: '#FF007A', risk: 'HIGH',   sector: 'DEX'            },
  LINK:  { name: 'Chainlink', color: '#2A5ADA', risk: 'MEDIUM', sector: 'Oracle'         },
  ARB:   { name: 'Arbitrum',  color: '#28A0F0', risk: 'HIGH',   sector: 'Layer 2'        },
  MATIC: { name: 'Polygon',   color: '#8247E5', risk: 'HIGH',   sector: 'Layer 2'        },
}

export async function fetchPrices() {
  const ids = Object.values(COIN_IDS).join(',')
  const res = await fetch(
    `${BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
  )
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const data = await res.json()

  return Object.entries(COIN_IDS).map(([sym, id]) => {
    const d    = data[id] || {}
    const price = d.usd            || 0
    const d24   = d.usd_24h_change || 0
    const amt   = HOLDINGS[sym]    || 0
    const meta  = ASSET_META[sym]  || {}
    return {
      sym, id,
      name:   meta.name   || sym,
      color:  meta.color  || '#888',
      risk:   meta.risk   || 'MEDIUM',
      sector: meta.sector || 'Other',
      price:  +price.toFixed(6),
      d24:    +d24.toFixed(2),
      mcap:   d.usd_market_cap || 0,
      vol24:  d.usd_24h_vol    || 0,
      amt,
      value:  +(amt * price).toFixed(2),
    }
  })
}

export async function fetchPortfolioHistory(days = 90) {
  const res = await fetch(`${BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`)
  if (!res.ok) throw new Error(`Chart ${res.status}`)
  const { prices } = await res.json()
  return prices.map(([ts, v], i) => ({
    i,
    date: new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    v:    +(v * 0.78).toFixed(2),
  }))
}

export async function fetchCoinChart(coinId, days = 30) {
  const res = await fetch(`${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`)
  if (!res.ok) throw new Error(`Chart ${res.status}`)
  const { prices } = await res.json()
  return prices.map(([ts, v], i) => ({
    i,
    date: new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    v:    +v.toFixed(4),
  }))
}

export async function fetchGlobal() {
  const res = await fetch(`${BASE}/global`)
  if (!res.ok) return null
  const { data } = await res.json()
  return {
    totalMcap:    data.total_market_cap?.usd                    || 0,
    totalVol:     data.total_volume?.usd                        || 0,
    btcDominance: data.market_cap_percentage?.btc               || 0,
    ethDominance: data.market_cap_percentage?.eth               || 0,
    change24h:    data.market_cap_change_percentage_24h_usd     || 0,
    activeCrypto: data.active_cryptocurrencies                  || 0,
  }
}

export async function fetchTrending() {
  const res = await fetch(`${BASE}/search/trending`)
  if (!res.ok) return []
  const { coins } = await res.json()
  return coins.slice(0, 7).map(c => ({
    name:  c.item.name,
    sym:   c.item.symbol,
    rank:  c.item.market_cap_rank,
    thumb: c.item.small,
  }))
}
