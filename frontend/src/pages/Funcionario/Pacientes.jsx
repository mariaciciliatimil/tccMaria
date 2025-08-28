import React, { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''
const EXAM_TYPES = [
  { value: 'CITOLOGIA_ONCOTICA', label: 'Citologia Oncótica' },
  { value: 'ANATOMO_PATOLOGICO', label: 'Anátomo Patológico' }
]

export default function Pacientes() {
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [convs, setConvs] = useState([])
  const [msg, setMsg] = useState('')

  // form create/edit
  const [editing, setEditing] = useState(null) // {id,name,birthdate,convenio_id}
  const [form, setForm] = useState({ name: '', birthdate: '', convenio_id: '' })

  // associate exam
  const [examOpenId, setExamOpenId] = useState(null)
  const [examType, setExamType] = useState(EXAM_TYPES[0].value)
  const [examUrg, setExamUrg] = useState(false)

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }), [])

  async function load() {
    setLoading(true)
    try {
      const url = q && q.length >= 2 ? `${API}/patients?q=${encodeURIComponent(q)}` : `${API}/patients`
      const res = await fetch(url, { headers })
      setList(await res.json())
    } finally { setLoading(false) }
  }

  useEffect(() => { (async () => {
    const r = await fetch(`${API}/patients/convenios`, { headers })
    setConvs(await r.json())
  })() }, [])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [q])

  function startCreate() {
    setEditing(null)
    setForm({ name: '', birthdate: '', convenio_id: '' })
    setMsg('')
  }
  function startEdit(p) {
    setEditing(p)
    setForm({
      name: p.name || '',
      birthdate: p.birthdate ? p.birthdate.substring(0,10) : '',
      convenio_id: p.convenio_id || ''
    })
    setMsg('')
  }
  async function submitForm(e) {
    e.preventDefault()
    setMsg('')
    const method = editing ? 'PATCH' : 'POST'
    const url = editing ? `${API}/patients/${editing.id}` : `${API}/patients`
    const res = await fetch(url, { method, headers, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Falha ao salvar')
    setMsg(editing ? 'Paciente atualizado' : 'Paciente criado')
    setEditing(null)
    setForm({ name:'', birthdate:'', convenio_id:'' })
    load()
  }
  async function associateExam(id) {
    setMsg('')
    const res = await fetch(`${API}/patients/${id}/exams`, {
      method: 'POST', headers, body: JSON.stringify({ type: examType, urgency: examUrg })
    })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Falha ao associar exame')
    setMsg(`Exame #${data.exam.id} criado para paciente #${id}`)
    setExamOpenId(null); setExamType(EXAM_TYPES[0].value); setExamUrg(false)
    load()
  }

  const input = { width:'100%', padding:'10px 12px', border:'1px solid #ccc', borderRadius:8, marginBottom:10 }
  const label = { display:'block', fontSize:13, marginBottom:6, fontWeight:700 }

  return (
    <div style={{maxWidth:980, margin:'0 auto', display:'grid', gap:16}}>
      <div style={{display:'flex', gap:12, alignItems:'center'}}>
        <input style={{...input, maxWidth:360, marginBottom:0}} placeholder="Buscar por nome (2+ letras)" value={q} onChange={e=>setQ(e.target.value)} />
        <button onClick={load} style={{padding:'10px 14px', border:'1px solid #ccc', borderRadius:8, background:'#fff'}}>Atualizar</button>
        <button onClick={startCreate} style={{padding:'10px 14px', border:'none', borderRadius:8, background:'#0f766e', color:'#fff', fontWeight:700}}>Novo paciente</button>
      </div>

      {(editing!==null || form.name || form.birthdate || form.convenio_id) && (
        <form onSubmit={submitForm} style={{background:'#fff', padding:16, borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.06)'}}>
          <h3 style={{marginTop:0}}>{editing ? 'Editar Paciente' : 'Cadastrar Paciente'}</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <div>
              <label style={label}>Nome</label>
              <input required style={input} value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
            </div>
            <div>
              <label style={label}>Data de nascimento</label>
              <input type="date" style={input} value={form.birthdate} onChange={e=>setForm({...form, birthdate:e.target.value})} />
            </div>
            <div>
              <label style={label}>Convênio</label>
              <select style={input} value={form.convenio_id} onChange={e=>setForm({...form, convenio_id:e.target.value})}>
                <option value=''>Selecione...</option>
                {convs.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:'flex', gap:10}}>
            <button type="submit" style={{padding:'10px 14px', border:'none', borderRadius:8, background:'#0f766e', color:'#fff', fontWeight:700}}>
              {editing ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            <button type="button" onClick={()=>{ setEditing(null); setForm({ name:'', birthdate:'', convenio_id:'' }) }} style={{padding:'10px 14px', border:'1px solid #ccc', borderRadius:8, background:'#fff'}}>Cancelar</button>
          </div>
        </form>
      )}

      {msg && <div style={{color: msg.startsWith('Exame') || msg.includes('atualizado') || msg.includes('criado') ? '#0f766e' : '#b00020'}}>{msg}</div>}

      <div style={{background:'#fff', padding:16, borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.06)'}}>
        <h3 style={{marginTop:0}}>Pacientes {loading && <small style={{color:'#777'}}>carregando...</small>}</h3>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th style={{textAlign:'left', padding:8}}>Nome</th>
              <th style={{textAlign:'left', padding:8}}>Nascimento</th>
              <th style={{textAlign:'left', padding:8}}>Convênio</th>
              <th style={{textAlign:'left', padding:8}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id} style={{borderTop:'1px solid #eee'}}>
                <td style={{padding:8}}>{p.name}</td>
                <td style={{padding:8}}>{p.birthdate ? p.birthdate.substring(0,10) : '-'}</td>
                <td style={{padding:8}}>{p.convenio_nome || '-'}</td>
                <td style={{padding:8}}>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    <button onClick={()=>startEdit(p)} style={{padding:'6px 10px', borderRadius:8, border:'1px solid #ccc', background:'#fff'}}>Editar</button>
                    <button onClick={()=>setExamOpenId(examOpenId===p.id?null:p.id)} style={{padding:'6px 10px', borderRadius:8, border:'1px solid #ccc', background:'#fff'}}>Associar exame</button>
                  </div>
                  {examOpenId === p.id && (
                    <div style={{marginTop:8, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:12}}>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                        <div>
                          <label style={label}>Tipo</label>
                          <select style={input} value={examType} onChange={e=>setExamType(e.target.value)}>
                            {EXAM_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:10, marginTop:26}}>
                          <input id={`urg-${p.id}`} type="checkbox" checked={examUrg} onChange={e=>setExamUrg(e.target.checked)} />
                          <label htmlFor={`urg-${p.id}`}>Urgência</label>
                        </div>
                      </div>
                      <div style={{display:'flex', gap:8}}>
                        <button onClick={()=>associateExam(p.id)} style={{padding:'8px 12px', border:'none', borderRadius:8, background:'#0f766e', color:'#fff', fontWeight:700}}>Criar exame</button>
                        <button onClick={()=>setExamOpenId(null)} style={{padding:'8px 12px', border:'1px solid #ccc', borderRadius:8, background:'#fff'}}>Fechar</button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && <tr><td colSpan="4" style={{padding:8, color:'#777'}}>Nenhum paciente.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
