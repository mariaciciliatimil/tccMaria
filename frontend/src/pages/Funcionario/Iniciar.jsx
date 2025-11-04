// src/pages/Funcionario/Iniciar.jsx
import React, { useEffect, useState } from 'react'
import '../../styles/iniciar.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''

const EXAM_TYPES = [
  { value: 'CITOLOGIA_ONCOTICA', label: 'Citologia Oncótica' },
  { value: 'ANATOMO_PATOLOGICO', label: 'Anátomo Patológico' },
]

// 1..4 com cores claras (apenas visual)
const PRIORITIES = [
  { value: 1, label: 'Emergência',    color: '#ffe0e0' },
  { value: 2, label: 'Muito urgente', color: '#ffe9d6' },
  { value: 3, label: 'Urgente',       color: '#fff6cc' },
  { value: 4, label: 'Rotina',        color: '#e6f7e6' },
]

// helpers
const onlyDigits = (s = '') => String(s).replace(/\D+/g, '')
const maskCPF = (v) => {
  const d = onlyDigits(v).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}
const maskPhone = (v) => {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 10) {
    // (67) 9999-9999
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  // (67) 99999-9999
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export default function Iniciar() {
  // dados básicos para iniciar
  const [convs, setConvs] = useState([])
  const [examType, setExamType] = useState(EXAM_TYPES[0].value)
  const [priority, setPriority] = useState(4)

  // busca/sugestões
  const [query, setQuery] = useState('')         // nome OU CPF
  const [sug, setSug] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [busySug, setBusySug] = useState(false)

  // formulário do paciente
  const [patientId, setPatientId] = useState(null)
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [convenioId, setConvenioId] = useState('')

  // UI
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // carregar convênios
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${API}/patients/convenios`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
        if (res.ok) setConvs(await res.json())
      } catch {}
    })()
  }, [])

  // autocomplete por nome (>=2) OU CPF (11 dígitos)
  useEffect(() => {
    const run = async () => {
      const q = query.trim()
      const digits = onlyDigits(q)
      if (!q || (q.length < 2 && digits.length !== 11)) {
        setSug([]); setNotFound(false); return
      }
      try {
        setBusySug(true)
        const res = await fetch(
          `${API}/patients/search?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token()}` } }
        )
        const data = res.ok ? await res.json() : []
        setSug(Array.isArray(data) ? data : [])
        setNotFound(Array.isArray(data) && data.length === 0)
      } catch {
        setSug([]); setNotFound(false)
      } finally {
        setBusySug(false)
      }
    }
    const t = setTimeout(run, 300)
    return () => clearTimeout(t)
  }, [query])

  function selectSuggestion(p) {
    setPatientId(p.id)
    setName(p.name || '')
    setCpf(maskCPF(p.cpf || ''))
    setPhone(maskPhone(p.phone || ''))
    setBirthdate(p.birthdate ? p.birthdate.substring(0, 10) : '')
    setConvenioId(p.convenio_id || '')
    setSug([])
    setQuery('')
    setNotFound(false)
  }

  function limparPaciente() {
    setPatientId(null)
    setName(''); setCpf(''); setPhone('')
    setBirthdate(''); setConvenioId('')
    setMsg(''); setNotFound(false)
    setPriority(4); setExamType(EXAM_TYPES[0].value)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setMsg('')

    // validações leves
    const cpfDigits = onlyDigits(cpf)
    if (cpfDigits && cpfDigits.length !== 11) {
      setBusy(false); setMsg('CPF inválido (11 dígitos).'); return
    }
    const phoneDigits = onlyDigits(phone)

    try {
      const payload = {
        patient: {
          id: patientId || undefined,
          name,
          cpf: cpfDigits || null,
          phone: phoneDigits || null,
          birthdate: birthdate || null,
          convenio_id: convenioId || null,
        },
        exam: { type: examType, priority },
      }

      const res = await fetch(`${API}/patients/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao iniciar paciente')

      setMsg(`Exame #${data.exam.id} criado para ${data.patient.name}`)
      // mantém dados do paciente; apenas reseta exam/prioridade
      setPriority(4); setExamType(EXAM_TYPES[0].value)
      setSug([]); setNotFound(false)
    } catch (err) {
      setMsg(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="iniciar-wrapper">
      <header className="page-header">
        <h1>SISTEMA DE RASTREAMENTO PATOLÓGICO</h1>
      </header>

      <main className="iniciar-container">
        <div className="iniciar-card">
          <h2>Iniciar Paciente</h2>

          <form onSubmit={handleSubmit} className="iniciar-form">
            {/* Buscar por nome ou CPF */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="label">Buscar paciente por nome ou CPF</label>
              <input
                className="input"
                placeholder="Digite 2+ letras ou CPF (11 dígitos)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {busySug && <div className="hint">buscando…</div>}

              {sug.length > 0 && (
                <div className="sug-list">
                  {sug.map((p) => (
                    <div key={p.id} onClick={() => selectSuggestion(p)} className="sug-item">
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div className="muted">
                        CPF: {maskCPF(p.cpf || '')} • Fone: {maskPhone(p.phone || '')}
                        {p.birthdate ? ` • Nasc.: ${p.birthdate.substring(0, 10)}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {notFound && (
                <div className="alert-warn">
                  Nenhum paciente encontrado para <b>"{query}"</b>. Preencha os campos abaixo para cadastrar.
                  <button
                    type="button"
                    onClick={() => {
                      setPatientId(null)
                      setName(query.replace(/\d/g, '').trim()) // se usuário digitou CPF, não polui o nome
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
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* CPF + Telefone */}
            <div className="row-2">
              <div className="form-group">
                <label className="label">CPF</label>
                <input
                  className="input"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  inputMode="numeric"
                  maxLength={14}
                />
              </div>
              <div className="form-group">
                <label className="label">Telefone</label>
                <input
                  className="input"
                  placeholder="(67) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  inputMode="tel"
                  maxLength={15}
                />
              </div>
            </div>

            {/* Data + Convênio */}
            <div className="row-2">
              <div className="form-group">
                <label className="label">Data de nascimento</label>
                <input
                  type="date"
                  className="input"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="label">Convênio</label>
                <select
                  className="input"
                  value={convenioId}
                  onChange={(e) => setConvenioId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {convs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Exame + Prioridade */}
            <div className="row-2">
              <div className="form-group">
                <label className="label">Exame</label>
                <select
                  className="input"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Prioridade</label>
                <div className="priority-group">
                  {PRIORITIES.map((p) => (
                    <label key={p.value} className={`prio ${p.value === priority ? 'active' : ''}`}>
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
              {(patientId || name || cpf || phone || birthdate || convenioId) && (
                <button type="button" onClick={limparPaciente} className="btn btn-outline">
                  Limpar
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
