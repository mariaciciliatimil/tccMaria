// src/pages/Patologista/Queue.jsx
import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
const token = () => localStorage.getItem("token") || "";

const PRIORITY_UI = {
  1: { name: "P1 — Emergência", bg: "#ffe0e0", br: "#f3b4b4", dot: "#e11d48" },
  2: { name: "P2 — Muito urgente", bg: "#ffe9d6", br: "#f7cfa7", dot: "#f59e0b" },
  3: { name: "P3 — Urgente", bg: "#fff6cc", br: "#f4e79a", dot: "#f59e0b" },
  4: { name: "P4 — Rotina", bg: "#e6f7e6", br: "#bfe7bf", dot: "#10b981" },
};
function priorityStyle(p = 4) {
  const s = PRIORITY_UI[p] || PRIORITY_UI[4];
  return { background: s.bg, border: `1px solid ${s.br}` };
}

export default function QueuePatologista() {
  const [onlyToday, setOnlyToday] = useState(true);
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);          // NA_FILA
  const [doneToday, setDoneToday] = useState([]);  // CONCLUIDO (hoje)
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // modal
  const [open, setOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalErr, setModalErr] = useState("");
  const [bandejaId, setBandejaId] = useState(null);
  const [exam, setExam] = useState(null);       // GET /exams/:id
  const [slides, setSlides] = useState([]);     // GET /exams/:id/slides
  const [history, setHistory] = useState([]);   // GET /patients/:id/history

  const headers = useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` }),
    []
  );

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      // Fila NA_FILA
      const res = await fetch(
        `${API}/patologista/fila?status=NA_FILA&hoje=${onlyToday ? 1 : 0}&busca=${encodeURIComponent(q)}`,
        { headers }
      );
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Resposta inesperada");
      setItems(data);

      // Concluídos hoje (listar em baixo)
      const resDone = await fetch(
        `${API}/patologista/fila?status=CONCLUIDO&hoje=1&busca=${encodeURIComponent(q)}`,
        { headers }
      );
      const dataDone = await resDone.json();
      setDoneToday(Array.isArray(dataDone) ? dataDone : []);
    } catch (e) {
      console.error(e);
      setMsg("Erro ao carregar fila do patologista");
      setItems([]);
      setDoneToday([]);
    } finally {
      setLoading(false);
    }
  }

  // inicia análise e abre modal com dados
  async function iniciarAnalise(bId, examId) {
    if (!window.confirm("Deseja iniciar a análise deste exame?")) return;
    try {
      const res = await fetch(`${API}/patologista/${bId}/iniciar`, { method: "PATCH", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar análise");

      // abre modal com os dados do exame
      await openModal(bId, examId);
      // recarrega cards para sair da “NA_FILA”
      load();
    } catch (e) {
      console.error(e);
      alert(`Erro: ${e.message}`);
    }
  }

  async function openModal(bId, examId) {
    setOpen(true);
    setBandejaId(bId);
    setModalLoading(true);
    setModalErr("");
    setExam(null);
    setSlides([]);
    setHistory([]);
    try {
      // 1) detalhes do exame
      const r1 = await fetch(`${API}/exams/${examId}`, { headers });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error || "Falha ao buscar detalhes do exame");
      setExam(d1);

      // 2) etiquetas
      const r2 = await fetch(`${API}/exams/${examId}/slides`, { headers });
      const d2 = await r2.json();
      setSlides(Array.isArray(d2) ? d2 : []);

      // 3) histórico do paciente
      if (d1?.patient_id) {
        const r3 = await fetch(`${API}/patients/${d1.patient_id}/history`, { headers });
        const d3 = await r3.json();
        setHistory(Array.isArray(d3) ? d3 : []);
      }
    } catch (e) {
      console.error(e);
      setModalErr(e.message || "Erro ao carregar dados do exame");
    } finally {
      setModalLoading(false);
    }
  }

  async function concluirAnalise() {
    if (!bandejaId) return;
    if (!window.confirm("Confirmar conclusão do exame?")) return;
    try {
      const res = await fetch(`${API}/patologista/${bandejaId}/concluir`, { method: "PATCH", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao concluir exame");

      setOpen(false);
      // recarrega listas (sai da análise e cai nos concluídos)
      load();
    } catch (e) {
      console.error(e);
      alert(`Erro: ${e.message}`);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q, onlyToday]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingTop: 6 }}>
      <h1 style={{ textAlign: "center", marginBottom: 20 }}>ÁREA DO PATOLOGISTA</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={onlyToday} onChange={(e) => setOnlyToday(e.target.checked)} />
          Apenas hoje
        </label>

        <input
          style={{ flex: 1, padding: "10px 12px", border: "1px solid #d0d5dd", borderRadius: 8, outline: "none" }}
          placeholder="Buscar paciente ou tipo de exame…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <button
          onClick={load}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
        >
          Atualizar
        </button>
      </div>

      {/* legenda de prioridades */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {Object.entries(PRIORITY_UI).map(([k, v]) => (
          <span
            key={k}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${v.br}`,
              background: v.bg,
              fontSize: 14,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: v.dot, display: "inline-block" }} />
            {v.name}
          </span>
        ))}
      </div>

      {loading && <div style={{ color: "#64748b" }}>Carregando…</div>}
      {msg && <div style={{ color: "#b91c1c" }}>{msg}</div>}
      {!loading && items.length === 0 && <div style={{ color: "#64748b" }}>Nenhum exame na fila.</div>}

      {/* Cards NA_FILA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 12 }}>
        {items.map((ex) => (
          <div
            key={ex.bandeja_id}
            style={{ ...priorityStyle(ex.prioridade), borderRadius: 12, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,.06)" }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              {String(ex.tipo_exame || "").toUpperCase().replaceAll("_", " ")}
            </div>
            <div style={{ color: "#334155", marginBottom: 8 }}>{ex.paciente}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              {new Date(ex.adicionado_em).toLocaleString()}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                }}
              >
                {ex.status_bandeja}
              </span>
            </div>

            <button
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
              }}
              onClick={() => iniciarAnalise(ex.bandeja_id, ex.exame_id)}
            >
              Iniciar análise
            </button>
          </div>
        ))}
      </div>

      {/* Concluídos de hoje */}
      <h2 style={{ marginTop: 28 }}>Concluídos hoje</h2>
      {doneToday.length === 0 ? (
        <div style={{ color: "#64748b" }}>Nenhum exame concluído hoje.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 8 }}>
          {doneToday.map((ex) => (
            <div key={`done-${ex.bandeja_id}`} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {String(ex.tipo_exame || "").toUpperCase().replaceAll("_", " ")}
              </div>
              <div style={{ color: "#334155" }}>{ex.paciente}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                Finalizado em: {ex.concluido_em ? new Date(ex.concluido_em).toLocaleString() : "-"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {open && (
        <div style={S.backdrop} onClick={() => setOpen(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Análise do Exame</h3>

            {modalLoading ? (
              <div>Carregando…</div>
            ) : modalErr ? (
              <div style={{ color: "#b91c1c" }}>{modalErr}</div>
            ) : (
              <>
                {/* Cabeçalho */}
                <div style={{ marginBottom: 10, color: "#334155" }}>
                  <div><b>Paciente:</b> {exam?.patient_name}</div>
                  <div><b>Tipo:</b> {String(exam?.type || "").replaceAll("_", " ")}</div>
                  <div><b>Prioridade:</b> {exam?.priority ?? "-"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Criado em: {exam?.created_at ? new Date(exam.created_at).toLocaleString() : "-"}
                  </div>
                </div>

                {/* Etiquetas */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Etiquetas</div>
                  {slides.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Sem etiquetas.</div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {slides.map((s) => (
                        <span
                          key={s.seq}
                          style={{
                            border: "1px dashed #94a3b8",
                            borderRadius: 8,
                            padding: "4px 8px",
                            background: "#f8fafc",
                            fontSize: 12,
                          }}
                        >
                          {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Histórico */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Histórico do paciente</div>
                  {history.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Sem exames anteriores.</div>
                  ) : (
                    <div style={{ maxHeight: 160, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={S.th}>#</th>
                            <th style={S.th}>Tipo</th>
                            <th style={S.th}>Prioridade</th>
                            <th style={S.th}>Criado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr key={h.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                              <td style={S.td}>{h.id}</td>
                              <td style={S.td}>{String(h.type || "").replaceAll("_", " ")}</td>
                              <td style={S.td}>{h.priority ?? "-"}</td>
                              <td style={S.td}>{h.created_at ? new Date(h.created_at).toLocaleString() : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                  <button onClick={() => setOpen(false)} style={S.btnGhost}>Fechar</button>
                  <button onClick={concluirAnalise} style={S.btnPrimary}>Concluir exame</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { width: 640, maxWidth: "96vw", background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,.2)" },
  th: { textAlign: "left", padding: 8, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" },
  td: { padding: 8 },
  btnGhost: { padding: "10px 14px", borderRadius: 10, border: "1px solid #d0d5dd", background: "#fff", cursor: "pointer" },
  btnPrimary: { padding: "10px 14px", borderRadius: 10, background: "#0ea5e9", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 },
};
