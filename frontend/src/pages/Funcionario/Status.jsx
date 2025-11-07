import React, { useEffect, useMemo, useState, useRef } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''

// Paleta + rótulos de prioridade
const PR = {
  1: { label: 'Emergência',     bg: '#ffe4e6', dot: '#e11d48' },
  2: { label: 'Muito urgente',  bg: '#ffedd5', dot: '#f59e0b' },
  3: { label: 'Urgente',        bg: '#fef9c3', dot: '#f59e0b' },
  4: { label: 'Rotina',         bg: '#dcfce7', dot: '#10b981' },
}

const PriorityChip = ({ level = 4 }) => {
  const meta = PR[level] || PR[4]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: meta.bg, padding: '6px 10px', borderRadius: 999,
      border: '1px solid rgba(2,6,23,.06)', fontSize: 12, fontWeight: 900
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999, background: meta.dot,
        boxShadow: `0 0 0 2px ${meta.bg}`
      }}/>
      {meta.label}
    </span>
  )
}

export default function Status() {
  const [counts, setCounts] = useState({ PENDENTE: 0, EM_PREPARO_INICIAL: 0, CONCLUIDO: 0 })
  const [columns, setColumns] = useState({ PENDENTE: [], EM_PREPARO_INICIAL: [], CONCLUIDO: [] })
  const [analisados, setAnalisados] = useState([]) // ⬅️ NOVO
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sel, setSel] = useState(null)
  const [savingPrio, setSavingPrio] = useState(false)
  const [prioDraft, setPrioDraft] = useState(4)

  // UI extra
  const [q, setQ] = useState('')            // busca
  const [auto, setAuto] = useState(true)    // auto-refresh
  const timer = useRef(null)

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }),
    []
  )

  const loadBoard = async () => {
    setLoading(true); setError('')
    try {
      // Board do preparo (3 colunas)
      const res = await fetch(`${API}/exams/board`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao carregar board')
      setCounts(data.counts || { PENDENTE: 0, EM_PREPARO_INICIAL: 0, CONCLUIDO: 0 })
      setColumns(data.columns || { PENDENTE: [], EM_PREPARO_INICIAL: [], CONCLUIDO: [] })

      // Coluna "Analisados" (patologista concluiu)
      const r2 = await fetch(`${API}/patologista/fila?status=CONCLUIDO&hoje=1`, { headers })
      const d2 = await r2.json()
      setAnalisados(Array.isArray(d2) ? d2 : [])
    } catch (e) {
      setError(e.message)
      setAnalisados([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBoard() }, [])

  // Auto refresh a cada 30s
  useEffect(() => {
    if (auto) {
      timer.current = setInterval(loadBoard, 30000)
    }
    return () => clearInterval(timer.current)
  }, [auto])

  async function openExam(id) {
    try {
      const r = await fetch(`${API}/exams/${id}`, { headers })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Falha ao buscar detalhes')
      setSel(d)
      setPrioDraft(Number(d.priority ?? 4))
    } catch (e) {
      alert(e.message)
    }
  }

  async function savePriority() {
    if (!sel) return
    setSavingPrio(true)
    try {
      const r = await fetch(`${API}/exams/${sel.id}/priority`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ priority: Number(prioDraft) })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Falha ao atualizar prioridade')
      setSel({ ...sel, priority: d.priority })
      await loadBoard()
      alert('Prioridade atualizada.')
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingPrio(false)
    }
  }

  async function concludeExam() {
    if (!sel) return
    if (!confirm('Concluir este exame?')) return
    try {
      const r = await fetch(`${API}/exams/${sel.id}/conclude`, { method: 'POST', headers })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Falha ao concluir exame')
      await loadBoard()
      setSel(null)
    } catch (e) {
      alert(e.message)
    }
  }

  // ======== estilos modernos ========
  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(120deg,#f8fafc 0%, #eef2ff 50%, #fff 100%)',
      color: '#0f172a'
    },
    wrap: { padding: '16px 22px', maxWidth: 1280, margin: '0 auto' },
    header: {
      position: 'sticky', top: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between',
      padding: '10px 12px', marginBottom: 12,
      background: 'rgba(255,255,255,.7)', border: '1px solid rgba(2,6,23,.08)',
      borderRadius: 14, backdropFilter: 'saturate(140%) blur(8px)',
      boxShadow: '0 10px 30px rgba(2,6,23,.08)'
    },
    brand: { fontWeight: 900, letterSpacing: .6, fontSize: 18 },
    actions: { display: 'flex', gap: 8, alignItems: 'center' },
    search: {
      padding: '10px 12px', borderRadius: 12, border: '1px solid #cbd5e1',
      background: '#fff', outline: 'none', minWidth: 260
    },
    toggle: {
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 999, padding: '8px 12px',
      background: '#fff', fontWeight: 800, cursor: 'pointer'
    },
    btn: {
      padding: '10px 14px', borderRadius: 12, border: '1px solid #cbd5e1',
      background: 'linear-gradient(180deg,#ffffff,#f8fafc)', cursor: 'pointer',
      fontWeight: 900
    },
    counters: {
      display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center'
    },
    pill: {
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: 'rgba(255,255,255,.6)', border: '1px solid #e2e8f0',
      padding: '8px 12px', borderRadius: 999, fontWeight: 900,
      boxShadow: '0 4px 14px rgba(15,23,42,.06)'
    },
    dot: (c) => ({ width: 10, height: 10, borderRadius: 999, background: c }),
    grid: { display: 'grid', gap: 18, gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))' }, // ⬅️ 4 colunas
    col: {
      borderRadius: 18,
      background: 'linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,.66))',
      border: '1px solid rgba(2,6,23,.08)', padding: 14, minHeight: 480,
      backdropFilter: 'blur(6px)', boxShadow: '0 18px 40px rgba(2,6,23,.06)'
    },
    colHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    colTitle: { fontWeight: 900, letterSpacing: .5 },
    badge: { background: '#0ea5e9', color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 900 },
    card: (priority) => ({
      position: 'relative',
      background: '#ffffff',
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      border: '1px solid #e5e7eb',
      boxShadow: '0 10px 26px rgba(2,6,23,.06)',
      transition: 'transform .15s ease, box-shadow .15s ease',
      '--g': PR[priority]?.bg || PR[4].bg,
      outline: '1px solid rgba(2,6,23,.06)',
      outlineOffset: '0px'
    }),
    cardHover: { transform: 'translateY(-2px)', boxShadow: '0 18px 38px rgba(2,6,23,.12)' },
    gradBar: (priority) => ({
      position: 'absolute', inset: '0 auto 0 0', width: 6,
      background: `linear-gradient(180deg, ${PR[priority]?.bg || PR[4].bg}, #fff)`
    }),
    nameRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    name: { fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 },
    sub: { fontSize: 13, color: '#334155' },
    small: { fontSize: 12, color: '#64748b' },
    empty: {
      display: 'grid', placeItems: 'center', textAlign: 'center',
      padding: '28px 10px', color: '#8b9bb1', fontSize: 14
    },
    modalBtn: {
      padding: '8px 12px', borderRadius: 10, border: '1px solid #d0d5dd',
      background: '#fff', cursor: 'pointer', fontWeight: 900
    }
  }

  // filtro client-side pela busca
  const filterByQ = (arr=[]) => {
    const k = q.trim().toLowerCase()
    if (!k) return arr
    return arr.filter(e =>
      (e.patient_name || '').toLowerCase().includes(k) ||
      (e.type || '').toLowerCase().includes(k)
    )
  }

  const Coluna = ({ titulo, items }) => {
    const [hoverId, setHoverId] = useState(null)
    const list = filterByQ(items)

    return (
      <div style={styles.col}>
        <div style={styles.colHead}>
          <div style={styles.colTitle}>{titulo}</div>
          <span style={styles.badge}>{list.length}</span>
        </div>

        {list.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Sem itens</div>
            <div style={{ fontSize: 12 }}>Os exames desta coluna aparecem aqui automaticamente.</div>
          </div>
        ) : (
          list.map((e) => (
            <div
              key={e.id}
              style={{ ...styles.card(e.priority), ...(hoverId === e.id ? styles.cardHover : null) }}
              onClick={() => openExam(e.id)}
              onMouseEnter={() => setHoverId(e.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <div style={styles.gradBar(e.priority)} />
              <div style={styles.nameRow}>
                <div style={styles.name}>
                  {e.patient_name || 'Paciente'}
                  <span style={{ color:'#94a3b8', fontWeight:700 }}>• #{e.id}</span>
                </div>
                <PriorityChip level={e.priority} />
              </div>
              <div style={styles.sub}>Exame: {String(e.type || '').replaceAll('_', ' ')}</div>
              <div style={styles.small}>Criado em: {new Date(e.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    )
  }

  // ⬇️ Coluna específica para “Analisados” (estrutura do /patologista/fila)
  const ColAnalisados = ({ items }) => {
    const [hoverId, setHoverId] = useState(null)
    const list = (() => {
      const k = q.trim().toLowerCase()
      if (!k) return items
      return items.filter(it =>
        (it.paciente || '').toLowerCase().includes(k) ||
        (it.tipo_exame || '').toLowerCase().includes(k)
      )
    })()

    return (
      <div style={styles.col}>
        <div style={styles.colHead}>
          <div style={styles.colTitle}>ANALISADOS</div>
          <span style={styles.badge}>{list.length}</span>
        </div>

        {list.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Sem itens</div>
            <div style={{ fontSize: 12 }}>Exames concluídos pelo patologista (hoje).</div>
          </div>
        ) : (
          list.map((it) => (
            <div
              key={it.bandeja_id}
              style={{ ...styles.card(it.prioridade), ...(hoverId === it.bandeja_id ? styles.cardHover : null) }}
              onMouseEnter={() => setHoverId(it.bandeja_id)}
              onMouseLeave={() => setHoverId(null)}
              title="Exame analisado pelo patologista"
            >
              <div style={styles.gradBar(it.prioridade)} />
              <div style={styles.nameRow}>
                <div style={styles.name}>
                  {it.paciente || 'Paciente'}
                  <span style={{ color:'#94a3b8', fontWeight:700 }}>• #{it.exame_id}</span>
                </div>
                <PriorityChip level={it.prioridade ?? 4} />
              </div>
              <div style={styles.sub}>Exame: {String(it.tipo_exame || '').replaceAll('_', ' ')}</div>
              <div style={styles.small}>
                Finalizado em: {it.concluido_em ? new Date(it.concluido_em).toLocaleString() : '—'}
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        {/* Header */}
        <div style={styles.header}>
          <div className="logo" style={styles.brand}>SIRP • Status</div>

          <div style={styles.actions}>
            <input
              style={styles.search}
              placeholder="Buscar paciente ou tipo…"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
            <button style={styles.toggle} onClick={()=>setAuto(v=>!v)}>
              <span
                style={{
                  display:'inline-block', width:10, height:10, borderRadius:999,
                  background: auto ? '#22c55e' : '#94a3b8'
                }}
              />
              Auto {auto ? 'ON' : 'OFF'}
            </button>
            <button onClick={loadBoard} style={styles.btn} disabled={loading}>
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {error && <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>}

        {/* Contadores */}
        <div style={styles.counters}>
          <span style={styles.pill}><span style={styles.dot('#94a3b8')}></span> Pendente: {counts.PENDENTE || 0}</span>
          <span style={styles.pill}><span style={styles.dot('#22c55e')}></span> Em preparo: {counts.EM_PREPARO_INICIAL || 0}</span>
          <span style={styles.pill}><span style={styles.dot('#0ea5e9')}></span> Concluído: {counts.CONCLUIDO || 0}</span>
          <span style={styles.pill}><span style={styles.dot('#a78bfa')}></span> Analisados: {analisados.length || 0}</span>
        </div>

        {/* Board */}
        <div style={styles.grid}>
          <Coluna titulo="PENDENTE" items={columns.PENDENTE || []} />
          <Coluna titulo="EM PREPARO INICIAL" items={columns.EM_PREPARO_INICIAL || []} />
          <Coluna titulo="CONCLUÍDO" items={columns.CONCLUIDO || []} />
          <ColAnalisados items={analisados} />
        </div>
      </div>

      {/* Modal */}
      {sel && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            width: 720, background: '#fff', borderRadius: 16, padding: 18,
            boxShadow: '0 30px 80px rgba(2,8,23,.35)', border: '1px solid #e2e8f0'
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Detalhes do Exame</div>
              <button style={styles.modalBtn} onClick={() => setSel(null)}>Fechar</button>
            </div>

            <table style={{ width: '100%', fontSize: 14 }}>
              <tbody>
                <tr><td><b>Paciente</b></td><td>{sel.patient_name}</td></tr>
                <tr><td><b>Exame</b></td><td>#{sel.id} — {String(sel.type).replaceAll('_',' ')}</td></tr>
                <tr>
                  <td><b>Prioridade</b></td>
                  <td><PriorityChip level={sel.priority} /></td>
                </tr>
                <tr><td><b>Status atual</b></td><td>{sel.status}</td></tr>
                <tr><td><b>Criado em</b></td><td>{new Date(sel.created_at).toLocaleString()}</td></tr>
                <tr><td><b>Resp. preparo</b></td><td>{sel.prep_responsavel || '—'}</td></tr>
                <tr><td><b>Lâminas</b></td><td>{sel.prep_laminas ?? '—'}</td></tr>
                <tr><td><b>Início do preparo</b></td><td>{sel.prep_started_at ? new Date(sel.prep_started_at).toLocaleString() : '—'}</td></tr>
              </tbody>
            </table>

            {sel.status !== 'CONCLUIDO' && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button style={styles.modalBtn} onClick={concludeExam}>Concluir exame</button>
              </div>
            )}

            {sel.status === 'CONCLUIDO' && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Alterar prioridade do exame</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={prioDraft} onChange={e => setPrioDraft(Number(e.target.value))}
                          style={{ padding:'8px 10px', border:'1px solid #cbd5e1', borderRadius:10 }}>
                    <option value={1}>Emergência</option>
                    <option value={2}>Muito urgente</option>
                    <option value={3}>Urgente</option>
                    <option value={4}>Rotina</option>
                  </select>
                  <button style={styles.modalBtn} disabled={savingPrio} onClick={savePriority}>
                    {savingPrio ? 'Salvando…' : 'Salvar prioridade'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
