import React, { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''

// Sugestão de etapas comuns
const STEP_OPTIONS = ['RECEPCAO','MACROSCOPIA','PROCESSAMENTO','MICROSCOPIA','LAUDO','ENTREGA']

export default function Status() {
  const [examId, setExamId] = useState('')
  const [exam, setExam] = useState(null)
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [newStep, setNewStep] = useState(STEP_OPTIONS[0])
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }), [])

  async function load() {
    if (!examId) return
    setLoading(true); setMsg('')
    try {
      const [eRes, sRes] = await Promise.all([
        fetch(`${API}/exams/${examId}`, { headers }),
        fetch(`${API}/exams/${examId}/steps`, { headers }),
      ])
      if (!eRes.ok) throw new Error('Exame não encontrado')
      setExam(await eRes.json())
      setSteps(await sRes.json())
    } catch (err) {
      setExam(null); setSteps([]); setMsg(err.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { /* nada */ }, [])

  async function closeCurrent() {
    setMsg('')
    const res = await fetch(`${API}/exams/${examId}/steps/close-current`, { method: 'PATCH', headers })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Falha ao concluir etapa')
    await load()
    setMsg(`Etapa ${data.step} concluída`)
  }

  async function startNew() {
    setMsg('')
    const res = await fetch(`${API}/exams/${examId}/steps`, {
      method: 'POST', headers, body: JSON.stringify({ step: newStep })
    })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Falha ao iniciar nova etapa')
    await load()
    setMsg(`Etapa ${data.step} iniciada`)
  }

  async function toggleStep(step) {
    // alterna entre EM_ANDAMENTO e CONCLUIDO
    setMsg('')
    const desired = step.status === 'CONCLUIDO' ? 'EM_ANDAMENTO' : 'CONCLUIDO'
    const res = await fetch(`${API}/exams/steps/${step.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ status: desired })
    })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Falha ao editar etapa')
    await load()
    setMsg(`Etapa ${data.step} agora está ${data.status}`)
  }

  const box = { background:'#fff', padding:16, borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.06)' }
  const pill = st => ({
    display:'inline-block', padding:'2px 8px', borderRadius:999,
    background: st==='CONCLUIDO' ? '#DCFCE7' : st==='EM_ANDAMENTO' ? '#FEF9C3' : '#E5E7EB',
    color:'#0f172a', fontSize:12, fontWeight:700
  })

  return (
    <div style={{maxWidth:900, margin:'0 auto', display:'grid', gap:16}}>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <input value={examId} onChange={e=>setExamId(e.target.value)} placeholder="ID do exame"
               style={{width:180, padding:'10px 12px', border:'1px solid #ccc', borderRadius:8}} />
        <button onClick={load} style={{padding:'10px 14px', borderRadius:8, border:'1px solid #ccc', background:'#fff'}}>Buscar</button>
      </div>

      {msg && <div style={{color: msg.includes('Falha') || msg.includes('não') ? '#b00020' : '#0f766e'}}>{msg}</div>}

      {exam && (
        <div style={box}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <div style={{fontWeight:800}}>Exame #{exam.id} — {exam.type}{exam.priority ? ' • Prioritário' : ''}</div>
              <div style={{color:'#555'}}>Paciente: {exam.patient_name} {exam.birthdate ? `(${exam.birthdate?.substring(0,10)})` : ''}</div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <select value={newStep} onChange={e=>setNewStep(e.target.value)} style={{padding:'8px 10px', border:'1px solid #ccc', borderRadius:8}}>
                {STEP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={startNew} style={{padding:'8px 12px', border:'none', borderRadius:8, background:'#0f766e', color:'#fff', fontWeight:700}}>Iniciar nova etapa</button>
              <button onClick={closeCurrent} style={{padding:'8px 12px', border:'1px solid #ccc', borderRadius:8, background:'#fff'}}>Concluir etapa atual</button>
            </div>
          </div>

          <hr style={{margin:'16px 0'}}/>

          <div style={{display:'grid', gap:8}}>
            {steps.map(s => (
              <div key={s.id} style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700}}>{s.step}</div>
                  <div style={{fontSize:12, color:'#555'}}>
                    Início: {new Date(s.started_at).toLocaleString()} {s.finished_at ? ` • Fim: ${new Date(s.finished_at).toLocaleString()}` : ''}
                  </div>
                </div>
                <div><span style={pill(s.status)}>{s.status}</span></div>
                <div>
                  <button onClick={()=>toggleStep(s)} style={{padding:'6px 10px', borderRadius:8, border:'1px solid #ccc', background:'#fff'}}>
                    {s.status === 'CONCLUIDO' ? 'Reabrir' : 'Concluir'}
                  </button>
                </div>
              </div>
            ))}
            {steps.length === 0 && <div style={{color:'#777'}}>Sem etapas registradas.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
