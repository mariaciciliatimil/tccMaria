// src/pages/Funcionario/Iniciar.jsx
import React, { useEffect, useRef, useState } from 'react'
import '../../styles/iniciar.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''

const EXAM_TYPES = [
  { value: 'CITOLOGIA_ONCOTICA', label: 'Citologia Oncótica' },
  { value: 'ANATOMO_PATOLOGICO', label: 'Anátomo Patológico' },
]

const PRIORITIES = [
  { value: 1, label: 'Emergência', color: '#fee2e2', dot: '#ef4444' },
  { value: 2, label: 'Muito urgente', color: '#fff1db', dot: '#f59e0b' },
  { value: 3, label: 'Urgente', color: '#fef9c3', dot: '#eab308' },
  { value: 4, label: 'Rotina', color: '#dcfce7', dot: '#10b981' },
]

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
  if (d.length <= 10)
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export default function Iniciar() {
  const [convs, setConvs] = useState([])
  const [examType, setExamType] = useState(EXAM_TYPES[0].value)
  const [priority, setPriority] = useState(4)

  const [query, setQuery] = useState('')
  const [sug, setSug] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [busySug, setBusySug] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const sugBoxRef = useRef(null)

  const [patientId, setPatientId] = useState(null)
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [convenioId, setConvenioId] = useState('')

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

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

  useEffect(() => {
    const run = async () => {
      const q = query.trim()
      const digits = onlyDigits(q)
      if (!q || (q.length < 2 && digits.length !== 11)) {
        setSug([]); setNotFound(false); setActiveIndex(-1); return
      }
      try {
        setBusySug(true)
        const res = await fetch(
          `${API}/patients/search?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token()}` } }
        )
        const data = res.ok ? await res.json() : []
        const list = Array.isArray(data) ? data : []
        setSug(list)
        setNotFound(list.length === 0)
        setActiveIndex(list.length ? 0 : -1)
      } catch {
        setSug([]); setNotFound(false); setActiveIndex(-1)
      } finally {
        setBusySug(false)
      }
    }
    const t = setTimeout(run, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const handle = (e) => {
      if (!sugBoxRef.current) return
      if (!sugBoxRef.current.contains(e.target)) setSug([])
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

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

    const cpfDigits = onlyDigits(cpf)
    if (!name.trim()) { setBusy(false); setMsg('Informe o nome do paciente.'); return }
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
      setPriority(4); setExamType(EXAM_TYPES[0].value)
      setSug([]); setNotFound(false)
    } catch (err) {
      setMsg(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  function onQueryKeyDown(e) {
    if (!sug.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, sug.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault()
        selectSuggestion(sug[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setSug([])
    }
  }

  return (
    <>
      <div className="iniciar-wrapper">
        <header className="page-header">
          <h1>SISTEMA DE RASTREAMENTO PATOLÓGICO</h1>
        </header>

        <main className="iniciar-container">
          <div className="iniciar-card">
            <h2>Iniciar Paciente</h2>

            {patientId && (
              <div style={{ marginBottom: 10 }}>
                <span className="pill">
                  Paciente selecionado: {name}
                  <button title="Limpar" onClick={limparPaciente}>×</button>
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="iniciar-form">
              <div className="form-group" style={{ position: 'relative' }} ref={sugBoxRef}>
                <label className="label">Buscar paciente por nome ou CPF</label>
                <input
                  className="input"
                  placeholder="Digite 2+ letras ou CPF (11 dígitos)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onQueryKeyDown}
                />
                {busySug && <div className="hint">buscando…</div>}

                {sug.length > 0 && (
                  <div className="sug-list">
                    {sug.map((p, i) => (
                      <div
                        key={p.id}
                        onClick={() => selectSuggestion(p)}
                        className={`sug-item ${i === activeIndex ? 'active' : ''}`}
                        onMouseEnter={() => setActiveIndex(i)}
                      >
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
                  <div className="alert-warn" style={{ marginTop: 8 }}>
                    Nenhum paciente encontrado para <b>"{query}"</b>. Preencha os campos abaixo para cadastrar.
                    <button
                      type="button"
                      onClick={() => {
                        setPatientId(null)
                        setName(query.replace(/\d/g, '').trim())
                        setQuery('')
                      }}
                      className="btn btn-ghost"
                      style={{ marginLeft: 8 }}
                    >
                      Usar esse nome
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="label">Nome</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

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
                      <label
                        key={p.value}
                        className={`prio ${p.value === priority ? 'active' : ''}`}
                        style={{ background: p.value === priority ? p.color : '#fff' }}
                        title={p.label}
                      >
                        <input
                          type="radio"
                          name="priority"
                          value={p.value}
                          checked={priority === p.value}
                          onChange={() => setPriority(p.value)}
                        />
                        <span className="prio-dot" style={{ background: p.dot }} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

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

              {msg && (
                <div className={`msg ${msg.startsWith('Exame') ? 'ok' : 'err'}`}>
                  {msg}
                </div>
              )}
            </form>
          </div>
        </main>
      </div>
    </>
  )
}
