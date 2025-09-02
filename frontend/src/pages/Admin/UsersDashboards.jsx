// src/pages/Admin/UsersDashboard.jsx
import { useEffect, useState } from "react";
import "../../styles/admin-users.css";
import { Link } from "react-router-dom";

// adapte estes serviços conforme teu backend:
const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
const token = () => localStorage.getItem("token") || "";
const getUsers = async () => (await fetch(`${API}/users`, { headers:{Authorization:`Bearer ${token()}`}})).json();
const updateRole = async (id, role) =>
  fetch(`${API}/users/${id}/role`, { method:"PUT", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token()}`}, body:JSON.stringify({ role })});
const toggleActive = async (id, active) =>
  fetch(`${API}/users/${id}/active`, { method:"PUT", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token()}`}, body:JSON.stringify({ active })});
const resetPassword = async (id) =>
  fetch(`${API}/users/${id}/reset-password`, { method:"POST", headers:{ Authorization:`Bearer ${token()}`}});

export default function UsersDashboard() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  useEffect(() => { (async () => setUsers(await getUsers()))(); }, []);

  const filtered = users.filter(u => {
    const fQ = q ? (u.name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase())) : true;
    const fR = role === "ALL" ? true : u.role === role;
    const fS = status === "ALL" ? true : (u.active ? "ATIVO" : "SUSPENSO") === status;
    return fQ && fR && fS;
  });

  return (
    <section className="users-card">
      <div className="users-card__head">
        <div>
          <h2 className="users-card__title">Central de Usuários</h2>
          <p className="users-card__desc">Gerencie papéis, status e acessos.</p>
        </div>

        {/* se o botão também aparece no header e quiser evitar duplicidade, pode remover este aqui */}
        <Link to="/admin/users/new" className="btn-primary btn-shadow">+ Novo Usuário</Link>
      </div>

      <div className="users-toolbar">
        <input className="input" placeholder="Buscar por nome ou e-mail…" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="select" value={role} onChange={e=>setRole(e.target.value)}>
          <option value="ALL">Todos os papéis</option>
          <option value="ADMIN">Admin</option>
          <option value="FUNCIONARIO">Funcionário</option>
          <option value="PATOLOGISTA">Patologista</option>
        </select>
        <select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="ALL">Todos os status</option>
          <option value="ATIVO">Ativo</option>
          <option value="SUSPENSO">Suspenso</option>
        </select>
      </div>

      <div className="users-table">
        <div className="users-row users-row--head">
          <span>Nome</span><span>E-mail</span><span>Papel</span><span>Status</span><span>Ações</span>
        </div>

        {filtered.map(u => (
          <div key={u.id} className="users-row">
            <span className="ellipsis">{u.name}</span>
            <span className="muted ellipsis">{u.email}</span>

            <span>
              <select className="select" value={u.role}
                onChange={async e => { const role=e.target.value; await updateRole(u.id, role); setUsers(p=>p.map(x=>x.id===u.id?{...x,role}:x)); }}>
                <option value="ADMIN">Admin</option>
                <option value="FUNCIONARIO">Funcionário</option>
                <option value="PATOLOGISTA">Patologista</option>
              </select>
            </span>

            <span>
              <span className={`badge ${u.active ? "badge--ok" : "badge--warn"}`}>
                {u.active ? "Ativo" : "Suspenso"}
              </span>
            </span>

            <span className="actions">
              <button className="btn-outline danger"
                onClick={async ()=>{await toggleActive(u.id, !u.active); setUsers(p=>p.map(x=>x.id===u.id?{...x,active:!x.active}:x));}}>
                {u.active ? "Suspender" : "Reativar"}
              </button>
              <button className="btn-ghost" onClick={async ()=>{await resetPassword(u.id); alert("Senha provisória gerada/enviada.");}}>
                Resetar senha
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
