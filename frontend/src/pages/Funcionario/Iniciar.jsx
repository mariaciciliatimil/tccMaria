import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''
const EXAM_TYPES = [{ value: 'CITOLOGIA_ONCOTICA', label: 'Citologia Oncótica' },{ value: 'ANATOMO_PATOLOGICO', label: 'Anátomo Patológico' }]
export default function Iniciar() {
  const [convs, setConvs] = useState([]), [query, setQuery] = useState(''), [sug, setSug] = useState([])
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  const [patientId, setPatientId] = useState(null), [name, setName] = useState(''), [birthdate, setBirthdate] = useState(''), [convenioId, setConvenioId] = useState('')
  const [urgency, setUrgency] = useState(false), [examType, setExamType] = useState(EXAM_TYPES[0].value)
  useEffect(()=>{ (async()=>{ const res = await fetch(`${API}/patients/convenios`, { headers:{ Authorization:`Bearer ${token()}` } }); setConvs(await res.json()) })() },[])
  useEffect(()=>{ if(!query||query.length<2){ setSug([]); return } const t=setTimeout(async()=>{ const res=await fetch(`${API}/patients/search?name=${encodeURIComponent(query)}`,{ headers:{Authorization:`Bearer ${token()}`}}); setSug(await res.json()) },300); return ()=>clearTimeout(t) },[query])
  function selectSuggestion(p){ setPatientId(p.id); setName(p.name); setBirthdate(p.birthdate? p.birthdate.substring(0,10):''); setConvenioId(p.convenio_id||''); setSug([]); setQuery('') }
  async function handleSubmit(e){ e.preventDefault(); setBusy(true); setMsg(''); try{ const payload={ patient:{ id:patientId, name, birthdate: birthdate||null, convenio_id: convenioId||null }, exam:{ type: examType, urgency } }; const res=await fetch(`${API}/patients/initiate`,{ method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body: JSON.stringify(payload)}); const data=await res.json(); if(!res.ok) throw new Error(data.error||'Falha ao iniciar paciente'); setMsg(`Exame #${data.exam.id} criado para ${data.patient.name}`); setUrgency(false); setExamType(EXAM_TYPES[0].value) } catch(err){ setMsg(err.message) } finally { setBusy(false) } }
  const input={width:'100%',padding:'10px 12px',border:'1px solid #ccc',borderRadius:8,marginBottom:10}, label={display:'block',fontSize:13,marginBottom:6,fontWeight:700}
  return (<div style={{maxWidth:720, margin:'0 auto'}}>
    <h3 style={{marginTop:0}}>Iniciar Paciente</h3>
    <form onSubmit={handleSubmit}>
      <div style={{display:'grid', gridTemplateColumns:'1fr', gap:16}}>
        <div>
          <label style={label}>Buscar paciente pelo nome</label>
          <input style={input} placeholder="Digite 2+ letras" value={query} onChange={e=>setQuery(e.target.value)} />
          {sug.length>0 && <div style={{border:'1px solid #ddd', borderRadius:8, background:'#fff', marginTop:-6, marginBottom:10}}>
            {sug.map(p=>(<div key={p.id} onClick={()=>selectSuggestion(p)} style={{padding:'8px 10px', cursor:'pointer', borderBottom:'1px solid #f1f1f1'}}>
              {p.name} {p.birthdate ? `– ${p.birthdate.substring(0,10)}` : ''}
            </div>))}
          </div>}
        </div>
        <div>
          <label style={label}>Nome</label>
          <input style={input} value={name} onChange={e=>setName(e.target.value)} required />
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
          <div>
            <label style={label}>Data de nascimento</label>
            <input type="date" style={input} value={birthdate} onChange={e=>setBirthdate(e.target.value)} />
          </div>
          <div>
            <label style={label}>Convênio</label>
            <select style={input} value={convenioId} onChange={e=>setConvenioId(e.target.value)}>
              <option value=''>Selecione...</option>
              {convs.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
          <div>
            <label style={label}>Exame</label>
            <select style={input} value={examType} onChange={e=>setExamType(e.target.value)}>
              {EXAM_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10, marginTop:26}}>
            <input id="urg" type="checkbox" checked={urgency} onChange={e=>setUrgency(e.target.checked)} />
            <label htmlFor="urg">Urgência</label>
          </div>
        </div>
        <div style={{display:'flex', gap:12}}>
          <button disabled={busy} type="submit" style={{padding:'10px 14px', border:'none', borderRadius:8, background:'#0f766e', color:'#fff', fontWeight:700}}>{busy?'Salvando...':'Iniciar'}</button>
          {patientId && <button type="button" onClick={()=>{ setPatientId(null); setName(''); setBirthdate(''); setConvenioId(''); setMsg(''); }} style={{padding:'10px 14px', border:'1px solid #ccc', borderRadius:8, background:'#fff'}}>Limpar paciente</button>}
        </div>
        {msg && <div style={{color: msg.startsWith('Exame') ? '#0f766e' : '#b00020'}}>{msg}</div>}
      </div>
    </form>
  </div>)
}
