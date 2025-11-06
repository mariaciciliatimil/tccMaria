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
  return {
    background: s.bg,
    border: `1px solid ${s.br}`,
  };
}

export default function QueuePatologista() {
  const [onlyToday, setOnlyToday] = useState(true);
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` }),
    []
  );

  async function load() {
    setLoading(true);
    try {
      // 👉 usa apenas a rota que existe no backend
      const res = await fetch(`${API}/exams/tray-today`, { headers });
      const data = await res.json();

      // normaliza
      let arr = Array.isArray(data)
        ? data.map((r) => ({
            id: r.exam_id ?? r.id,
            exam_id: r.exam_id ?? r.id,
            type: r.type,
            priority: r.priority ?? 4,
            patient_name: r.patient_name,
            tray_status: r.tray_status ?? "NA_FILA",
            created_at: r.created_at,
          }))
        : [];

      // filtro texto
      if (q) {
        const k = q.toLowerCase();
        arr = arr.filter(
          (it) =>
            (it.patient_name || "").toLowerCase().includes(k) ||
            (it.type || "").toLowerCase().includes(k)
        );
      }

      // (por garantia) apenas hoje
      if (onlyToday) {
        const today = new Date().toISOString().slice(0, 10);
        arr = arr.filter((it) => (it.created_at || "").slice(0, 10) === today);
      }

      setItems(arr);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
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
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #d0d5dd",
            borderRadius: 8,
            outline: "none",
          }}
          placeholder="Buscar paciente ou tipo de exame…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <button
          onClick={load}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: "pointer",
          }}
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
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: v.dot,
                display: "inline-block",
              }}
            />
            {v.name}
          </span>
        ))}
      </div>

      {loading && <div style={{ color: "#64748b" }}>Carregando…</div>}

      {!loading && items.length === 0 && (
        <div style={{ color: "#64748b" }}>Nenhum exame na fila.</div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          marginTop: 12,
        }}
      >
        {items.map((ex) => (
          <div
            key={ex.exam_id}
            style={{
              ...priorityStyle(ex.priority),
              borderRadius: 12,
              padding: 14,
              boxShadow: "0 8px 24px rgba(0,0,0,.06)",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              {String(ex.type || "").toUpperCase().replaceAll("_", " ")}
            </div>
            <div style={{ color: "#334155", marginBottom: 8 }}>{ex.patient_name}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              {new Date(ex.created_at).toLocaleString()}
              {ex.tray_status ? (
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
                  {ex.tray_status}
                </span>
              ) : null}
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
              onClick={() => {
                // TODO: implementar iniciar análise (quando você criar a rota)
                alert(`Iniciar análise do exame #${ex.exam_id}`);
              }}
            >
              Iniciar análise
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
