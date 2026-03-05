import { useState, useEffect } from 'react'

const T = {
  lime:  '#C6FF00',
  pink:  '#FF2D78',
  cyan:  '#00E5FF',
  green: '#00FF87',
  navy:  '#03030A',
  muted: 'rgba(255,255,255,0.38)',
}

const WALLETS = [
  { id: 'metamask',      name: 'MetaMask',       icon: '🦊', desc: 'Browser Extension',  tag: 'Paling Populer',    color: '#E2761B' },
  { id: 'walletconnect', name: 'WalletConnect',  icon: '🔗', desc: 'QR Code / Mobile',   tag: 'Multi-Chain',       color: '#3B99FC' },
  { id: 'coinbase',      name: 'Coinbase Wallet',icon: '💎', desc: 'Browser & Mobile',   tag: 'Mudah Digunakan',   color: '#0052FF' },
  { id: 'ledger',        name: 'Ledger',         icon: '🔐', desc: 'Hardware Wallet',    tag: 'Keamanan Maksimal', color: '#00FFAA' },
]

export default function WalletGate({ onConnect }) {
  const [step,     setStep]     = useState('home')  // home | select | connecting | error
  const [selected, setSelected] = useState(null)
  const [errMsg,   setErrMsg]   = useState('')
  const [dots,     setDots]     = useState(0)
  const [visible,  setVisible]  = useState(false)

  useEffect(() => { setTimeout(() => setVisible(true), 60) }, [])

  useEffect(() => {
    if (step !== 'connecting') return
    const t = setInterval(() => setDots(d => (d + 1) % 4), 380)
    return () => clearInterval(t)
  }, [step])

  const connect = async (wallet) => {
    setSelected(wallet)
    setStep('connecting')
    setErrMsg('')
    await new Promise(r => setTimeout(r, 700 + Math.random() * 500))
    // Demo: 5% chance gagal untuk realisme
    if (Math.random() < 0.05) {
      setErrMsg(`${wallet.name} menolak koneksi. Pastikan Anda menyetujui di wallet.`)
      setStep('error')
      return
    }
    const addr = '0x' + Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)).join('')
    onConnect(addr, wallet.name)
  }

  const transStyle = {
    opacity:   visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(28px)',
    transition: 'all 0.5s cubic-bezier(.16,1,.3,1)',
  }

  return (
    <div className='fixed inset-0 z-50 flex flex-col overflow-auto' style={{ background: T.navy }}>
      {/* Grid background */}
      <div className='fixed inset-0 pointer-events-none' style={{
        backgroundImage: `linear-gradient(rgba(198,255,0,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(198,255,0,0.015) 1px,transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      {/* Glow orbs */}
      <div className='fixed pointer-events-none' style={{ top: '8%', left: '15%', width: 700, height: 700,
        background: 'radial-gradient(ellipse, rgba(198,255,0,0.045) 0%, transparent 65%)', borderRadius: '50%' }} />
      <div className='fixed pointer-events-none' style={{ bottom: '5%', right: '8%', width: 500, height: 500,
        background: 'radial-gradient(ellipse, rgba(0,229,255,0.025) 0%, transparent 65%)', borderRadius: '50%' }} />

      <div className='relative flex-1 flex flex-col items-center justify-center px-4 py-12'>
        <div className='w-full max-w-[420px]' style={transStyle}>

          {/* ── HOME ─────────────────────────────────────────── */}
          {step === 'home' && (
            <div className='flex flex-col items-center'>
              {/* Logo */}
              <div className='mb-2' style={{
                width: 80, height: 80, borderRadius: 24,
                background: `linear-gradient(135deg,${T.lime},#88CC00)`,
                boxShadow: `0 0 60px rgba(198,255,0,0.4),0 0 120px rgba(198,255,0,0.15)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 38, fontWeight: 900, color: T.navy,
                fontFamily: 'Syne, sans-serif',
                animation: 'breathe 2.5s ease-in-out infinite',
              }}>W</div>

              <div className='mt-5 mb-1 text-center font-syne font-black text-white' style={{ fontSize: 36, letterSpacing: '-0.04em' }}>WITZ</div>
              <div className='text-xs tracking-widest uppercase mb-8' style={{ color: T.muted }}>AI Crypto Portfolio Advisor</div>

              {/* Lock Banner */}
              <div className='w-full flex items-start gap-3 px-5 py-4 rounded-2xl mb-6' style={{
                background: 'rgba(255,45,120,0.07)',
                border: '1px solid rgba(255,45,120,0.22)',
              }}>
                <span style={{ fontSize: 22, marginTop: 1 }}>🔒</span>
                <div>
                  <div className='font-bold text-sm mb-1' style={{ color: T.pink }}>Akses Dibatasi</div>
                  <div className='text-[12px] leading-relaxed' style={{ color: T.muted }}>
                    Anda harus menghubungkan wallet kripto untuk menggunakan WITZ. Tanpa wallet, semua fitur akan terkunci.
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className='w-full grid grid-cols-2 gap-2.5 mb-7'>
                {[
                  { icon: '📊', t: 'Harga Real-Time',    d: 'Update tiap 30 detik' },
                  { icon: '🤖', t: 'WITZ AI Advisor',    d: '4 model AI tersedia'  },
                  { icon: '⚠️', t: 'Analisis Risiko',    d: 'DeFi risk scoring'    },
                  { icon: '📈', t: 'Portofolio Lengkap', d: 'P&L, chart, analitik' },
                ].map((f, i) => (
                  <div key={i} className='flex items-start gap-2.5 p-3 rounded-xl' style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: `1px solid rgba(255,255,255,0.06)`,
                  }}>
                    <span style={{ fontSize: 16 }}>{f.icon}</span>
                    <div>
                      <div className='text-xs font-bold' style={{ color: 'rgba(255,255,255,0.82)' }}>{f.t}</div>
                      <div className='text-[10px]' style={{ color: T.muted }}>{f.d}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button onClick={() => setStep('select')}
                className='w-full py-4 rounded-2xl font-syne font-black text-base transition-all'
                style={{ background: `linear-gradient(135deg,${T.lime},#9ACA00)`, color: T.navy, fontSize: 16,
                  boxShadow: '0 0 35px rgba(198,255,0,0.3)' }}>
                Hubungkan Wallet untuk Masuk
              </button>

              <div className='mt-5 text-center text-[11px]' style={{ color: 'rgba(255,255,255,0.2)' }}>
                🔒 Read-only · Tidak meminta izin tanda tangan · Kunci tetap di perangkat Anda
              </div>
            </div>
          )}

          {/* ── SELECT WALLET ─────────────────────────────────── */}
          {step === 'select' && (
            <div>
              <button onClick={() => setStep('home')} className='flex items-center gap-2 mb-6 text-xs'
                style={{ color: T.muted }}>
                ← Kembali
              </button>
              <div className='font-syne font-black text-white text-2xl mb-1' style={{ letterSpacing: '-0.03em' }}>
                Pilih Wallet
              </div>
              <div className='text-sm mb-6' style={{ color: T.muted }}>Koneksikan dompet kripto Anda</div>

              <div className='space-y-3'>
                {WALLETS.map(w => (
                  <button key={w.id} onClick={() => connect(w)}
                    className='w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all duration-200 group'
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(198,255,0,0.05)'
                      e.currentTarget.style.border = '1px solid rgba(198,255,0,0.18)'
                      e.currentTarget.style.transform = 'translateX(4px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'
                      e.currentTarget.style.transform = 'translateX(0)'
                    }}>
                    <div className='w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0'
                      style={{ background: `${w.color}15`, border: `1px solid ${w.color}25` }}>
                      {w.icon}
                    </div>
                    <div className='flex-1'>
                      <div className='text-sm font-bold' style={{ color: 'rgba(255,255,255,0.88)' }}>{w.name}</div>
                      <div className='text-[11px]' style={{ color: T.muted }}>{w.desc}</div>
                    </div>
                    <div>
                      <span className='text-[10px] font-bold px-2 py-1 rounded-lg'
                        style={{ background: 'rgba(198,255,0,0.08)', color: `${T.lime}80`, border: '1px solid rgba(198,255,0,0.12)' }}>
                        {w.tag}
                      </span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.18)' }}>→</span>
                  </button>
                ))}
              </div>

              <div className='mt-5 px-4 py-3 rounded-xl text-center text-[11px]'
                style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)', color: T.muted }}>
                🔒 WITZ tidak pernah meminta izin signing. Kunci pribadi Anda aman.
              </div>
            </div>
          )}

          {/* ── CONNECTING ───────────────────────────────────── */}
          {step === 'connecting' && selected && (
            <div className='flex flex-col items-center text-center gap-6'>
              <div style={{
                width: 88, height: 88, borderRadius: 24,
                background: `${selected.color}15`,
                border: `2px solid ${selected.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 38,
                animation: 'spin-slow 3s linear infinite',
              }}>{selected.icon}</div>

              <div>
                <div className='font-syne font-black text-2xl text-white mb-2'>
                  Menghubungkan{'.'.repeat(dots)}
                </div>
                <div className='text-sm' style={{ color: T.muted }}>
                  Menunggu persetujuan dari {selected.name}
                </div>
              </div>

              <div className='w-full flex flex-col gap-3'>
                {['Memvalidasi wallet address', 'Memverifikasi kepemilikan', 'Mengenkripsi sesi'].map((s, i) => (
                  <div key={i} className='flex items-center gap-3 px-4 py-3 rounded-xl'
                    style={{ background: 'rgba(198,255,0,0.04)', border: '1px solid rgba(198,255,0,0.09)' }}>
                    <div className='w-4 h-4 rounded-full border-2 flex-shrink-0'
                      style={{ borderColor: `${T.lime}40`, borderTopColor: T.lime, animation: `spin ${0.8 + i * 0.2}s linear infinite` }} />
                    <span className='text-xs' style={{ color: T.muted }}>{s}</span>
                  </div>
                ))}
              </div>

              <p className='text-xs' style={{ color: T.muted }}>Buka {selected.name} dan setujui permintaan koneksi</p>
            </div>
          )}

          {/* ── ERROR ────────────────────────────────────────── */}
          {step === 'error' && (
            <div className='flex flex-col items-center text-center gap-5'>
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: 'rgba(255,45,120,0.1)',
                border: '2px solid rgba(255,45,120,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36,
              }}>⚠️</div>
              <div>
                <div className='font-syne font-black text-xl mb-2' style={{ color: T.pink }}>Koneksi Gagal</div>
                <div className='text-sm leading-relaxed' style={{ color: T.muted }}>{errMsg}</div>
              </div>
              <button onClick={() => connect(selected)}
                className='w-full py-3.5 rounded-2xl font-syne font-black'
                style={{ background: `linear-gradient(135deg,${T.lime},#9ACA00)`, color: T.navy }}>
                Coba Lagi
              </button>
              <button onClick={() => setStep('select')} className='text-xs' style={{ color: T.muted }}>
                Pilih wallet lain
              </button>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes breathe {
          0%,100%{box-shadow:0 0 40px rgba(198,255,0,0.35),0 0 80px rgba(198,255,0,0.1)}
          50%{box-shadow:0 0 70px rgba(198,255,0,0.6),0 0 140px rgba(198,255,0,0.2)}
        }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes spin-slow { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
