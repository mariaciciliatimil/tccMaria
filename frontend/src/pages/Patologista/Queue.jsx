import { useEffect, useMemo, useState } from 'react';
import './pathologista.css';

// ✅ fallback seguro caso a variável de ambiente não esteja configurada
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function authHeaders() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ✅ helper que valida JSON antes de dar res.json()
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(
      `Resposta inesperada (${res.status}). Verifique VITE_API_URL. URL chamada: ${url}\n` +
      text.slice(0, 200)
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Falha na requisição (${res.status})`);
  }
  return res.json();
}

export default function QueuePatologista() {
  const [tab, setTab] = useState('FILA'); // FILA | MEUS
  const [hoje, setHoje] = useState(true);
  const [status, setStatus] = useState('NA_FILA'); // NA_FILA | EM_ANALISE | CONCLUIDO
  const [busca, setBusca] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function listarFila({ hoje = true, status = 'NA_FILA', busca = '' } = {}) {
    const qs = new URLSearchParams();
    if (hoje) qs.set('hoje', '1');
    if (status) qs.set('status', status);
    if (busca) qs.set('busca', busca);
    return fetchJson(`${BASE}/patologista/fila?${qs.toString()}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
  }

  async function listarMeus() {
    return fetchJson(`${BASE}/patologista/meus`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
  }

  async function iniciarAnalise(bandejaId) {
    return fetchJson(`${BASE}/patologista/${bandejaId}/iniciar`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
  }

  async function concluirAnalise(bandejaId) {
    return fetchJson(`${BASE}/patologista/${bandejaId}/concluir`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
  }

  async function load() {
    try {
      setErr('');
      setLoading(true);
      const data = tab === 'FILA'
        ? await listarFila({ hoje, status, busca })
        : await listarMeus();
      setItems(data);
    } catch (e) {
      console.error(e);
      setErr(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab, hoje, status, busca]);
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [tab, hoje, status, busca]);

  const title = useMemo(
    () => (tab === 'FILA' ? 'Fila do Patologista' : 'Meus em Análise'),
    [tab]
  );

  return (
    <div className="pat-page">
      <header className="pat-header">
        <h1>{title}</h1>
        <div className="pat-tabs">
          <button
            className={tab === 'FILA' ? 'active' : ''}
            onClick={() => setTab('FILA')}
          >
            Fila
          </button>
          <button
            className={tab === 'MEUS' ? 'active' : ''}
            onClick={() => setTab('MEUS')}
          >
            Meus
          </button>
        </div>

        {tab === 'FILA' && (
          <div className="pat-filters">
            <label className="chk">
              <input
                type="checkbox"
                checked={hoje}
                onChange={(e) => setHoje(e.target.checked)}
              />
              Apenas hoje
            </label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="NA_FILA">Na fila</option>
              <option value="EM_ANALISE">Em análise</option>
              <option value="CONCLUIDO">Concluídos</option>
            </select>
            <input
              className="search"
              placeholder="Buscar paciente ou tipo de exame..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <button className="refresh" onClick={load}>
              Atualizar
            </button>
          </div>
        )}
      </header>

      {err && <div className="pat-error">{err}</div>}
      {loading && <div className="pat-loading">Carregando...</div>}

      <section className="pat-cards">
        {!loading && items.length === 0 && (
          <p className="empty">Nada por aqui.</p>
        )}
        {items.map((row) => (
          <article
            key={
              row.bandeja_id ||
              row.tray_id ||
              `${row.exame_id}-${row.iniciado_em || ''}`
            }
            className={`pat-card ${
              row.prioridade === 1
                ? 'prio-1'
                : row.prioridade === 2
                ? 'prio-2'
                : row.prioridade === 3
                ? 'prio-3'
                : 'prio-4'
            }`}
          >
            <div className="pat-card-head">
              <strong>{row.tipo_exame || row.type || 'Exame'}</strong>
              <span className={`badge ${row.status_bandeja || 'NA_FILA'}`}>
                {row.status_bandeja || 'NA_FILA'}
              </span>
            </div>
            <div className="pat-card-sub">
              <span className="patient">
                {row.paciente || row.patient_name || 'Paciente'}
              </span>
              <span className="date">
                {formatDateTime(row.adicionado_em || row.created_at)}
              </span>
            </div>
            {row.observacao && (
              <div className="pat-card-note">{row.observacao}</div>
            )}
            <div className="pat-card-actions">
              {(row.status_bandeja === 'NA_FILA' || !row.status_bandeja) && (
                <button
                  className="btn primary"
                  onClick={async () => {
                    await iniciarAnalise(row.bandeja_id || row.tray_id);
                    load();
                  }}
                >
                  Iniciar análise
                </button>
              )}
              {row.status_bandeja === 'EM_ANALISE' && (
                <button
                  className="btn success"
                  onClick={async () => {
                    await concluirAnalise(row.bandeja_id || row.tray_id);
                    load();
                  }}
                >
                  Concluir
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function formatDateTime(v) {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return '-';
  }
}
