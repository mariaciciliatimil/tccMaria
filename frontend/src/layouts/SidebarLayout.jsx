import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
const MENU = [
  { label: 'INICIAR PACIENTE', to: '/funcionario/iniciar' },
  { label: 'CONSULTAR',        to: '/funcionario/consultar' },
  { label: 'RELATÓRIO',        to: '/funcionario/relatorio' },
  { label: 'BANDEJAS',         to: '/funcionario/bandejas' },
]
function MenuItem({ to, label }) {
  const { pathname } = useLocation()
  const active = pathname.startsWith(to)
  return (
    <Link to={to} style={{ display:'block', padding:'10px 12px', borderRadius:8, color: active ? '#0b2a38' : '#083241', background: active ? 'rgba(255,255,255,.5)' : 'transparent', textDecoration:'none', fontWeight:700, letterSpacing:.3 }}>
      {label}
    </Link>
  )
}
export default function SidebarLayout({ title='SISTEMA DE RASTREAMENTO PATOLÓGICO' }) {
  return (
    <div style={{display:'grid', gridTemplateColumns:'260px 1fr', minHeight:'100vh'}}>
      <aside style={{background:'#8DC3DA', padding:24}}>
        <div style={{fontWeight:900, fontSize:28, marginBottom:24}}>SIRP</div>
        <nav style={{display:'grid', gap:10}}>{MENU.map(m => <MenuItem key={m.to} {...m} />)}</nav>
      </aside>
      <main style={{background:'#f5f7fa', padding:24}}>
        <h2 style={{textAlign:'center', marginTop:0, fontSize:18, letterSpacing:1}}>{title}</h2>
        <Outlet />
      </main>
    </div>
  )
}
