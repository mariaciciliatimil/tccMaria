import React, { useEffect, useMemo, useState } from "react";
import "../styles/admin.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
const token = () => localStorage.getItem("token") || "";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // toolbar
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "FUNCIONARIO",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/users`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createUser(e) {
    e?.preventDefault?.();
    setMsg("");
    const res = await fetch(`${API}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Erro ao criar usuário");
    setForm({ name: "", email: "", password: "", role: "FUNCIONARIO" });
    setShowCreate(false);
    setMsg("Usuário criado com sucesso");
    load();
  }

  async function toggleEnabled(u) {
    setMsg("");
    const res = await fetch(`${API}/users/${u.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ enabled: !u.enabled }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Erro ao atualizar");
    load();
  }

  async function changeRole(u, role) {
    setMsg("");
    const res = await fetch(`${API}/users/${u.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Erro ao alterar papel");
    load();
  }

  async function resetPassword(u) {
    const pwd = prompt(`Nova senha para ${u.email}:`);
    if (!pwd) return;
    setMsg("");
    const res = await fetch(`${API}/users/${u.id}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ password: pwd }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Erro ao alterar senha");
    setMsg("Senha atualizada");
  }

  // filtro client-side (rápido e simples)
  const filtered = useMemo(() => {
    const byQ = (u) =>
      !q ||
      u.name?.toLowerCase().includes(q.toLowerCase()) ||
      u.email?.toLowerCase().includes(q.toLowerCase());

    const byRole = (u) => roleFilter === "ALL" || u.role === roleFilter;

    const byStatus = (u) =>
      statusFilter === "ALL" ||
      (u.enabled ? "ATIVO" : "SUSPENSO") === statusFilter;

    return users.filter((u) => byQ(u) && byRole(u) && byStatus(u));
  }, [users, q, roleFilter, statusFilter]);

  return (
    <div className="admin-shell">
      <header className="admin-header animate-drop">
        <div className="admin-header__titleblock">
          <h1 className="admin-title">Administração</h1>
          <p className="admin-subtitle">
            Gerencie usuários e configurações do sistema.
          </p>
        </div>
      </header>

      <main className="admin-content">
        {/* Toolbar com busca e filtros */}
        <div className="toolbar card animate-fade">
          <div className="toolbar-left">
            <input
              className="input search"
              placeholder="Buscar por nome ou e-mail…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              title="Filtrar por papel"
            >
              <option value="ALL">Todos os papéis</option>
              <option value="ADMIN">Admin</option>
              <option value="FUNCIONARIO">Funcionário</option>
              <option value="PATOLOGISTA">Patologista</option>
            </select>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filtrar por status"
            >
              <option value="ALL">Todos os status</option>
              <option value="ATIVO">Ativo</option>
              <option value="SUSPENSO">Suspenso</option>
            </select>
          </div>

          <button
            className="btn-primary btn-lg"
            onClick={() => setShowCreate(true)}
          >
            + Novo usuário
          </button>
        </div>

        {/* Lista */}
        <section className="card animate-fade users-card">
          <h3 className="card-title">Usuários</h3>

          {loading ? (
            <p>Carregando...</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Papel</th>
                    <th>Status</th>
                    <th className="th-actions">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="row-hover">
                      <td>{u.name}</td>
                      <td className="muted">{u.email}</td>
                      <td>
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="FUNCIONARIO">FUNCIONARIO</option>
                          <option value="PATOLOGISTA">PATOLOGISTA</option>
                        </select>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.enabled ? "badge--ok" : "badge--warn"
                          }`}
                        >
                          {u.enabled ? "Ativo" : "Suspenso"}
                        </span>
                      </td>
                      <td className="actions">
                        <button
                          onClick={() => toggleEnabled(u)}
                          className="btn-outline danger"
                        >
                          {u.enabled ? "Suspender" : "Reativar"}
                        </button>
                        <button
                          onClick={() => resetPassword(u)}
                          className="btn-ghost"
                        >
                          Resetar senha
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="5" className="muted">
                        Nenhum usuário encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Modal de criação */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div
            className="modal card animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Novo usuário</h3>
              <button
                className="btn-ghost close"
                onClick={() => setShowCreate(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {msg && <div className="msg-ok">{msg}</div>}

            <form className="form-grid" onSubmit={createUser}>
              <label>Nome</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <label>E-mail</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <label>Senha provisória</label>
              <input
                className="input"
                type="text"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                required
              />
              <label>Papel</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="ADMIN">Admin</option>
                <option value="FUNCIONARIO">Funcionário</option>
                <option value="PATOLOGISTA">Patologista</option>
              </select>

              <button type="submit" className="btn-primary btn-lg">
                Salvar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
