import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''
const EXAM_TYPES = [
  { value: 'CITOLOGIA_ONCOTICA', label: 'Citologia Oncótica' },
  { value: 'ANATOMO_PATOLOGICO', label: 'Anátomo Patológico' }
]

// 1..4 com cores claras
const PRIORITIES = [
  { value: 1, label: 'Emergência', color: '#ffe0e0' },    // vermelho claro
  { value: 2, label: 'Muito urgente', color: '#ffe9d6' }, // laranja claro
  { value: 3, label: 'Urgente', color: '#fff6cc' },       // amarelo claro
  { value: 4, label: 'Rotina', color: '#e6f7e6' }         // verde claro
]

export default function Iniciar() {
  const [convs, setConvs] = useState([]),
        [query, setQuery] = useState(''),
        [sug, setSug] = useState([])
  const [busy, setBusy] = useState(false),
        [msg, setMsg] = useState('')
  const [patientId, setPatientId] = useState(null),
        [name, setName] = useState(''),
        [birthdate, setBirthdate] = useState(''),
        [convenioId, setConvenioId] = useState('')
  const [examType, setExamType] = useState(EXAM_TYPES[0].value)
  const [priority, setPriority] = useState(4) // 4 = Rotina (default)
  const [notFound, setNotFound] = useState(false)

  // convenios
  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/patients/convenios`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      setConvs(await res.json())
    })()
  }, [])

  // busca por nome (autocomplete) + flag notFound
  useEffect(() => {
    if (!query || query.length < 2) {
      setSug([])
      setNotFound(false)
      return
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `${API}/patients/search?name=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      )
      const data = await res.json()
      setSug(data)
      setNotFound(Array.isArray(data) && data.length === 0)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  function selectSuggestion(p) {
    setPatientId(p.id)
    setName(p.name)
    setBirthdate(p.birthdate ? p.birthdate.substring(0, 10) : '')
    setConvenioId(p.convenio_id || '')
    setSug([])
    setQuery('')
    setNotFound(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const payload = {
        patient: {
          id: patientId,
          name,
          birthdate: birthdate || null,
          convenio_id: convenioId || null
        },
        exam: {
          type: examType,
          priority // <-- envia nível (1..4)
        }
      }
      const res = await fetch(`${API}/patients/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar paciente')
      setMsg(`Exame #${data.exam.id} criado para ${data.patient.name}`)
      setPriority(4)
      setExamType(EXAM_TYPES[0].value)
      setSug([])
      setNotFound(false)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  const input = { width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, marginBottom: 10 }
  const label = { display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 700 }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h3 style={{ marginTop: 0 }}>Iniciar Paciente</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <div>
            <label style={label}>Buscar paciente pelo nome</label>
            <input
              style={input}
              placeholder="Digite 2+ letras"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {sug.length > 0 && (
              <div style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff', marginTop: -6, marginBottom: 10 }}>
                {sug.map(p => (
                  <div
                    key={p.id}
                    onClick={() => selectSuggestion(p)}
                    style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f1f1' }}
                  >
                    {p.name} {p.birthdate ? `– ${p.birthdate.substring(0, 10)}` : ''}
                  </div>
                ))}
              </div>
            )}

            {notFound && (
              <div
                style={{
                  border: '1px solid #eab308',
                  background: '#fefce8',
                  color: '#713f12',
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginTop: 8,
                  marginBottom: 10
                }}
              >
                Nenhum paciente encontrado para <b>"{query}"</b>. Preencha os campos abaixo para cadastrar um novo paciente.
                <button
                  type="button"
                  onClick={() => {
                    setPatientId(null)
                    setName(query.trim())
                    setQuery('')
                  }}
                  style={{
                    marginLeft: 8,
                    padding: '6px 10px',
                    border: 'none',
                    borderRadius: 6,
                    background: '#0f766e',
                    color: '#fff',
                    fontWeight: 700
                  }}
                >
                  Usar esse nome
                </button>
              </div>
            )}
          </div>

          <div>
            <label style={label}>Nome</label>
            <input style={input} value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={label}>Data de nascimento</label>
              <input type="date" style={input} value={birthdate} onChange={e => setBirthdate(e.target.value)} />
            </div>
            <div>
              <label style={label}>Convênio</label>
              <select style={input} value={convenioId} onChange={e => setConvenioId(e.target.value)}>
                <option value=''>Selecione...</option>
                {convs.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={label}>Exame</label>
              <select style={input} value={examType} onChange={e => setExamType(e.target.value)}>
                {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* PRIORIDADE - substitui o checkbox de urgência */}
            <div>
              <label style={label}>Prioridade</label>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {PRIORITIES.map(p => (
                  <label
                    key={p.value}
                    className={p.value === priority ? 'prio active' : 'prio'}
                    style={{
                      display:'flex', alignItems:'center', gap:8,
                      padding:'8px 10px', border:'1px solid #dfe5ea',
                      borderRadius:8, cursor:'pointer',
                      background: p.value === priority ? '#f8fafc' : '#fff'
                    }}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={p.value}
                      checked={priority === p.value}
                      onChange={() => setPriority(p.value)}
                      style={{ display:'none' }}
                    />
                    <span style={{
                      width:18, height:18, borderRadius:'50%',
                      border:'1px solid #cfd8dc', background: p.color
                    }} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              disabled={busy}
              type="submit"
              style={{ padding: '10px 14px', border: 'none', borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 700 }}
            >
              {busy ? 'Salvando...' : 'Iniciar'}
            </button>
            {patientId && (
              <button
                type="button"
                onClick={() => { setPatientId(null); setName(''); setBirthdate(''); setConvenioId(''); setMsg(''); setNotFound(false); setPriority(4) }}
                style={{ padding: '10px 14px', border: '1px solid #ccc', borderRadius: 8, background: '#fff' }}
              >
                Limpar paciente
              </button>
            )}
          </div>

          {msg && <div style={{ color: msg.startsWith('Exame') ? '#0f766e' : '#b00020' }}>{msg}</div>}
        </div>
      </form>
    </div>
  )
}
