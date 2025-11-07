// src/pages/Funcionario/Pacientes.jsx
import React, { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''

const EXAM_TYPES = [
  { value: 'CITOLOGIA_ONCOTICA', label: 'Citologia Oncótica' },
  { value: 'ANATOMO_PATOLOGICO', label: 'Anátomo Patológico' },
]

/**
 * Helper: tenta inferir se o paciente tem algum exame em PREPARO.
 * Aceita vários formatos vindos do backend (last_status, status, ultimo_status, prep_started_at...).
 */
function isEmPreparo(p = {}) {
  const st = String(p.last_status || p.status || p.ultimo_status || '').toUpperCase()
  return Boolean(p.prep_started_at || p.prep_started || st === 'EM_PREPARO_INICIAL')
}

const Chip = ({ children }) => (
  <span
    style={{
      marginLeft: 8,
      fontSize: 12,
      background: '#24696A',
      color: 'white',
      borderRadius: 8,
      padding: '2px 8px',
      fontWeight: 800,
      letterSpacing: 0.2,
    }}
  >
    {children}
  </span>
)

export default function Pacientes() {
  const [list, setList] = useState([]) // sempre array
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [convs, setConvs] = useState([])
  const [msg, setMsg] = useState('')

  // form create/edit
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', birthdate: '', convenio_id: '' })

  // === MODAL: iniciar preparo ===
  const [prepOpen, setPrepOpen] = useState(false)
  const [prepPatient, setPrepPatient] = useState(null)
  const [prepLoading, setPrepLoading] = useState(false)
  const [prepError, setPrepError] = useState('')
  const [prepExams, setPrepExams] = useState([]) // sempre array
  const [prepExamId, setPrepExamId] = useState('')
  const [prepLaminas, setPrepLaminas] = useState('')

  // responsáveis
  const [staff, setStaff] = useState([])
  const [prepRespId, setPrepRespId] = useState('')

  // (mantidos se usados em outros pontos — não removi)
  const [examOpenId] = useState(null)
  const [examType] = useState(EXAM_TYPES[0].value)
  const [examUrg] = useState(false)

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
    }),
    []
  )

  // ✅ abre janela de impressão com as etiquetas geradas
  function openPrintWindow(slides = [], paciente = '', examId) {
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Etiquetas – Exame #${examId}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
  .tag { border: 1px solid #333; border-radius: 6px; padding: 8px; font-size: 14px; line-height: 1.3; text-align: center; }
  .big { font-weight: 700; font-size: 16px; }
  .small { color: #555; font-size: 12px; }
  .hdr { margin-bottom: 10px; font-size: 12px; color: #444; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="hdr">Paciente: <b>${paciente || '-'}</b> • Exame #${examId}</div>
  <div class="grid">
    ${slides
      .map(
        (s) => `
      <div class="tag">
        <div class="big">${s.label}</div>
        <div class="small">${paciente ? paciente + ' • ' : ''}Exame #${examId}</div>
      </div>`
      )
      .join('')}
  </div>
  <div class="no-print" style="margin-top:16px"><button onclick="window.print()">Imprimir</button></div>
</body>
</html>
    `.trim()

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
  }

  // ✅ Garante array para {rows: [...]}, {items: [...]}, ou array direto
  function normalizeToArray(data) {
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.rows)) return data.rows
    if (data && Array.isArray(data.items)) return data.items
    return []
  }

  async function load() {
    setLoading(true)
    try {
      const url =
        q && q.length >= 2 ? `${API}/patients?q=${encodeURIComponent(q)}` : `${API}/patients`
      const res = await fetch(url, { headers })
      const data = await res.json().catch(() => [])
      setList(normalizeToArray(data))
    } catch (e) {
      setList([])
      console.error('load patients failed:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch(`${API}/patients/convenios`, { headers })
        const data = await r.json().catch(() => [])
        setConvs(normalizeToArray(data))
      } catch {
        setConvs([])
      }
    })()
  }, [])

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
      birthdate: p.birthdate ? p.birthdate.substring(0, 10) : '',
      convenio_id: p.convenio_id || '',
    })
    setMsg('')
  }

  async function submitForm(e) {
    e.preventDefault()
    setMsg('')

    const method = editing ? 'PATCH' : 'POST'
    const url = editing ? `${API}/patients/${editing.id}` : `${API}/patients`

    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(data.error || 'Falha ao salvar')
        return
      }
      setMsg(editing ? 'Paciente atualizado' : 'Paciente criado')
      setEditing(null)
      setForm({ name: '', birthdate: '', convenio_id: '' })
      load()
    } catch (e) {
      setMsg('Falha ao salvar')
    }
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
      // 1) exames do paciente
      let res = await fetch(`${API}/patients/${patient.id}/exams`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.status === 404) {
        res = await fetch(`${API}/exams?patient_id=${patient.id}`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
      }
      const data = await res.json().catch(() => [])
      const list = normalizeToArray(data)
      setPrepExams(list)
      setPrepExamId(list?.[0]?.id || '')

      // 2) responsáveis
      const rStaff = await fetch(`${API}/exams/responsaveis`, { headers })
      const sData = await rStaff.json().catch(() => [])
      setStaff(normalizeToArray(sData))
    } catch (e) {
      setPrepError(e.message || 'Falha ao carregar dados')
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
        body: JSON.stringify({
          laminas: Number(prepLaminas),
          responsavel_id: Number(prepRespId),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao iniciar preparo')

      setMsg(`Preparo iniciado no exame #${data.id} (${data.status}).`)

      // 👉 busca etiquetas geradas e abre impressão
      const rSlides = await fetch(`${API}/exams/${prepExamId}/slides`, { headers })
      const slides = (await rSlides.json().catch(() => [])) || []
      openPrintWindow(slides, prepPatient?.name || '', prepExamId)

      closePrep()
      load()
    } catch (e) {
      setPrepError(e.message)
    }
  }

  const input = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ccc',
    borderRadius: 8,
    marginBottom: 10,
  }
  const label = { display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 700 }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 16 }}>
      {/* Busca e ações */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          style={{ ...input, maxWidth: 360, marginBottom: 0 }}
          placeholder="Buscar por nome (2+ letras)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          onClick={load}
          style={{ padding: '10px 14px', border: '1px solid #ccc', borderRadius: 8, background: '#fff' }}
        >
          Atualizar
        </button>
        <button
          onClick={startCreate}
          style={{ padding: '10px 14px', border: 'none', borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 700 }}
        >
          Novo paciente
        </button>
      </div>

      {/* Formulário */}
      {(editing !== null || form.name || form.birthdate || form.convenio_id) && (
        <form
          onSubmit={submitForm}
          style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.06)' }}
        >
          <h3 style={{ marginTop: 0 }}>{editing ? 'Editar Paciente' : 'Cadastrar Paciente'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={label}>Nome</label>
              <input required style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={label}>Data de nascimento</label>
              <input
                type="date"
                style={input}
                value={form.birthdate}
                onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Convênio</label>
              <select
                style={input}
                value={form.convenio_id}
                onChange={(e) => setForm({ ...form, convenio_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {Array.isArray(convs) &&
                  convs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              style={{ padding: '10px 14px', border: 'none', borderRadius: 8, background: '#0f766e', color: '#fff', fontWeight: 700 }}
            >
              {editing ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setForm({ name: '', birthdate: '', convenio_id: '' })
              }}
              style={{ padding: '10px 14px', border: '1px solid #ccc', borderRadius: 8, background: '#fff' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Mensagem */}
      {msg && <div style={{ color: msg.toLowerCase().includes('falha') ? '#b00020' : '#0f766e' }}>{msg}</div>}

      {/* Tabela */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.06)' }}>
        <h3 style={{ marginTop: 0 }}>
          Pacientes {loading && <small style={{ color: '#777' }}>carregando...</small>}
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Nome</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Nascimento</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Convênio</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(list) && list.length > 0 ? (
              list.map((p) => {
                const emPreparo = isEmPreparo(p)
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderTop: '1px solid #eee',
                      background: emPreparo ? 'rgba(36,105,106,0.10)' : 'transparent',
                      transition: 'background .2s ease',
                    }}
                  >
                    <td style={{ padding: 8, fontWeight: 600 }}>
                      {p.name} {emPreparo && <Chip>Em preparo</Chip>}
                    </td>
                    <td style={{ padding: 8 }}>{p.birthdate ? p.birthdate.substring(0, 10) : '-'}</td>
                    <td style={{ padding: 8 }}>{p.convenio_nome || '-'}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => startEdit(p)}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', background: '#fff' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => openPrep(p)}
                          title={emPreparo ? 'Há exame(s) com preparo iniciado' : 'Iniciar preparo'}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #ccc',
                            background: emPreparo ? '#f7faf9' : '#fff',
                            opacity: emPreparo ? 0.9 : 1,
                            cursor: 'pointer',
                          }}
                        >
                          {emPreparo ? 'Iniciar preparo' : 'Iniciar preparo'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              !loading && (
                <tr>
                  <td colSpan="4" style={{ padding: 8, color: '#777' }}>
                    Nenhum paciente.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Preparo */}
      {prepOpen && (
        <div style={M.backdrop} onClick={closePrep}>
          <div style={M.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Iniciar preparo</h3>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
              Paciente: <b>{prepPatient?.name}</b>
            </div>

            {prepLoading ? (
              <div>Carregando…</div>
            ) : (
              <>
                {prepExams.length === 0 ? (
                  <div style={{ color: '#b00020', marginBottom: 12 }}>
                    Este paciente não possui exames para iniciar preparo.
                  </div>
                ) : (
                  <div style={M.field}>
                    <label>Exame</label>
                    <select value={prepExamId} onChange={(e) => setPrepExamId(e.target.value)} style={M.input}>
                      {prepExams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          #{ex.id} • {String(ex.type || '').replaceAll('_', ' ')}
                          {ex.priority && ex.priority < 4 ? ' • Prioritário' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={M.field}>
                  <label>Qtd. de lâminas</label>
                  <input
                    type="number"
                    min="1"
                    value={prepLaminas}
                    onChange={(e) => setPrepLaminas(e.target.value)}
                    style={M.input}
                  />
                </div>

                <div style={M.field}>
                  <label>Responsável</label>
                  <select value={prepRespId} onChange={(e) => setPrepRespId(e.target.value)} style={M.input}>
                    <option value="">Selecione...</option>
                    {Array.isArray(staff) &&
                      staff.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                          {u.role ? ` • ${u.role}` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {prepError && <div style={{ color: '#b00020', marginTop: 6 }}>{prepError}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                  <button onClick={closePrep} style={M.btnGhost}>
                    Cancelar
                  </button>
                  <button onClick={savePrep} style={M.btnPrimary} disabled={prepExams.length === 0}>
                    Salvar
                  </button>
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
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: {
    width: 520,
    background: '#fff',
    borderRadius: 12,
    padding: 18,
    boxShadow: '0 10px 30px rgba(0,0,0,.2)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  input: { padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 8, outline: 'none' },
  btnGhost: { padding: '10px 14px', borderRadius: 10, border: '1px solid #d0d5dd', background: '#fff', cursor: 'pointer' },
  btnPrimary: { padding: '10px 14px', borderRadius: 10, background: '#0ea5e9', color: '#fff', border: 'none', cursor: 'pointer' },
}
