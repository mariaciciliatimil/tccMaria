import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''
function Col({ title, items=[], count=0 }) {
  return (
    <div style={{background:'#e6e8ea', borderRadius:12, padding:16, minHeight:360}}>
      <div style={{fontWeight:800, marginBottom:10}}>{title} {count ? `(${count})` : ''}</div>
      <div style={{display:'grid', gap:8}}>
        {items.map(it => (
          <div key={it.id} style={{background:'#fff', borderRadius:8, padding:'10px 12px', boxShadow:'0 6px 16px rgba(0,0,0,.06)'}}>
            <div style={{fontWeight:700}}>{it.patient_name || 'Paciente'}</div>
            <div style={{fontSize:12, color:'#555'}}>Exame: {it.type} {it.priority ? '• Prioritário' : ''}</div>
          </div>
        ))}
        {items.length === 0 && <div style={{color:'#666', fontSize:13}}>Sem itens</div>}
      </div>
    </div>
  )
}
export default function StatusBoard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => { (async()=>{ setLoading(true); try{ const res = await fetch(`${API}/exams/board`, { headers: { Authorization: `Bearer ${token()}` } }); const json = await res.json(); setData(json) } finally { setLoading(false) } })() }, [])
  return (
    <div>
      {loading && <div style={{textAlign:'center', margin:'16px 0'}}>Carregando...</div>}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24}}>
        <Col title="STATUS" count={data?.counts?.PENDENTE}     items={data?.columns?.PENDENTE || []} />
        <Col title="STATUS" count={data?.counts?.EM_ANDAMENTO} items={data?.columns?.EM_ANDAMENTO || []} />
        <Col title="STATUS" count={data?.counts?.CONCLUIDO}    items={data?.columns?.CONCLUIDO || []} />
      </div>
    </div>
  )
}
