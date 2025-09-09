import React, { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''

export default function Status() {
  const [counts, setCounts] = useState({ PENDENTE: 0, EM_PREPARO_INICIAL: 0, CONCLUIDO: 0 })
  const [columns, setColumns] = useState({ PENDENTE: [], EM_PREPARO_INICIAL: [], CONCLUIDO: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      setColumns(
        data.columns || { PENDENTE: [], EM_PREPARO_INICIAL: [], CONCLUIDO: [] }
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBoard() }, [])

  const styles = {
    wrap: { padding: '12px 20px', maxWidth: 1200, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 800, letterSpacing: 0.5, textAlign: 'center', flex: 1 },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 18
    },
    col: { background: '#e9ecef', borderRadius: 14, padding: 16, minHeight: 420 },
    colHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    badge: {
      background: '#0ea5e9',
      color: '#fff',
      fontWeight: 800,
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 12
    },
    card: {
      background: '#fff',
      borderRadius: 10,
      padding: '12px 14px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      marginBottom: 10
    },
    sub: { fontSize: 13, color: '#374151' },
    toolbarBtn: {
      padding: '8px 12px',
      borderRadius: 10,
      border: '1px solid #d0d5dd',
      background: '#fff',
      cursor: 'pointer',
      fontWeight: 700
    }
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
          <div key={e.id} style={styles.card}>
            <div style={{ fontWeight: 800 }}>
              {e.patient_name || 'Paciente'} • #{e.id}
            </div>
            <div style={styles.sub}>
              Exame: {String(e.type || '').replaceAll('_', ' ')}
              {e.priority ? ' • Prioritário' : ''}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Criado em: {new Date(e.created_at).toLocaleString()}
            </div>
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
          <button onClick={loadBoard} style={styles.toolbarBtn} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>
      )}

      {/* Resumo opcional no topo */}
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
    </div>
  )
}
