import { useState, useEffect, useMemo } from 'react';
import '../../styles/relatorios.css';

// ajuste se estiver em Docker: 'http://api:3000'
const API_BASE = 'http://localhost:3000';

function getToken() {
  const tryKeys = ['token', 'authToken', 'accessToken', 'jwt', 'user'];
  for (const k of tryKeys) {
    const v = localStorage.getItem(k) ?? sessionStorage.getItem(k);
    if (!v) continue;
    try {
      const obj = JSON.parse(v);
      if (obj?.token) return obj.token;
      if (obj?.accessToken) return obj.accessToken;
    } catch {
      if (typeof v === 'string' && v.length > 20) return v;
    }
  }
  return '';
}

function monthLabel(ym) {
  if (!ym || ym.length < 7) return ym || '';
  const [y, m] = ym.split('-').map(Number);
  return `${String(m).padStart(2, '0')}/${y}`;
}

export default function Relatorio() {
  const [tab, setTab] = useState('patients'); // 'patients' | 'exams'
  const [data, setData] = useState([]);        // patients ou monthly
  const [byType, setByType] = useState([]);    // somente exams (pizza)
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // filtros comuns
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // filtros específicos de exames
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [status, setStatus] = useState('');
  const [tipo, setTipo] = useState(''); // usado só se quiser filtrar monthly por um tipo específico

  // params para each endpoint
  const paramsPatients = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const qs = p.toString();
    return qs ? `?${qs}` : '';
  }, [q, from, to]);

  const paramsMonthly = useMemo(() => {
    const p = new URLSearchParams();
    if (year) p.set('year', year);
    if (status) p.set('status', status);
    if (tipo) p.set('tipo', tipo);     // opcional
    if (from) p.set('from', from);     // YYYY-MM
    if (to) p.set('to', to);           // YYYY-MM
    const qs = p.toString();
    return qs ? `?${qs}` : '';
  }, [year, status, tipo, from, to]);

  const paramsByType = useMemo(() => {
    const p = new URLSearchParams();
    if (year) p.set('year', year);
    if (status) p.set('status', status);
    if (from) p.set('from', from);     // YYYY-MM
    if (to) p.set('to', to);           // YYYY-MM
    const qs = p.toString();
    return qs ? `?${qs}` : '';
  }, [year, status, from, to]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setErr('');

    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };

    async function load() {
      try {
        if (tab === 'patients') {
          const r = await fetch(`${API_BASE}/reports/patients${paramsPatients}`, { signal: ctrl.signal, headers });
          const body = await r.text();
          if (!r.ok) throw new Error(body || `HTTP ${r.status}`);
          setData(JSON.parse(body));
          setByType([]);
          return;
        }

        // exams: carrega monthly e by-type em paralelo
        const [rMonthly, rType] = await Promise.all([
          fetch(`${API_BASE}/reports/exams/monthly${paramsMonthly}`, { signal: ctrl.signal, headers }),
          fetch(`${API_BASE}/reports/exams/by-type${paramsByType}`,   { signal: ctrl.signal, headers }),
        ]);

        const bMonthly = await rMonthly.text();
        const bType = await rType.text();
        if (!rMonthly.ok) throw new Error(bMonthly || `HTTP ${rMonthly.status}`);
        if (!rType.ok) throw new Error(bType || `HTTP ${rType.status}`);

        setData(JSON.parse(bMonthly));   // monthly
        setByType(JSON.parse(bType));    // by type
      } catch (e) {
        if (e.name === 'AbortError') return;
        setErr(e.message || 'Falha ao carregar relatório.');
        setData([]);
        setByType([]);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => ctrl.abort();
  }, [tab, paramsPatients, paramsMonthly, paramsByType]);

  // totais
  const totalMonthly = useMemo(() => data.reduce((acc, x) => acc + (x.total || 0), 0), [data]);
  const totalByType = useMemo(() => byType.reduce((acc, x) => acc + (x.total || 0), 0), [byType]);

  // ---------- PIE CHART por TIPO ----------
  const pie = useMemo(() => {
    if (tab !== 'exams' || !byType.length) return null;

    // paleta: cores estáveis por "tipo" (hash simples)
    const palette = [
      '#4F95D2','#94C2D9','#24696A','#FDBA74','#A78BFA','#60A5FA',
      '#34D399','#F472B6','#FCD34D','#60D7C9','#EE9B00','#9B2226',
      '#3B82F6','#22C55E','#F97316','#EF4444','#A3E635','#D946EF'
    ];
    const colorOf = (key) => {
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      return palette[h % palette.length];
    };

    const items = byType.map(x => ({
      label: x.type || 'SEM_TIPO',
      value: x.total || 0,
      color: colorOf(String(x.type || 'SEM_TIPO')),
    }));

    const sum = items.reduce((a,b) => a + b.value, 0) || 1;
    let acc = 0;
    const segments = items.map(it => {
      const start = (acc / sum) * 360;
      acc += it.value;
      const end = (acc / sum) * 360;
      return `${it.color} ${start}deg ${end}deg`;
    }).join(', ');

    return { items, gradient: `conic-gradient(${segments})` };
  }, [tab, byType]);

  function formatDate(d) {
    try { return new Date(d).toLocaleDateString('pt-BR'); }
    catch { return d ?? ''; }
  }

  function exportCSV() {
    const rows =
      tab === 'patients'
        ? [
            ['Nome', 'CPF', 'Telefone', 'Data Cadastro'],
            ...data.map(x => [x.nome, x.cpf, x.telefone, formatDate(x.created_at)]),
          ]
        : [
            ['Mês', 'Quantidade'],
            ...data.map(x => [x.month, x.total]),
          ];

    const csv = rows.map(r =>
      r.map(v => {
        const s = v == null ? '' : String(v);
        const needQuotes = /[;"\n,]/.test(s);
        const esc = s.replace(/"/g, '""');
        return needQuotes ? `"${esc}"` : esc;
      }).join(';')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label = tab === 'patients' ? 'relatorio-pacientes' : `exames-mensal-${year || 'todos'}`;
    a.href = url;
    a.download = `${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relatorios-page">
      <h2>Relatórios</h2>

      {/* Tabs */}
      <div className="tabs">
        <button className={tab === 'patients' ? 'active' : ''} onClick={() => setTab('patients')}>Pacientes</button>
        <button className={tab === 'exams' ? 'active' : ''} onClick={() => setTab('exams')}>Exames</button>
      </div>

      {/* Filtros */}
      <div className="filters">
        {tab === 'patients' ? (
          <>
            <input placeholder="Buscar por nome/CPF" value={q} onChange={e => setQ(e.target.value)} />
            <label>De: <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label>Até: <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          </>
        ) : (
          <>
            <label>Ano: <input type="number" min="2000" max="2100" value={year} onChange={e => setYear(e.target.value)} style={{ width: 100 }} /></label>
            <input placeholder="Tipo de exame (filtra mensal)" value={tipo} onChange={e => setTipo(e.target.value)} />
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Status (todos)</option>
              <option value="PENDENTE">PENDENTE</option>
              <option value="EM_PREPARO_INICIAL">EM_PREPARO_INICIAL</option>
              <option value="CONCLUIDO">CONCLUIDO</option>
            </select>
            <label>De (YYYY-MM): <input type="month" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label>Até (YYYY-MM): <input type="month" value={to} onChange={e => setTo(e.target.value)} /></label>
          </>
        )}
        <button className="export" onClick={exportCSV} disabled={!data.length}>Exportar CSV</button>
      </div>

      {/* Totais */}
      {tab === 'exams' ? (
        <div style={{marginBottom: 8, fontSize: 14, opacity: .85}}>
          Total mensal no período: <b>{totalMonthly}</b> &nbsp;|&nbsp; Total por tipo no período: <b>{totalByType}</b>
        </div>
      ) : (
        <div style={{marginBottom: 8, fontSize: 14, opacity: .85}}>
          Total: <b>{data.length}</b> registro{data.length === 1 ? '' : 's'}
        </div>
      )}

      {/* Conteúdo */}
      <div className="table-wrap">
        {loading && <div className="state">Carregando…</div>}
        {err && !loading && <div className="state error">{err}</div>}
        {!loading && !err && data.length === 0 && <div className="state">Nenhum registro encontrado.</div>}

        {!loading && !err && (tab === 'exams') && byType.length > 0 && pie && (
          <div className="pie-row">
            <div className="pie-chart" style={{ background: pie.gradient }}>
              <div className="pie-center">
                <div style={{ fontSize: 12, opacity: .8 }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{totalByType}</div>
              </div>
            </div>
            <div className="pie-legend">
              {pie.items.map((it, i) => {
                const pct = totalByType ? ((it.value / totalByType) * 100) : 0;
                return (
                  <div key={i} className="legend-item">
                    <span className="dot" style={{ background: it.color }} />
                    <span className="label">{it.label}</span>
                    <span className="sep">—</span>
                    <span className="value">{it.value}</span>
                    <span className="pct">({pct.toFixed(1)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !err && data.length > 0 && (
          <table>
            <thead>
              <tr>
                {tab === 'patients' ? (
                  <>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Telefone</th>
                    <th>Data Cadastro</th>
                  </>
                ) : (
                  <>
                    <th>Mês</th>
                    <th>Quantidade</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) =>
                tab === 'patients' ? (
                  <tr key={i}>
                    <td>{item.nome}</td>
                    <td>{item.cpf}</td>
                    <td>{item.telefone}</td>
                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td>{monthLabel(item.month)}</td>
                    <td>{item.total}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
