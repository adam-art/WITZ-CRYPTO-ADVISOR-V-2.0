import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, LineChart, Line,
} from 'recharts'
import WalletGate from './components/WalletGate.jsx'
import { fetchPrices, fetchPortfolioHistory, fetchCoinChart, fetchGlobal, fetchTrending, COIN_IDS } from './services/market.js'
import { askAI, getAvailableProviders, PROVIDERS } from './services/ai.js'
import { Security } from './services/security.js'

// ─── THEME ───────────────────────────────────────────────────
const T = {
  lime:   '#C6FF00',
  pink:   '#FF2D78',
  cyan:   '#00E5FF',
  green:  '#00FF87',
  navy:   '#03030A',
  border: 'rgba(198,255,0,0.08)',
  card:   'rgba(198,255,0,0.022)',
  text:   'rgba(255,255,255,0.88)',
  muted:  'rgba(255,255,255,0.38)',
}

// ─── HELPERS ─────────────────────────────────────────────────
const fmt = (n, d = 0) => (+n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtC = n =>
  n >= 1e12 ? `$${(n/1e12).toFixed(2)}T` :
  n >= 1e9  ? `$${(n/1e9).toFixed(1)}B`  :
  n >= 1e6  ? `$${(n/1e6).toFixed(1)}M`  : `$${fmt(n)}`

// ─── ANIMATED COUNTER ─────────────────────────────────────────
function useCount(target, dur = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!target) return
    let cur = 0, id
    const step = target / (dur / 16)
    id = setInterval(() => { cur = Math.min(cur + step, target); setV(cur); if (cur >= target) clearInterval(id) }, 16)
    return () => clearInterval(id)
  }, [target])
  return v
}
const Counter = ({ val, pre = '', suf = '', dec = 0 }) => {
  const v = useCount(val)
  return <>{pre}{fmt(v, dec)}{suf}</>
}

// ─── UI COMPONENTS ────────────────────────────────────────────
const Card = ({ children, className = '', glow = false, onClick, style = {} }) => (
  <div onClick={onClick} className={`relative rounded-2xl overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
    style={{ background: glow ? 'linear-gradient(135deg,rgba(198,255,0,0.04),rgba(198,255,0,0.01))' : T.card,
      border: `1px solid ${glow ? 'rgba(198,255,0,0.14)' : T.border}`,
      boxShadow: glow ? '0 0 40px rgba(198,255,0,0.06)' : 'none', ...style }}>
    {children}
  </div>
)

const Pill = ({ children, color = 'lime' }) => {
  const map = {
    lime:   { bg: 'rgba(198,255,0,0.1)',   text: T.lime,    border: 'rgba(198,255,0,0.2)'   },
    cyan:   { bg: 'rgba(0,229,255,0.08)',  text: T.cyan,    border: 'rgba(0,229,255,0.18)'  },
    pink:   { bg: 'rgba(255,45,120,0.08)', text: T.pink,    border: 'rgba(255,45,120,0.18)' },
    orange: { bg: 'rgba(255,120,0,0.08)',  text: '#FF7800', border: 'rgba(255,120,0,0.18)'  },
    green:  { bg: 'rgba(0,255,135,0.08)',  text: T.green,   border: 'rgba(0,255,135,0.18)'  },
    dim:    { bg: 'rgba(255,255,255,0.05)',text: T.muted,   border: 'rgba(255,255,255,0.1)' },
  }
  const s = map[color] || map.dim
  return (
    <span className='inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide'
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {children}
    </span>
  )
}
const riskPill = r => <Pill color={{ LOW:'lime',MEDIUM:'orange',HIGH:'pink','VERY LOW':'cyan','VERY HIGH':'pink' }[r]||'dim'}>{r}</Pill>

const Spinner = ({ size = 16 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid rgba(198,255,0,0.2)`,
    borderTopColor: T.lime, animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
)

// ─── TICKER ───────────────────────────────────────────────────
function TickerBar({ assets }) {
  if (!assets.length) return null
  const items = [...assets, ...assets]
  return (
    <div style={{ height: 32, overflow: 'hidden', whiteSpace: 'nowrap', background: 'rgba(198,255,0,0.012)', borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: 'inline-block', animation: 'ticker 45s linear infinite' }}>
        {items.map((a, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 20px',
            borderRight: `1px solid ${T.border}`, height: 32, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
            <span style={{ color: a.color }}>{a.sym}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>${a.price < 1 ? a.price.toFixed(4) : fmt(a.price, 2)}</span>
            <span style={{ color: a.d24 >= 0 ? T.green : T.pink }}>{a.d24 >= 0 ? '▲' : '▼'}{Math.abs(a.d24)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── SIDEBAR ──────────────────────────────────────────────────
const NAV = [
  { id:'dashboard',    icon:'⬡', label:'Dashboard'    },
  { id:'portfolio',    icon:'◈', label:'Portofolio'   },
  { id:'ai',           icon:'◬', label:'WITZ AI'      },
  { id:'defi',         icon:'◑', label:'DeFi Risk'    },
  { id:'transactions', icon:'◇', label:'Transaksi'    },
  { id:'analytics',   icon:'◔', label:'Analitik'      },
  { id:'market',       icon:'◫', label:'Market Live'  },
]

function Sidebar({ active, setActive, wallet, onDisconnect }) {
  return (
    <aside className='fixed left-0 top-0 h-screen flex flex-col z-50'
      style={{ width: 220, background: T.navy, borderRight: `1px solid ${T.border}` }}>
      <div className='px-5 pt-6 pb-4 flex items-center gap-3'>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: `linear-gradient(135deg,${T.lime},#88CC00)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900,
          color: T.navy, fontFamily: 'Syne, sans-serif', boxShadow: '0 0 24px rgba(198,255,0,0.35)' }}>W</div>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>WITZ</div>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 3 }}>AI Portfolio</div>
        </div>
      </div>

      {/* Wallet chip */}
      <div className='mx-4 mb-4 p-3 rounded-xl' style={{ background: 'rgba(0,255,135,0.04)', border: '1px solid rgba(0,255,135,0.12)' }}>
        <div className='flex items-center gap-1.5 mb-1'>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, display: 'inline-block', animation: 'pulse 2s infinite' }}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.green }}>Wallet Terhubung</span>
        </div>
        <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: T.muted }}>{Security.maskAddress(wallet)}</div>
        <button onClick={onDisconnect} style={{ marginTop: 8, fontSize: 10, color: T.pink, fontWeight: 600 }}>
          Putuskan Koneksi
        </button>
      </div>

      <nav className='flex-1 px-3 space-y-0.5 overflow-y-auto'>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setActive(n.id)}
            className='w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150'
            style={{ color: active === n.id ? T.lime : T.muted, background: active === n.id ? 'rgba(198,255,0,0.08)' : 'transparent' }}>
            <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{n.icon}</span>
            {n.label}
            {active === n.id && <div className='ml-auto rounded-full' style={{ width: 2, height: 14, background: T.lime, opacity: 0.7 }}/>}
          </button>
        ))}
      </nav>

      <div className='p-4'>
        <div className='rounded-xl p-3' style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)' }}>
          <div style={{ fontSize: 9, color: 'rgba(0,229,255,0.45)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Keamanan</div>
          <div className='flex flex-wrap gap-1'>
            {['E2E','AES','RLS','CSP'].map(t => (
              <span key={t} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                background: 'rgba(0,229,255,0.07)', color: 'rgba(0,229,255,0.5)', border: '1px solid rgba(0,229,255,0.12)' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─── TOPBAR ───────────────────────────────────────────────────
function Topbar({ page, loading, globalData }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <header className='flex-shrink-0 flex items-center justify-between px-7 py-3'
      style={{ background: 'rgba(3,3,10,0.9)', backdropFilter: 'blur(18px)', borderBottom: `1px solid ${T.border}` }}>
      <div className='flex items-center gap-3'>
        <span style={{ fontSize: 12, color: T.muted }}>WITZ · <span style={{ color: 'rgba(255,255,255,0.3)' }}>{NAV.find(n=>n.id===page)?.label || page}</span></span>
        {globalData && (
          <div className='hidden lg:flex items-center gap-3 text-[11px] font-mono ml-2'>
            <span style={{ color: T.muted }}>MCap <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmtC(globalData.totalMcap)}</span></span>
            <span style={{ color: T.muted }}>BTC Dom <span style={{ color: T.lime }}>{globalData.btcDominance?.toFixed(1)}%</span></span>
            <span style={{ color: globalData.change24h >= 0 ? T.green : T.pink }}>
              {globalData.change24h >= 0 ? '▲' : '▼'}{Math.abs(globalData.change24h)?.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      <div className='flex items-center gap-4'>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: T.muted }}>{time.toLocaleTimeString('id-ID', { hour12: false })}</span>
        {loading
          ? <div className='flex items-center gap-1.5'><Spinner size={12}/><span style={{ fontSize: 11, color: T.muted }}>Sinkronisasi...</span></div>
          : <div className='flex items-center gap-1.5'>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.lime, display: 'inline-block', animation: 'pulse 2s infinite' }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.lime }}>LIVE</span>
            </div>
        }
      </div>
    </header>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ assets, history, globalData, loading, onNav }) {
  const total  = assets.reduce((s, a) => s + a.value, 0)
  const dayPnl = assets.reduce((s, a) => s + (a.value * a.d24 / 100), 0)
  const pct    = total ? dayPnl / total * 100 : 0

  const sectorMap = {}
  assets.forEach(a => { sectorMap[a.sector] = (sectorMap[a.sector] || 0) + (a.value / total * 100) })
  const sectors  = Object.entries(sectorMap).map(([name, v]) => ({ name, value: +v.toFixed(1) }))
  const sPalette = [T.lime, '#627EEA', '#FF007A', '#28A0F0', '#F7931A', '#9945FF']

  const stats = [
    { label:'Nilai Portofolio', val:total, pre:'$', suf:'', dec:0, accent:T.lime, sub:`${pct>=0?'+':''}${pct.toFixed(2)}% hari ini` },
    { label:'P&L 24 Jam', val:Math.abs(dayPnl), pre:dayPnl>=0?'+$':'-$', suf:'', dec:0, accent:dayPnl>=0?T.green:T.pink, sub:dayPnl>=0?'Sesi menguntungkan':'Sesi merugi' },
    { label:'Total Aset', val:assets.length, pre:'', suf:' token', dec:0, accent:T.cyan, sub:'Posisi aktif' },
    { label:'Pasar Global 24j', val:globalData?Math.abs(globalData.change24h):0, pre:globalData&&globalData.change24h<0?'-':'+', suf:'%', dec:2, accent:globalData&&globalData.change24h<0?T.pink:T.green, sub:'Perubahan market cap' },
  ]

  return (
    <div className='space-y-5'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:'-0.03em', color:'#fff', lineHeight:1.1 }}>
            Ringkasan <span style={{ color:T.lime }}>Portofolio</span>
          </h1>
          <p style={{ fontSize:11, marginTop:4, color:T.muted }}>{loading?'Mengambil data live...':` Data live · ${new Date().toLocaleTimeString('id-ID')}`}</p>
        </div>
        <button onClick={() => onNav('ai')} className='px-4 py-2 rounded-xl text-xs font-bold'
          style={{ background:'rgba(198,255,0,0.07)', color:T.lime, border:`1px solid rgba(198,255,0,0.15)` }}>
          Tanya WITZ AI →
        </button>
      </div>

      <div className='grid grid-cols-4 gap-3'>
        {stats.map((s, i) => (
          <Card key={i} glow={i===0} className='p-5'>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:T.muted, marginBottom:12 }}>{s.label}</div>
            {loading && i===0 ? <div style={{ marginBottom:6 }}><Spinner size={18}/></div> : (
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:22, color:s.accent, lineHeight:1, marginBottom:6 }}>
                <Counter val={s.val} pre={s.pre} suf={s.suf} dec={s.dec}/>
              </div>
            )}
            <div style={{ fontSize:11, fontWeight:500, color:s.accent, opacity:0.65 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <div className='grid grid-cols-3 gap-4'>
        <Card className='col-span-2 p-5'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Performa Portofolio</div>
              <div style={{ fontSize:11, color:T.muted }}>Terindeks BTC · 90 hari terakhir</div>
            </div>
            {loading && <Spinner/>}
          </div>
          <ResponsiveContainer width='100%' height={170}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id='wGrad' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor={T.lime} stopOpacity={0.22}/>
                  <stop offset='100%' stopColor={T.lime} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey='date' tick={{ fill:T.muted, fontSize:9 }} tickLine={false} axisLine={false} interval={14}/>
              <YAxis hide domain={['auto','auto']}/>
              <Tooltip contentStyle={{ background:'#08080F', border:`1px solid rgba(198,255,0,0.2)`, borderRadius:10, fontSize:11, color:'#fff' }}
                formatter={v=>[`$${fmt(v)}`,'Nilai']} labelFormatter={l=>l}/>
              <Area type='monotone' dataKey='v' stroke={T.lime} strokeWidth={2} fill='url(#wGrad)'/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className='p-5'>
          <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)', marginBottom:2 }}>Per Sektor</div>
          <div style={{ fontSize:11, color:T.muted, marginBottom:12 }}>Alokasi saat ini</div>
          <div className='flex justify-center mb-3'>
            <PieChart width={130} height={130}>
              <Pie data={sectors} dataKey='value' cx={65} cy={65} innerRadius={36} outerRadius={60} paddingAngle={3}>
                {sectors.map((_, i) => <Cell key={i} fill={sPalette[i % sPalette.length]} opacity={0.9}/>)}
              </Pie>
            </PieChart>
          </div>
          {sectors.map((s, i) => (
            <div key={i} className='flex items-center justify-between mb-1.5'>
              <div className='flex items-center gap-2'>
                <div style={{ width:6, height:6, borderRadius:'50%', background:sPalette[i%sPalette.length] }}/>
                <span style={{ fontSize:11, color:T.muted }}>{s.name}</span>
              </div>
              <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:'rgba(255,255,255,0.5)' }}>{s.value}%</span>
            </div>
          ))}
        </Card>
      </div>

      <Card className='p-5'>
        <div className='flex items-center justify-between mb-4'>
          <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Aset Teratas</div>
          <button onClick={() => onNav('portfolio')} style={{ fontSize:12, fontWeight:700, color:`${T.lime}80` }}>Lihat semua →</button>
        </div>
        {assets.slice(0, 5).map(a => (
          <div key={a.sym} className='flex items-center gap-4 py-3 px-2 rounded-xl hover:bg-white/[0.02] transition-all'>
            <div style={{ width:36, height:36, borderRadius:10, background:`${a.color}18`, border:`1px solid ${a.color}28`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:a.color, fontFamily:'Syne,sans-serif', flexShrink:0 }}>
              {a.sym[0]}
            </div>
            <div className='flex-1 min-w-0'>
              <div style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.88)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
              <div style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>{a.amt} {a.sym}</div>
            </div>
            <div className='text-right'>
              <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:'rgba(255,255,255,0.75)' }}>${fmt(a.value)}</div>
              <div style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:a.d24>=0?T.green:T.pink }}>{a.d24>=0?'+':''}{a.d24}%</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ─── PORTFOLIO ────────────────────────────────────────────────
function Portfolio({ assets, loading }) {
  const [sort, setSort] = useState('value')
  const [risk, setRisk] = useState('ALL')
  const total = assets.reduce((s, a) => s + a.value, 0)
  const list  = useMemo(() => [...assets]
    .filter(a => risk === 'ALL' || a.risk === risk)
    .sort((a, b) => sort==='value'?b.value-a.value:sort==='d24'?b.d24-a.d24:(b.value/total)-(a.value/total))
  , [assets, sort, risk, total])

  const Hdr = ({ label, id }) => (
    <button onClick={() => setSort(id)} style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:sort===id?T.lime:T.muted }}>
      {label}{sort===id?' ↓':''}
    </button>
  )

  return (
    <div className='space-y-5'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:'-0.03em', color:'#fff' }}>Portofolio</h1>
          {loading && <Spinner/>}
        </div>
        <div className='flex gap-1.5'>
          {['ALL','LOW','MEDIUM','HIGH'].map(r => (
            <button key={r} onClick={() => setRisk(r)} className='px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all'
              style={{ background:risk===r?'rgba(198,255,0,0.1)':'transparent', color:risk===r?T.lime:T.muted,
                border:`1px solid ${risk===r?'rgba(198,255,0,0.2)':'rgba(255,255,255,0.06)'}` }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <Card className='overflow-hidden'>
        <div className='grid items-center gap-3 px-5 py-3 border-b' style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1.5fr 1fr', borderColor:T.border }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:T.muted }}>Aset</div>
          <Hdr label='Nilai'   id='value'/>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:T.muted }}>Harga</div>
          <Hdr label='24j'     id='d24'/>
          <Hdr label='Bobot'   id='alloc'/>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:T.muted }}>Risiko</div>
        </div>
        {list.map(a => {
          const w = total ? (a.value / total * 100) : 0
          return (
            <div key={a.sym} className='grid items-center gap-3 px-5 py-4 border-b hover:bg-white/[0.02] transition-all'
              style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1.5fr 1fr', borderColor:'rgba(255,255,255,0.03)' }}>
              <div className='flex items-center gap-3'>
                <div style={{ width:36, height:36, borderRadius:12, background:`${a.color}14`, border:`1px solid ${a.color}22`,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:a.color, fontFamily:'Syne,sans-serif', flexShrink:0 }}>
                  {a.sym[0]}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.85)' }}>{a.name}</div>
                  <div style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>{a.amt} {a.sym}</div>
                </div>
              </div>
              <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:'rgba(255,255,255,0.7)' }}>${fmt(a.value)}</div>
              <div style={{ fontSize:13, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>${a.price<1?a.price.toFixed(4):a.price.toLocaleString('en-US',{maximumFractionDigits:2})}</div>
              <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:a.d24>=0?T.green:T.pink }}>{a.d24>=0?'+':''}{a.d24}%</div>
              <div className='flex items-center gap-2'>
                <div style={{ height:6, borderRadius:3, flex:1, overflow:'hidden', maxWidth:96, background:'rgba(255,255,255,0.06)' }}>
                  <div style={{ height:'100%', borderRadius:3, width:`${Math.min(w*2.5,100)}%`, background:`${T.lime}70`, transition:'width 0.5s' }}/>
                </div>
                <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', fontWeight:700, width:40, textAlign:'right', color:'rgba(255,255,255,0.4)' }}>{w.toFixed(1)}%</span>
              </div>
              <div>{riskPill(a.risk)}</div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

// ─── WITZ AI PAGE ─────────────────────────────────────────────
function WitzAIPage({ assets, globalData }) {
  const available = getAvailableProviders()
  const [provider,  setProvider]  = useState(available[0]?.id || 'anthropic')
  const total = assets.reduce((s,a)=>s+a.value,0)
  const [msgs, setMsgs] = useState([{
    role:'ai',
    text:`WITZ AI siap! Portofolio live dimuat — $${fmt(total)} di ${assets.length} aset.\n\nTanya apa saja: analisis risiko, strategi rebalancing, peluang DeFi, atau sentimen pasar. Saya akan analisis angka spesifik Anda.`,
    t: new Date().toLocaleTimeString('id-ID',{hour12:false}),
    provider: provider,
  }])
  const [input, setInput] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [err,   setErr]   = useState(null)
  const bottom = useRef(null)

  useEffect(() => { bottom.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs])

  const quick = [
    { label:'Analisis Risiko',       q:'Analisis risiko portofolioiku. Beri skor 0-100 dan 3 risiko utama dengan cara mitigasinya.' },
    { label:'Strategi Rebalancing',  q:'Apakah saya perlu rebalancing? Berikan target alokasi spesifik untuk tiap aset.' },
    { label:'Peluang DeFi',          q:'Protokol DeFi mana yang paling cocok dengan profil risiko saya untuk yield farming?' },
    { label:'Performa Terbaik',      q:'Aset mana yang punya return terbaik risk-adjusted? Jelaskan alasannya dengan data.' },
  ]

  const send = useCallback(async text => {
    const clean = Security.sanitize(text)
    if (!clean || busy) return
    if (!available.length) { setErr('Belum ada API key yang dikonfigurasi. Tambahkan di file .env.local'); return }
    setErr(null)
    const t = new Date().toLocaleTimeString('id-ID',{hour12:false})
    setMsgs(m => [...m, { role:'user', text:clean, t }])
    setInput('')
    setBusy(true)
    try {
      const reply = await askAI(clean, assets, globalData, provider)
      setMsgs(m => [...m, { role:'ai', text:reply, t:new Date().toLocaleTimeString('id-ID',{hour12:false}), provider }])
    } catch(e) {
      const errMap = {
        KEY_NOT_SET:       '⚡ API key belum dikonfigurasi. Tambahkan di file .env.local',
        KEY_INVALID:       '⚡ API key tidak valid. Periksa kembali di console provider.',
        PROVIDER_NOT_FOUND:'⚡ Provider tidak ditemukan.',
      }
      const msg = errMap[e.message] || `⚡ Error: ${e.message}`
      setErr(msg)
      setMsgs(m => [...m, { role:'ai', text:msg, t:new Date().toLocaleTimeString('id-ID',{hour12:false}), provider }])
    }
    setBusy(false)
  }, [assets, globalData, provider, busy, available])

  const provInfo = PROVIDERS[provider]

  return (
    <div className='flex flex-col' style={{ height:'calc(100vh - 145px)' }}>
      <div className='flex-shrink-0 flex items-center justify-between mb-4'>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:'-0.03em', color:'#fff' }}>
            WITZ <span style={{ color:T.lime }}>AI</span>
          </h1>
          <p style={{ fontSize:11, marginTop:2, color:T.muted }}>Multi-AI · Konteks portofolio live</p>
        </div>
        {/* Provider selector */}
        <div className='flex items-center gap-2'>
          {available.length === 0 && (
            <div className='px-3 py-2 rounded-xl text-xs' style={{ background:'rgba(255,45,120,0.08)', border:'1px solid rgba(255,45,120,0.2)', color:T.pink }}>
              ⚠️ Tidak ada API key — tambahkan di .env.local
            </div>
          )}
          {available.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)}
              className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all'
              style={{
                background: provider===p.id ? `${p.color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${provider===p.id ? `${p.color}40` : 'rgba(255,255,255,0.07)'}`,
                color: provider===p.id ? p.color : T.muted,
              }}>
              <span>{p.icon}</span>
              <span style={{ maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name.split(' ')[0]}</span>
              {provider===p.id && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:`${p.color}20`, border:`1px solid ${p.color}30` }}>AKTIF</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Quick prompts */}
      <div className='flex-shrink-0 flex gap-2 flex-wrap mb-3'>
        {quick.map((q, i) => (
          <button key={i} onClick={() => send(q.q)} disabled={busy}
            className='px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40'
            style={{ background:'rgba(198,255,0,0.05)', color:`${T.lime}99`, border:'1px solid rgba(198,255,0,0.12)' }}>
            {q.label}
          </button>
        ))}
      </div>

      <Card className='flex-1 overflow-hidden flex flex-col min-h-0'>
        <div className='flex-1 overflow-y-auto p-5 space-y-4' style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(198,255,0,0.2) transparent' }}>
          {msgs.map((m, i) => {
            const p = m.provider && PROVIDERS[m.provider]
            return (
              <div key={i} className={`flex gap-3 ${m.role==='user'?'flex-row-reverse':''}`}>
                {m.role==='ai' && (
                  <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${p?.color||T.lime},${p?.color||'#88CC00'}80)`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:'#fff',
                    flexShrink:0, boxShadow:`0 0 14px ${p?.color||T.lime}30`, fontFamily:'Syne,sans-serif' }}>
                    {p?.icon || 'W'}
                  </div>
                )}
                <div className='max-w-[78%] rounded-2xl px-4 py-3'
                  style={{ background:m.role==='user'?'rgba(198,255,0,0.07)':'rgba(255,255,255,0.03)',
                    border:m.role==='user'?'1px solid rgba(198,255,0,0.15)':`1px solid ${T.border}` }}>
                  {m.role==='ai' && p && (
                    <div style={{ fontSize:9, fontWeight:700, color:p.color, opacity:0.7, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>{p.name}</div>
                  )}
                  <div style={{ fontSize:13, lineHeight:1.65, whiteSpace:'pre-wrap', color:m.role==='user'?'rgba(255,255,255,0.88)':T.muted }}>{m.text}</div>
                  <div style={{ fontSize:10, marginTop:6, fontFamily:'JetBrains Mono,monospace', color:'rgba(255,255,255,0.18)' }}>{m.t}</div>
                </div>
              </div>
            )
          })}
          {busy && (
            <div className='flex gap-3'>
              <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${provInfo?.color||T.lime},${provInfo?.color||'#88CC00'}80)`,
                display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, color:'#fff', flexShrink:0, fontFamily:'Syne,sans-serif' }}>
                {provInfo?.icon||'W'}
              </div>
              <div className='flex items-center gap-1.5 px-4 py-3 rounded-2xl'
                style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}` }}>
                {[0,1,2].map(d => (
                  <div key={d} style={{ width:6, height:6, borderRadius:'50%', background:`${provInfo?.color||T.lime}80`,
                    animation:`bounce 0.8s ${d*0.14}s ease-in-out infinite` }}/>
                ))}
              </div>
            </div>
          )}
          <div ref={bottom}/>
        </div>
        <div className='flex-shrink-0 p-4 border-t' style={{ borderColor:T.border }}>
          {err && <div style={{ fontSize:12, marginBottom:8, paddingLeft:4, color:T.pink }}>{err}</div>}
          <div className='flex gap-3'>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send(input)}
              placeholder='Tanya tentang portofolio, risiko, strategi DeFi, pasar kripto...'
              disabled={busy}
              style={{ flex:1, borderRadius:12, padding:'12px 16px', fontSize:13, outline:'none',
                background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}`, color:'rgba(255,255,255,0.8)', fontFamily:'DM Sans, sans-serif' }}/>
            <button onClick={()=>send(input)} disabled={busy||!input.trim()}
              style={{ padding:'12px 20px', borderRadius:12, fontSize:13, fontWeight:900, fontFamily:'Syne,sans-serif',
                background:`linear-gradient(135deg,${T.lime},#9ACA00)`, color:T.navy, boxShadow:'0 0 18px rgba(198,255,0,0.18)',
                opacity:busy||!input.trim()?0.3:1, transition:'opacity 0.2s' }}>
              KIRIM
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── DEFI RISK ────────────────────────────────────────────────
const DEFI = [
  { name:'Aave V3',    tvl:'$8.2B',  apy:'4.2%',  risk:18, rug:'VERY LOW', auditors:'Certik, Trail of Bits' },
  { name:'Uniswap V3', tvl:'$5.1B',  apy:'12.8%', risk:34, rug:'LOW',      auditors:'ABDK, Trail of Bits'   },
  { name:'Lido',       tvl:'$22.4B', apy:'3.8%',  risk:22, rug:'VERY LOW', auditors:'Sigma Prime'           },
  { name:'GMX',        tvl:'$1.1B',  apy:'28.5%', risk:62, rug:'MEDIUM',   auditors:'ABDK Consulting'       },
  { name:'Pendle',     tvl:'$340M',  apy:'45.2%', risk:78, rug:'HIGH',     auditors:'Ackee Blockchain'      },
  { name:'EigenLayer', tvl:'$12.8B', apy:'6.1%',  risk:45, rug:'MEDIUM',   auditors:'Sigma Prime'           },
]
const RADAR = [
  {m:'Smart Contract',v:72},{m:'Likuiditas',v:85},{m:'Pasar',v:58},{m:'Regulasi',v:65},{m:'Counterparty',v:78},{m:'Oracle',v:82}
]
function DeFiRisk({ assets, globalData }) {
  const [scanning, setScanning] = useState(false)
  const [report,   setReport]   = useState(null)
  const available = getAvailableProviders()

  const scan = async () => {
    if (!available.length) { setReport('Tambahkan API key AI di file .env.local untuk mengaktifkan AI Risk Scan.'); return }
    setScanning(true)
    try {
      const r = await askAI('Scan risiko portofolio lengkap: (1) Skor risiko 0-100. (2) 3 risiko utama dengan mitigasi. (3) Kualitas eksposur DeFi. (4) Satu rekomendasi rebalancing spesifik. Gunakan angka dari data saya.', assets, globalData, available[0].id)
      setReport(r)
    } catch { setReport('⚡ Scan gagal. Periksa konfigurasi API key di .env.local') }
    setScanning(false)
  }

  const rCol = r => r<30?T.green:r<60?'#FFB800':T.pink

  return (
    <div className='space-y-5'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:'-0.03em', color:'#fff' }}>
            Risiko <span style={{ color:T.lime }}>DeFi</span>
          </h1>
          <p style={{ fontSize:11, marginTop:2, color:T.muted }}>Matriks risiko protokol & AI scanning</p>
        </div>
        <button onClick={scan} disabled={scanning}
          style={{ padding:'10px 20px', borderRadius:12, fontSize:14, fontWeight:900, fontFamily:'Syne,sans-serif',
            background:`linear-gradient(135deg,${T.lime},#9ACA00)`, color:T.navy, opacity:scanning?0.5:1, cursor:scanning?'not-allowed':'pointer',
            display:'flex', alignItems:'center', gap:8 }}>
          {scanning?<><Spinner size={14}/>SCANNING...</>:'⬡ AI RISK SCAN'}
        </button>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <Card className='p-5'>
          <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)', marginBottom:16 }}>Radar Risiko</div>
          <div className='flex justify-center'>
            <RadarChart width={230} height={200} data={RADAR}>
              <PolarGrid stroke='rgba(255,255,255,0.06)'/>
              <PolarAngleAxis dataKey='m' tick={{ fill:T.muted, fontSize:10, fontFamily:'JetBrains Mono,monospace' }}/>
              <Radar dataKey='v' stroke={T.lime} fill={T.lime} fillOpacity={0.1} strokeWidth={1.5}/>
            </RadarChart>
          </div>
        </Card>
        <Card className='p-5 flex flex-col'>
          <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)', marginBottom:4 }}>Laporan AI</div>
          <div style={{ fontSize:11, color:T.muted, marginBottom:12 }}>Analisis real-time AI</div>
          {report
            ? <div style={{ flex:1, fontSize:12.5, lineHeight:1.65, overflowY:'auto', whiteSpace:'pre-wrap', color:T.muted, scrollbarWidth:'thin', scrollbarColor:'rgba(198,255,0,0.2) transparent' }}>{report}</div>
            : <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:12 }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:40, color:T.lime, opacity:0.1 }}>W</div>
                <p style={{ fontSize:12, color:T.muted }}>Klik "AI Risk Scan" untuk analisis risiko komprehensif berbasis data live Anda.</p>
              </div>
          }
        </Card>
      </div>

      <Card className='overflow-hidden'>
        <div className='px-5 py-4 border-b' style={{ borderColor:T.border }}>
          <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Matriks Risiko Protokol</div>
        </div>
        <div className='grid px-5 py-2.5 border-b' style={{ gridTemplateColumns:'1.5fr 1fr 1fr 1.2fr 1fr', borderColor:'rgba(255,255,255,0.03)' }}>
          {['Protokol','TVL','APY','Skor Risiko','Risiko Rug'].map(h => (
            <div key={h} style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:T.muted }}>{h}</div>
          ))}
        </div>
        {DEFI.map((p, i) => (
          <div key={i} className='grid items-center px-5 py-4 border-b hover:bg-white/[0.02] transition-all'
            style={{ gridTemplateColumns:'1.5fr 1fr 1fr 1.2fr 1fr', borderColor:'rgba(255,255,255,0.025)' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.82)' }}>{p.name}</div>
              <div style={{ fontSize:10, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>{p.auditors}</div>
            </div>
            <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:'rgba(255,255,255,0.55)' }}>{p.tvl}</div>
            <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:parseFloat(p.apy)>20?'#FFB800':T.green }}>{p.apy}</div>
            <div className='flex items-center gap-2'>
              <div style={{ flex:1, height:6, borderRadius:3, overflow:'hidden', maxWidth:64, background:'rgba(255,255,255,0.06)' }}>
                <div style={{ height:'100%', borderRadius:3, width:`${p.risk}%`, background:rCol(p.risk) }}/>
              </div>
              <span style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', fontWeight:700, width:20, color:rCol(p.risk) }}>{p.risk}</span>
            </div>
            {riskPill(p.rug)}
          </div>
        ))}
      </Card>
    </div>
  )
}

// ─── TRANSACTIONS ─────────────────────────────────────────────
const TXS_DATA = [
  { type:'BUY',   sym:'SOL',  amt:10,   ago:'2j lalu',  hash:'0x8f4a…2d1e', status:'CONFIRMED' },
  { type:'SELL',  sym:'ARB',  amt:50,   ago:'5j lalu',  hash:'0x3b2c…9f7a', status:'CONFIRMED' },
  { type:'STAKE', sym:'ETH',  amt:1.0,  ago:'1h lalu',  hash:'0xc1d8…4e2b', status:'CONFIRMED' },
  { type:'SWAP',  sym:'LINK', amt:15,   ago:'2h lalu',  hash:'0x7e3f…1c9d', status:'CONFIRMED' },
  { type:'BUY',   sym:'BTC',  amt:0.05, ago:'3h lalu',  hash:'0x4a8b…6d3f', status:'PENDING'   },
]
function Transactions({ assets }) {
  const pm = Object.fromEntries(assets.map(a => [a.sym, a.price]))
  const list = TXS_DATA.map(t => ({ ...t, val: +(t.amt * (pm[t.sym]||0)).toFixed(2) }))
  const cfg = {
    BUY:   { color:T.green,   bg:'rgba(0,255,135,0.07)',  b:'rgba(0,255,135,0.14)'  },
    SELL:  { color:T.pink,    bg:'rgba(255,45,120,0.07)', b:'rgba(255,45,120,0.14)' },
    STAKE: { color:'#9945FF', bg:'rgba(153,69,255,0.07)', b:'rgba(153,69,255,0.14)' },
    SWAP:  { color:T.cyan,    bg:'rgba(0,229,255,0.07)',  b:'rgba(0,229,255,0.14)'  },
  }
  return (
    <div className='space-y-5'>
      <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:'-0.03em', color:'#fff' }}>Transaksi</h1>
      <Card className='overflow-hidden'>
        <div className='grid px-5 py-3 border-b' style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr 1.5fr 1fr 1fr', borderColor:T.border }}>
          {['Tipe','Aset','Jumlah','Nilai Live','Tx Hash','Waktu','Status'].map(h => (
            <div key={h} style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:T.muted }}>{h}</div>
          ))}
        </div>
        {list.map((tx, i) => {
          const s = cfg[tx.type]
          return (
            <div key={i} className='grid items-center px-5 py-4 border-b hover:bg-white/[0.015] transition-all'
              style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr 1.5fr 1fr 1fr', borderColor:'rgba(255,255,255,0.025)' }}>
              <span style={{ fontSize:11, fontWeight:900, padding:'3px 10px', borderRadius:6, display:'inline-block',
                color:s.color, background:s.bg, border:`1px solid ${s.b}` }}>{tx.type}</span>
              <div style={{ fontSize:14, fontWeight:900, fontFamily:'Syne,sans-serif', color:'rgba(255,255,255,0.82)' }}>{tx.sym}</div>
              <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>{tx.amt}</div>
              <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:'rgba(255,255,255,0.65)' }}>${fmt(tx.val)}</div>
              <div style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'rgba(255,255,255,0.22)', cursor:'pointer' }}>{tx.hash}</div>
              <div style={{ fontSize:11, color:T.muted }}>{tx.ago}</div>
              <Pill color={tx.status==='CONFIRMED'?'green':'orange'}>{tx.status}</Pill>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

// ─── ANALYTICS ────────────────────────────────────────────────
function Analytics({ assets, btcChart, ethChart, loading }) {
  return (
    <div className='space-y-5'>
      <div className='flex items-center gap-3'>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:'-0.03em', color:'#fff' }}>Analitik</h1>
        {loading && <Spinner/>}
      </div>
      <div className='grid grid-cols-2 gap-4'>
        {[{label:'Bitcoin · 30H',data:btcChart,color:'#F7931A',id:'btc'},{label:'Ethereum · 30H',data:ethChart,color:'#627EEA',id:'eth'}].map((c,i)=>(
          <Card key={i} className='p-5'>
            <div className='flex items-center justify-between mb-4'>
              <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.7)' }}>{c.label}</div>
              {c.data.length>0 && <div style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>${fmt(c.data[c.data.length-1]?.v||0)}</div>}
            </div>
            {c.data.length===0?<div className='flex items-center justify-center h-28'><Spinner/></div>:(
              <ResponsiveContainer width='100%' height={120}>
                <AreaChart data={c.data}>
                  <defs>
                    <linearGradient id={`ag${i}`} x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='0%' stopColor={c.color} stopOpacity={0.22}/>
                      <stop offset='100%' stopColor={c.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey='date' tick={{ fill:T.muted, fontSize:9 }} tickLine={false} axisLine={false} interval={6}/>
                  <YAxis hide domain={['auto','auto']}/>
                  <Tooltip contentStyle={{ background:'#08080F', border:`1px solid ${T.border}`, borderRadius:8, fontSize:11, color:'#fff' }}
                    formatter={v=>[`$${fmt(v)}`,c.id.toUpperCase()]} labelFormatter={l=>l}/>
                  <Area type='monotone' dataKey='v' stroke={c.color} strokeWidth={1.5} fill={`url(#ag${i})`}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        ))}
      </div>
      <Card className='p-5'>
        <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)', marginBottom:20 }}>Performa 24J — Semua Aset</div>
        <ResponsiveContainer width='100%' height={220}>
          <BarChart data={assets} layout='vertical' margin={{ left:45 }}>
            <XAxis type='number' hide domain={['auto','auto']}/>
            <YAxis type='category' dataKey='sym' tick={{ fill:T.muted, fontSize:11, fontFamily:'JetBrains Mono,monospace' }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ background:'#08080F', border:`1px solid ${T.border}`, borderRadius:8, fontSize:11, color:'#fff' }}
              formatter={v=>[`${v>=0?'+':''}${v}%`,'24j']}/>
            <Bar dataKey='d24' radius={[0,4,4,0]}>
              {assets.map((a,i)=><Cell key={i} fill={a.d24>=0?T.green:T.pink} opacity={0.78}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

// ─── MARKET ───────────────────────────────────────────────────
function Market({ assets, trending, globalData, loading }) {
  return (
    <div className='space-y-5'>
      <div className='flex items-center gap-3'>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:26, letterSpacing:'-0.03em', color:'#fff' }}>
          Market <span style={{ color:T.lime }}>Live</span>
        </h1>
        {loading && <Spinner/>}
      </div>
      {globalData && (
        <div className='grid grid-cols-3 gap-3'>
          {[
            { label:'Total Market Cap',  val:fmtC(globalData.totalMcap), accent:T.lime   },
            { label:'Dominasi BTC',      val:`${globalData.btcDominance?.toFixed(1)}%`, accent:'#F7931A' },
            { label:'Perubahan 24J',     val:`${globalData.change24h>=0?'+':''}${globalData.change24h?.toFixed(2)}%`, accent:globalData.change24h>=0?T.green:T.pink },
          ].map((s,i)=>(
            <Card key={i} className='p-5'>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:T.muted, marginBottom:8 }}>{s.label}</div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, fontSize:22, color:s.accent }}>{s.val}</div>
            </Card>
          ))}
        </div>
      )}
      <Card className='overflow-hidden'>
        <div className='px-5 py-4 border-b' style={{ borderColor:T.border }}>
          <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Harga Live</div>
          <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>Refresh otomatis tiap 30 detik · CoinGecko</div>
        </div>
        <div className='grid px-5 py-2.5 border-b' style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', borderColor:'rgba(255,255,255,0.03)' }}>
          {['Aset','Harga','Perubahan 24J','Market Cap','Volume 24J'].map(h=>(
            <div key={h} style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:T.muted }}>{h}</div>
          ))}
        </div>
        {assets.map(a=>(
          <div key={a.sym} className='grid items-center px-5 py-4 border-b hover:bg-white/[0.02] transition-all'
            style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', borderColor:'rgba(255,255,255,0.025)' }}>
            <div className='flex items-center gap-3'>
              <div style={{ width:32, height:32, borderRadius:8, background:`${a.color}18`, border:`1px solid ${a.color}28`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:a.color, fontFamily:'Syne,sans-serif' }}>{a.sym[0]}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.85)' }}>{a.name}</div>
                <div style={{ fontSize:11, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>{a.sym}</div>
              </div>
            </div>
            <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:'rgba(255,255,255,0.8)' }}>
              ${a.price<1?a.price.toFixed(4):a.price.toLocaleString('en-US',{maximumFractionDigits:2})}
            </div>
            <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:a.d24>=0?T.green:T.pink }}>
              {a.d24>=0?'▲ +':'▼ '}{a.d24}%
            </div>
            <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>{fmtC(a.mcap)}</div>
            <div style={{ fontSize:14, fontFamily:'JetBrains Mono,monospace', color:T.muted }}>{fmtC(a.vol24)}</div>
          </div>
        ))}
      </Card>
      {trending.length>0 && (
        <Card className='p-5'>
          <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)', marginBottom:16 }}>🔥 Trending di CoinGecko</div>
          <div className='flex gap-2 flex-wrap'>
            {trending.map((t,i)=>(
              <div key={i} className='flex items-center gap-2 px-3 py-2 rounded-xl'
                style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}`, fontSize:12 }}>
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:700, color:T.muted }}>#{i+1}</span>
                {t.thumb&&<img src={t.thumb} alt={t.sym} style={{ width:16, height:16, borderRadius:'50%' }}/>}
                <span style={{ fontWeight:700, color:'rgba(255,255,255,0.8)' }}>{t.sym}</span>
                <span style={{ color:T.muted }}>{t.name}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  ROOT APP — Wallet Gate enforced
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [page,      setPage]      = useState('dashboard')
  const [wallet,    setWallet]    = useState(null)  // null = locked

  // Real-time data
  const [assets,    setAssets]    = useState([])
  const [history,   setHistory]   = useState([])
  const [btcChart,  setBtcChart]  = useState([])
  const [ethChart,  setEthChart]  = useState([])
  const [globalData,setGlobalData]= useState(null)
  const [trending,  setTrending]  = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    window.__hideSplash?.()
  }, [])

  // Load all data only after wallet connects
  useEffect(() => {
    if (!wallet) return
    loadAll()
    const t = setInterval(refreshPrices, 30000)
    return () => clearInterval(t)
  }, [wallet])

  const loadAll = async () => {
    setLoading(true)
    await Promise.allSettled([
      refreshPrices(),
      fetchPortfolioHistory(90).then(setHistory).catch(console.warn),
      fetchCoinChart('bitcoin',  30).then(setBtcChart).catch(console.warn),
      fetchCoinChart('ethereum', 30).then(setEthChart).catch(console.warn),
      fetchGlobal().then(d => d && setGlobalData(d)).catch(console.warn),
      fetchTrending().then(setTrending).catch(console.warn),
    ])
    setLoading(false)
  }

  const refreshPrices = async () => {
    try {
      const data = await fetchPrices()
      if (data.length) setAssets(data.sort((a,b)=>b.value-a.value))
    } catch(e) { console.warn('Price refresh:', e) }
  }

  const disconnect = () => {
    setWallet(null)
    setAssets([])
    setHistory([])
    setBtcChart([])
    setEthChart([])
    setGlobalData(null)
    setTrending([])
    setPage('dashboard')
  }

  // ── WALLET GATE: Jika tidak ada wallet, tampilkan lock screen ──
  if (!wallet) return <WalletGate onConnect={(addr, name) => setWallet(addr)} />

  const pages = {
    dashboard:    <Dashboard    assets={assets}  history={history}   globalData={globalData} loading={loading} onNav={setPage}/>,
    portfolio:    <Portfolio    assets={assets}  loading={loading}/>,
    ai:           <WitzAIPage  assets={assets}  globalData={globalData}/>,
    defi:         <DeFiRisk    assets={assets}  globalData={globalData}/>,
    transactions: <Transactions assets={assets}/>,
    analytics:    <Analytics   assets={assets}  btcChart={btcChart} ethChart={ethChart} loading={loading}/>,
    market:       <Market      assets={assets}  trending={trending} globalData={globalData} loading={loading}/>,
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#03030A;color:rgba(255,255,255,0.88);overflow:hidden}
        input,button,textarea{font-family:'DM Sans',sans-serif}
        input::placeholder{color:rgba(255,255,255,0.25)}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(198,255,0,0.2);border-radius:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes witz-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .witz-page{animation:witz-in 0.28s cubic-bezier(.16,1,.3,1) forwards}
      `}</style>

      <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#03030A' }}>
        {/* Ambient glow */}
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
          <div style={{ position:'absolute', top:'5%', left:'25%', width:700, height:500,
            background:'radial-gradient(ellipse, rgba(198,255,0,0.018) 0%, transparent 70%)', borderRadius:'50%' }}/>
          <div style={{ position:'absolute', bottom:'10%', right:'10%', width:400, height:400,
            background:'radial-gradient(ellipse, rgba(0,229,255,0.015) 0%, transparent 70%)', borderRadius:'50%' }}/>
        </div>

        <Sidebar active={page} setActive={setPage} wallet={wallet} onDisconnect={disconnect}/>

        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', marginLeft:220, zIndex:1 }}>
          <Topbar page={page} loading={loading} globalData={globalData}/>
          <TickerBar assets={assets}/>
          <main className='flex-1 overflow-y-auto witz-page' key={page} style={{ padding:'20px 28px' }}>
            {pages[page] || pages.dashboard}
          </main>
        </div>
      </div>
    </>
  )
}
