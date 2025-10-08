import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
const token = () => localStorage.getItem("token") || "";

// Mapa de prioridades (cores claras)
const PR = {
  1: { label: "Emergência",    color: "#ffe0e0" }, // vermelho claro
  2: { label: "Muito urgente", color: "#ffe9d6" }, // laranja claro
  3: { label: "Urgente",       color: "#fff6cc" }, // amarelo claro
  4: { label: "Rotina",        color: "#e6f7e6" }, // verde claro
};

function PriorityTag({ level = 4 }) {
  const p = PR[level] || PR[4];
  return (
    <span style={{
      background: p.color,
      padding: "4px 8px",
      borderRadius: 999,
      fontSize: 12,
      border: "1px solid #dfe5ea",
      fontWeight: 700
    }}>
      {p.label}
    </span>
  );
}

export default function Bandejas() {
  const headers = useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` }),
    []
  );
  const [concluidos, setConcluidos] = useState([]);
  const [bandeja, setBandeja] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const [cRes, bRes] = await Promise.all([
        fetch(`${API}/exams/concluded`, { headers }),
        fetch(`${API}/exams/tray-today`, { headers })
      ]);
      const cData = await cRes.json();
      const bData = await bRes.json();
      if (!cRes.ok) throw new Error(cData?.error || "Erro ao listar concluídos");
      if (!bRes.ok) throw new Error(bData?.error || "Erro ao listar bandeja");
      setConcluidos(cData);
      setBandeja(bData);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function addToTray(examId) {
    try {
      const res = await fetch(`${API}/exams/${examId}/add-to-tray`, {
        method: "POST",
        headers,
        body: JSON.stringify({ note: null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao adicionar na bandeja");
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function updateTrayNote(trayId, note) {
    try {
      const res = await fetch(`${API}/exams/tray/${trayId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ note: note ?? null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao atualizar observação");
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function removeFromTray(trayId) {
    if (!confirm("Remover este exame da bandeja do dia?")) return;
    try {
      const res = await fetch(`${API}/exams/tray/${trayId}`, { method: "DELETE", headers });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Falha ao remover");
      }
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  const styles = {
    wrap: { padding: "12px 20px", maxWidth: 1400, margin: "0 auto" },
    title: { textAlign: "center", fontWeight: 800, marginBottom: 14 },
    grid: { display: "grid", gridTemplateColumns: "420px 1fr", gap: 18 },
    col: { background: "#eef1f4", borderRadius: 14, padding: 16, minHeight: 520 },
    head: { fontWeight: 900, marginBottom: 10 },
    card: (prio) => ({
      background: "#fff",
      borderRadius: 10,
      padding: 12,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      marginBottom: 10,
      borderLeft: `6px solid ${PR[prio]?.color || PR[4].color}`, // faixa lateral pela prioridade
    }),
    rowTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    sub: { fontSize: 13, color: "#374151" },
    small: { fontSize: 12, color: "#6b7280" },
    btn: { padding: "6px 10px", border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", cursor: "pointer", fontWeight: 700 }
  };

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Bandejas</h2>

      {err && <div style={{ color: "tomato", marginBottom: 8 }}>{err}</div>}

      <div style={styles.grid}>
        {/* ESQUERDA: concluídos */}
        <section style={styles.col}>
          <div style={styles.head}>Exames concluídos</div>
          {loading && <div>Carregando…</div>}
          {!loading && concluidos.length === 0 && <div style={{ opacity: .7 }}>Sem itens</div>}
          {!loading && concluidos.map(x => (
            <div key={x.id} style={styles.card(x.priority)}>
              <div style={styles.rowTop}>
                <div style={{ fontWeight: 800 }}>{x.patient_name} • #{x.id}</div>
                <PriorityTag level={x.priority} />
              </div>
              <div style={styles.sub}>
                Exame: {String(x.type || '').replaceAll('_',' ')}
              </div>
              <div style={styles.small}>Concluído em: {new Date(x.created_at).toLocaleString()}</div>
              <div style={{ marginTop: 8 }}>
                <button style={styles.btn} onClick={() => addToTray(x.id)}>Adicionar à bandeja do dia</button>
              </div>
            </div>
          ))}
        </section>

        {/* DIREITA: bandeja do dia (editar só Obs. e Excluir) */}
        <section style={styles.col}>
          <div style={styles.head}>Bandeja do dia</div>
          {loading && <div>Carregando…</div>}
          {!loading && bandeja.length === 0 && <div style={{ opacity: .7 }}>Sem itens na bandeja hoje</div>}
          {!loading && bandeja.map(t => (
            <TrayNoteCard
              key={t.tray_id}
              item={t}
              onSaveNote={(n) => updateTrayNote(t.tray_id, n)}
              onRemove={() => removeFromTray(t.tray_id)}
              styles={styles}
            />
          ))}
        </section>
      </div>

      <div style={{ marginTop: 12 }}>
        <button style={styles.btn} onClick={load} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</button>
      </div>
    </div>
  );
}

function TrayNoteCard({ item, onSaveNote, onRemove, styles }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note ?? "");

  return (
    <div style={styles.card(item.priority)}>
      <div style={styles.rowTop}>
        <div style={{ fontWeight: 800 }}>{item.patient_name} • #{item.exam_id}</div>
        <PriorityTag level={item.priority} />
      </div>
      <div style={styles.sub}>
        Exame: {String(item.type || '').replaceAll('_',' ')}
      </div>
      <div style={styles.small}>Adicionado em: {new Date(item.created_at).toLocaleString()}</div>

      {!editing ? (
        <>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <b>Obs.:</b> {item.note || "—"}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={styles.btn} onClick={() => setEditing(true)}>Editar</button>
            <button style={styles.btn} onClick={onRemove}>Excluir</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginTop: 8 }}>
            <div style={{ alignSelf: "center" }}><b>Obs.</b></div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (opcional)" />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={styles.btn} onClick={() => { onSaveNote(note); setEditing(false); }}>Salvar</button>
            <button style={styles.btn} onClick={() => { setNote(item.note ?? ""); setEditing(false); }}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}
