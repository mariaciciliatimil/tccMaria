import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
const token = () => localStorage.getItem("token") || "";

const PRIORITY_UI = {
  1: { name: "P1 — Emergência", bg: "#ffe0e0", br: "#f3b4b4", dot: "#e11d48" },
  2: { name: "P2 — Muito urgente", bg: "#ffe9d6", br: "#f7cfa7", dot: "#f59e0b" },
  3: { name: "P3 — Urgente", bg: "#fff6cc", br: "#f4e79a", dot: "#f59e0b" },
  4: { name: "P4 — Rotina", bg: "#e6f7e6", br: "#bfe7bf", dot: "#10b981" },
};

function Pill({ children, color = "#cbd5e1", bg = "#fff" }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: bg,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
    </span>
  );
}

export default function ExamAnalysisModal({
  open,
  bandejaId,        // id do registro na exam_tray
  examId,           // id do exame
  onClose,          // (result) => void
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [exam, setExam] = useState(null);      // detalhes do exame (/exams/:id)
  const [slides, setSlides] = useState([]);    // etiquetas (/exams/:id/slides)
  const [history, setHistory] = useState([]);  // exames do paciente (/patients/:id/exams)
  const [concluding, setConcluding] = useState(false);

  const headers = useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` }),
    []
  );

  useEffect(() => {
    if (!open || !examId) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // 1) detalhes do exame (já retorna patient_id e patient_name)
        const r1 = await fetch(`${API}/exams/${examId}`, { headers });
        const d1 = await r1.json();
        if (!r1.ok) throw new Error(d1.error || "Falha ao buscar detalhes do exame");
        setExam(d1);

        // 2) etiquetas do exame
        const r2 = await fetch(`${API}/exams/${examId}/slides`, { headers });
        const d2 = await r2.json();
        setSlides(Array.isArray(d2) ? d2 : []);

        // 3) histórico do paciente (outros exames)
        if (d1?.patient_id) {
          const r3 = await fetch(`${API}/patients/${d1.patient_id}/exams`, { headers });
          const d3 = await r3.json();
          const arr = (Array.isArray(d3) ? d3 : []).filter((e) => e.id !== examId);
          setHistory(arr);
        } else {
          setHistory([]);
        }
      } catch (e) {
        console.error(e);
        setErr(e.message || "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, examId, headers]);

  if (!open) return null;

  const pr = PRIORITY_UI[exam?.priority || 4] || PRIORITY_UI[4];

  async function concluirExame() {
    if (!bandejaId) return;
    if (!confirm("Confirmar conclusão do exame?")) return;
    try {
      setConcluding(true);
      const res = await fetch(`${API}/patologista/${bandejaId}/concluir`, {
        method: "PATCH",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao concluir exame");
      onClose?.({ concluded: true, data });
    } catch (e) {
      alert(e.message || "Erro ao concluir");
    } finally {
      setConcluding(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
        padding: 16,
      }}
      onClick={() => onClose?.({ concluded: false })}
    >
      <div
        style={{
          width: "min(920px, 98vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          padding: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Análise do exame #{examId}</h3>
          <button
            onClick={() => onClose?.({ concluded: false })}
            style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 10, padding: "8px 10px" }}
          >
            Fechar
          </button>
        </div>

        {loading && <div style={{ marginTop: 12, color: "#64748b" }}>Carregando…</div>}
        {err && <div style={{ marginTop: 12, color: "#b91c1c" }}>{err}</div>}

        {!loading && exam && (
          <>
            {/* Cabeçalho do exame */}
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${pr.br}`,
                background: pr.bg,
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {String(exam.type || "").toUpperCase().replaceAll("_", " ")}
              </div>
              <div style={{ color: "#334155", marginTop: 4 }}>
                Paciente: <b>{exam.patient_name}</b>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Pill color={pr.br} bg="#fff">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: pr.dot,
                      display: "inline-block",
                    }}
                  />
                  Prioridade: {PRIORITY_UI[exam.priority || 4]?.name || "P4 — Rotina"}
                </Pill>
                <Pill>
                  Status: <b>{exam.status}</b>
                </Pill>
                {exam.prep_laminas ? <Pill>Lâminas: {exam.prep_laminas}</Pill> : null}
                {exam.prep_responsavel ? <Pill>Preparo por: {exam.prep_responsavel}</Pill> : null}
              </div>
            </div>

            {/* Etiquetas */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Etiquetas deste exame</div>
              {slides.length === 0 ? (
                <div style={{ color: "#64748b" }}>Sem etiquetas geradas para este exame.</div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {slides.map((s) => (
                    <Pill key={s.seq}>
                      #{s.seq} — <code style={{ fontSize: 12 }}>{s.label}</code>
                      {s.printed_at ? (
                        <span style={{ color: "#16a34a" }}>• impresso</span>
                      ) : (
                        <span style={{ color: "#64748b" }}>• pendente</span>
                      )}
                    </Pill>
                  ))}
                </div>
              )}
            </div>

            {/* Histórico do paciente */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Histórico do paciente (nesta clínica)
              </div>
              {history.length === 0 ? (
                <div style={{ color: "#64748b" }}>Sem outros exames deste paciente.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                  {history.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {String(h.type || "").replaceAll("_", " ")}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {new Date(h.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações */}
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => onClose?.({ concluded: false })}
                style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px" }}
              >
                Cancelar
              </button>
              <button
                disabled={concluding}
                onClick={concluirExame}
                style={{
                  border: "none",
                  background: "#16a34a",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontWeight: 800,
                  cursor: "pointer",
                  opacity: concluding ? 0.7 : 1,
                }}
              >
                {concluding ? "Concluindo..." : "Concluir exame"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
