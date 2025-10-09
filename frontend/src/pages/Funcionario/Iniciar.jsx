import React, { useEffect, useState } from 'react'
import '../../styles/iniciar.css'   // CSS separado

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''

const EXAM_TYPES = [
  { value: 'CITOLOGIA_ONCOTICA', label: 'Citologia Oncótica' },
  { value: 'ANATOMO_PATOLOGICO', label: 'Anátomo Patológico' }
]

// 1..4 com cores claras (só para o indicador redondinho)
const PRIORITIES = [
  { value: 1, label: 'Emergência',    color: '#ffe0e0' },
  { value: 2, label: 'Muito urgente', color: '#ffe9d6' },
  { value: 3, label: 'Urgente',       color: '#fff6cc' },
  { value: 4, label: 'Rotina',        color: '#e6f7e6' }
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

  function limparPaciente() {
    setPatientId(null)
    setName('')
    setBirthdate('')
    setConvenioId('')
    setMsg('')
    setNotFound(false)
    setPriority(4)
  }

  return (
    <div className="iniciar-wrapper">
      {/* Título centralizado no topo */}
      <header className="page-header">
        <h1>SISTEMA DE RASTREAMENTO PATOLÓGICO</h1>
      </header>

      <main className="iniciar-container">
        <div className="iniciar-card">
          <h2>Iniciar Paciente</h2>

          <form onSubmit={handleSubmit} className="iniciar-form">
            {/* Buscar por nome */}
            <div className="form-group">
              <label className="label">Buscar paciente pelo nome</label>
              <input
                className="input"
                placeholder="Digite 2+ letras"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />

              {sug.length > 0 && (
                <div className="sug-list">
                  {sug.map(p => (
                    <div key={p.id} onClick={() => selectSuggestion(p)} className="sug-item">
                      {p.name} {p.birthdate ? `– ${p.birthdate.substring(0, 10)}` : ''}
                    </div>
                  ))}
                </div>
              )}

              {notFound && (
                <div className="alert-warn">
                  Nenhum paciente encontrado para <b>"{query}"</b>. Preencha os campos abaixo para cadastrar um novo paciente.
                  <button
                    type="button"
                    onClick={() => {
                      setPatientId(null)
                      setName(query.trim())
                      setQuery('')
                    }}
                    className="btn btn-ghost"
                  >
                    Usar esse nome
                  </button>
                </div>
              )}
            </div>

            {/* Nome */}
            <div className="form-group">
              <label className="label">Nome</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} required />
            </div>

            {/* Data + Convênio */}
            <div className="row-2">
              <div className="form-group">
                <label className="label">Data de nascimento</label>
                <input type="date" className="input" value={birthdate} onChange={e => setBirthdate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Convênio</label>
                <select className="input" value={convenioId} onChange={e => setConvenioId(e.target.value)}>
                  <option value=''>Selecione...</option>
                  {convs.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Exame + Prioridade */}
            <div className="row-2">
              <div className="form-group">
                <label className="label">Exame</label>
                <select className="input" value={examType} onChange={e => setExamType(e.target.value)}>
                  {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Prioridade</label>
                <div className="priority-group">
                  {PRIORITIES.map(p => (
                    <label
                      key={p.value}
                      className={`prio ${p.value === priority ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={p.value}
                        checked={priority === p.value}
                        onChange={() => setPriority(p.value)}
                      />
                      <span className="prio-dot" style={{ background: p.color }} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="actions">
              <button disabled={busy} type="submit" className="btn btn-primary">
                {busy ? 'Salvando...' : 'Iniciar'}
              </button>
              {patientId && (
                <button type="button" onClick={limparPaciente} className="btn btn-outline">
                  Limpar paciente
                </button>
              )}
            </div>

            {/* Mensagem */}
            {msg && (
              <div className={`msg ${msg.startsWith('Exame') ? 'ok' : 'err'}`}>
                {msg}
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  )
}
