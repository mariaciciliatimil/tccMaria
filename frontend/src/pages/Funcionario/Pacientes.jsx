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

  // === MODAL: iniciar preparo ===
  const [prepOpen, setPrepOpen] = useState(false)
  const [prepPatient, setPrepPatient] = useState(null)
  const [prepLoading, setPrepLoading] = useState(false)
  const [prepError, setPrepError] = useState('')
  const [prepExams, setPrepExams] = useState([]) // exames do paciente
  const [prepExamId, setPrepExamId] = useState('')
  const [prepLaminas, setPrepLaminas] = useState('')

  // responsáveis (novos)
  const [staff, setStaff] = useState([])            // lista de usuários aptos
  const [prepRespId, setPrepRespId] = useState('')  // id selecionado

  // (mantive se você ainda usa noutros lugares)
  const [examOpenId] = useState(null)
  const [examType] = useState(EXAM_TYPES[0].value)
  const [examUrg] = useState(false)

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }),
    []
  )

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

  // === Fluxo do modal de preparo ===
  const openPrep = async (patient) => {
    setPrepPatient(patient)
    setPrepOpen(true)
    setPrepLoading(true)
    setPrepError('')
    setPrepExams([])
    setPrepExamId('')
    setPrepLaminas('')
    setPrepRespId('')

    try {
      // 1) exam do paciente
      let res = await fetch(`${API}/patients/${patient.id}/exams`, { headers: { Authorization: `Bearer ${token()}` } })
      if (res.status === 404) {
        res = await fetch(`${API}/exams?patient_id=${patient.id}`, { headers: { Authorization: `Bearer ${token()}` } })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao carregar exames do paciente')
      const list = Array.isArray(data) ? data : (data.items || [])
      setPrepExams(list)
      setPrepExamId(list?.[0]?.id || '')

      // 2) responsáveis (carrega sempre para manter atualizado)
      const rStaff = await fetch(`${API}/exams/responsaveis`, { headers })
      const sData = await rStaff.json()
      if (!rStaff.ok) throw new Error(sData?.error || 'Falha ao carregar responsáveis')
      setStaff(sData)
    } catch (e) {
      setPrepError(e.message)
    } finally {
      setPrepLoading(false)
    }
  }

  const closePrep = () => {
    setPrepOpen(false)
    setPrepPatient(null)
    setPrepError('')
    setPrepExams([])
    setPrepExamId('')
    setPrepLaminas('')
    setPrepRespId('')
  }

  const savePrep = async () => {
    try {
      setPrepError('')
      if (!prepExamId) return setPrepError('Selecione um exame.')
      if (!prepLaminas || Number(prepLaminas) <= 0) return setPrepError('Informe a quantidade de lâminas (>0).')
      if (!prepRespId) return setPrepError('Selecione o responsável.')

      const res = await fetch(`${API}/exams/${prepExamId}/start-prep`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ laminas: Number(prepLaminas), responsavel_id: Number(prepRespId) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao iniciar preparo')

      setMsg(`Preparo iniciado no exame #${data.id} (${data.status}).`)
      closePrep()
      load()
    } catch (e) {
      setPrepError(e.message)
    }
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

      {msg && <div style={{color: msg.toLowerCase().includes('falha') ? '#b00020' : '#0f766e'}}>{msg}</div>}

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

                    {/* Iniciar preparo */}
                    <button
                      onClick={()=>openPrep(p)}
                      style={{padding:'6px 10px', borderRadius:8, border:'1px solid #ccc', background:'#fff'}}
                    >
                      Iniciar preparo
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && <tr><td colSpan="4" style={{padding:8, color:'#777'}}>Nenhum paciente.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal flutuante */}
      {prepOpen && (
        <div style={M.backdrop} onClick={closePrep}>
          <div style={M.modal} onClick={(e)=>e.stopPropagation()}>
            <h3 style={{marginTop:0}}>Iniciar preparo</h3>
            <div style={{fontSize:13, color:'#475569', marginBottom:12}}>
              Paciente: <b>{prepPatient?.name}</b>
            </div>

            {prepLoading ? (
              <div>Carregando…</div>
            ) : (
              <>
                {prepExams.length === 0 ? (
                  <div style={{color:'#b00020', marginBottom:12}}>
                    Este paciente não possui exames para iniciar preparo.
                  </div>
                ) : (
                  <div style={M.field}>
                    <label>Exame</label>
                    <select value={prepExamId} onChange={e=>setPrepExamId(e.target.value)} style={M.input}>
                      {prepExams.map(ex => (
                        <option key={ex.id} value={ex.id}>
                          #{ex.id} • {String(ex.type || '').replaceAll('_',' ')} {ex.priority ? '• Prioritário' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={M.field}>
                  <label>Qtd. de lâminas</label>
                  <input type="number" min="1" value={prepLaminas} onChange={e=>setPrepLaminas(e.target.value)} style={M.input}/>
                </div>

                <div style={M.field}>
                  <label>Responsável</label>
                  <select value={prepRespId} onChange={e=>setPrepRespId(e.target.value)} style={M.input}>
                    <option value="">Selecione...</option>
                    {staff.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.role ? `• ${u.role}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {prepError && <div style={{color:'#b00020', marginTop:6}}>{prepError}</div>}

                <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:14}}>
                  <button onClick={closePrep} style={M.btnGhost}>Cancelar</button>
                  <button onClick={savePrep} style={M.btnPrimary} disabled={prepExams.length===0}>Salvar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const M = {
  backdrop: { position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 },
  modal: { width:520, background:'#fff', borderRadius:12, padding:18, boxShadow:'0 10px 30px rgba(0,0,0,.2)' },
  field: { display:'flex', flexDirection:'column', gap:6, marginBottom:10 },
  input: { padding:'10px 12px', border:'1px solid #d0d5dd', borderRadius:8, outline:'none' },
  btnGhost: { padding:'10px 14px', borderRadius:10, border:'1px solid #d0d5dd', background:'#fff', cursor:'pointer' },
  btnPrimary:{ padding:'10px 14px', borderRadius:10, background:'#0ea5e9', color:'#fff', border:'none', cursor:'pointer' },
}
