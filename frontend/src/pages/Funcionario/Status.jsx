import React, { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''

export default function Status() {
  const [counts, setCounts] = useState({ PENDENTE: 0, EM_PREPARO_INICIAL: 0, CONCLUIDO: 0 })
  const [columns, setColumns] = useState({ PENDENTE: [], EM_PREPARO_INICIAL: [], CONCLUIDO: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sel, setSel] = useState(null)           // exame selecionado (modal)
  const [savingPrio, setSavingPrio] = useState(false)
  const [prioDraft, setPrioDraft] = useState(3)

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }),
    []
  )

  async function loadBoard() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/exams/board`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao carregar board')
      setCounts(data.counts || { PENDENTE: 0, EM_PREPARO_INICIAL: 0, CONCLUIDO: 0 })
      setColumns(data.columns || { PENDENTE: [], EM_PREPARO_INICIAL: [], CONCLUIDO: [] })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadBoard() }, [])

  async function openExam(id) {
    try {
      const r = await fetch(`${API}/exams/${id}`, { headers })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Falha ao buscar detalhes')
      setSel(d)
      setPrioDraft(Number(d.priority ?? 3))
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
      // Atualiza local e board
      setSel({ ...sel, priority: d.priority })
      await loadBoard()
      alert('Prioridade atualizada.')
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingPrio(false)
    }
  }

  // >>> NOVO: concluir exame (avançar para CONCLUÍDO)
  async function concludeExam() {
    if (!sel) return
    if (!confirm('Concluir este exame?')) return
    try {
      const r = await fetch(`${API}/exams/${sel.id}/conclude`, {
        method: 'POST',
        headers
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Falha ao concluir exame')
      await loadBoard()
      setSel(null) // fecha modal
    } catch (e) {
      alert(e.message)
    }
  }

  const styles = {
    wrap: { padding: '12px 20px', maxWidth: 1200, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 800, letterSpacing: 0.5, textAlign: 'center', flex: 1 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 },
    col: { background: '#e9ecef', borderRadius: 14, padding: 16, minHeight: 420 },
    colHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    badge: { background: '#0ea5e9', color: '#fff', fontWeight: 800, padding: '4px 10px', borderRadius: 999, fontSize: 12 },
    card: { background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 10, cursor: 'pointer' },
    sub: { fontSize: 13, color: '#374151' },
    small: { fontSize: 12, color: '#6b7280' },
    btn: { padding: '8px 12px', borderRadius: 10, border: '1px solid #d0d5dd', background: '#fff', cursor: 'pointer', fontWeight: 700 }
  }

  const Coluna = ({ titulo, items }) => (
    <div style={styles.col}>
      <div style={styles.colHead}>
        <div style={{ fontWeight: 900 }}>{titulo}</div>
        <span style={styles.badge}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ color: '#6b7280' }}>Sem itens</div>
      ) : (
        items.map((e) => (
          <div key={e.id} style={styles.card} onClick={() => openExam(e.id)}>
            <div style={{ fontWeight: 800 }}>{e.patient_name || 'Paciente'} • #{e.id}</div>
            <div style={styles.sub}>
              Exame: {String(e.type || '').replaceAll('_', ' ')}
              {e.priority === 1 ? ' • Prioritário' : ''}
            </div>
            <div style={styles.small}>Criado em: {new Date(e.created_at).toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  )

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={{ width: 120 }} />
        <div style={styles.title}>SISTEMA DE RASTREAMENTO PATOLÓGICO</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadBoard} style={styles.btn} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={styles.badge}>Pendente: {counts.PENDENTE || 0}</span>
        <span style={styles.badge}>Em preparo: {counts.EM_PREPARO_INICIAL || 0}</span>
        <span style={styles.badge}>Concluído: {counts.CONCLUIDO || 0}</span>
      </div>

      <div style={styles.grid}>
        <Coluna titulo="PENDENTE" items={columns.PENDENTE || []} />
        <Coluna titulo="EM PREPARO INICIAL" items={columns.EM_PREPARO_INICIAL || []} />
        <Coluna titulo="CONCLUÍDO" items={columns.CONCLUIDO || []} />
      </div>

      {/* Modal simples */}
      {sel && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, width: 640, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <b>Detalhes do Exame</b>
              <button style={styles.btn} onClick={() => setSel(null)}>Fechar</button>
            </div>

            <table style={{ width: '100%', fontSize: 14 }}>
              <tbody>
                <tr><td><b>Paciente</b></td><td>{sel.patient_name}</td></tr>
                <tr><td><b>Exame</b></td><td>#{sel.id} — {String(sel.type).replaceAll('_',' ')}</td></tr>
                <tr><td><b>Prioridade</b></td><td>{{1:'Alta',2:'Média',3:'Normal'}[sel.priority] || 'Normal'}</td></tr>
                <tr><td><b>Status atual</b></td><td>{sel.status}</td></tr>
                <tr><td><b>Criado em</b></td><td>{new Date(sel.created_at).toLocaleString()}</td></tr>
                <tr><td><b>Resp. preparo</b></td><td>{sel.prep_responsavel || '—'}</td></tr>
                <tr><td><b>Lâminas</b></td><td>{sel.prep_laminas ?? '—'}</td></tr>
                <tr><td><b>Início do preparo</b></td><td>{sel.prep_started_at ? new Date(sel.prep_started_at).toLocaleString() : '—'}</td></tr>
              </tbody>
            </table>

            {/* Ações para avançar etapa (quando ainda não está concluído) */}
            {sel.status !== 'CONCLUIDO' && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button style={styles.btn} onClick={concludeExam}>
                  Concluir exame
                </button>
              </div>
            )}

            {/* Alterar prioridade somente quando já está concluído */}
            {sel.status === 'CONCLUIDO' && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eee' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Alterar prioridade do exame</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={prioDraft} onChange={e => setPrioDraft(Number(e.target.value))}>
                    <option value={1}>Alta</option>
                    <option value={2}>Média</option>
                    <option value={3}>Normal</option>
                  </select>
                  <button className="btn" style={styles.btn} disabled={savingPrio} onClick={savePriority}>
                    {savingPrio ? 'Salvando...' : 'Salvar prioridade'}
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
