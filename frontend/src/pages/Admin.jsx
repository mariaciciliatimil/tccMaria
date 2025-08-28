import React, { useEffect, useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const token = () => localStorage.getItem('token') || ''
export default function Admin() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'FUNCIONARIO' })
  const [msg, setMsg] = useState('')
  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token()}` } })
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  async function createUser(e) {
    e.preventDefault(); setMsg('')
    const res = await fetch(`${API}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Erro ao criar usuário')
    setForm({ name: '', email: '', password: '', role: 'FUNCIONARIO' })
    setMsg('Usuário criado com sucesso'); load()
  }
  async function toggleEnabled(u) {
    setMsg('')
    const res = await fetch(`${API}/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ enabled: !u.enabled }) })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Erro ao atualizar'); load()
  }
  async function changeRole(u, role) {
    setMsg('')
    const res = await fetch(`${API}/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ role }) })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Erro ao alterar papel'); load()
  }
  async function resetPassword(u) {
    const pwd = prompt(`Nova senha para ${u.email}:`); if (!pwd) return
    setMsg('')
    const res = await fetch(`${API}/users/${u.id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ password: pwd }) })
    const data = await res.json()
    if (!res.ok) return setMsg(data.error || 'Erro ao alterar senha'); setMsg('Senha atualizada')
  }
  const inputStyle = { width:'100%',padding:'8px 10px',border:'1px solid #ccc',borderRadius:8,marginBottom:8 }
  return (
    <div style={{display:'grid',gridTemplateColumns:'420px 1fr',gap:24,padding:24}}>
      <div style={{background:'#fff',padding:16,borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,.06)'}}>
        <h3 style={{marginTop:0}}>Criar usuário</h3>
        <form onSubmit={createUser}>
          <label>Nome</label>
          <input style={inputStyle} value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
          <label>E-mail</label>
          <input style={inputStyle} type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
          <label>Senha provisória</label>
          <input style={inputStyle} type="text" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required />
          <label>Papel</label>
          <select style={inputStyle} value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
            <option value="FUNCIONARIO">Funcionário</option>
            <option value="PATOLOGISTA">Patologista</option>
          </select>
          <button type="submit" style={{padding:'10px 14px',border:'none',borderRadius:8,background:'#0f766e',color:'#fff',fontWeight:600}}>Salvar</button>
          {msg && <div style={{marginTop:10,color:'#0f766e'}}>{msg}</div>}
        </form>
      </div>
      <div style={{background:'#fff',padding:16,borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,.06)'}}>
        <h3 style={{marginTop:0}}>Usuários</h3>
        {loading ? <p>Carregando...</p> : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr><th style={{textAlign:'left',padding:8}}>Nome</th><th style={{textAlign:'left',padding:8}}>E-mail</th><th style={{textAlign:'left',padding:8}}>Papel</th><th style={{textAlign:'left',padding:8}}>Status</th><th style={{textAlign:'left',padding:8}}>Ações</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{borderTop:'1px solid #eee'}}>
                  <td style={{padding:8}}>{u.name}</td>
                  <td style={{padding:8}}>{u.email}</td>
                  <td style={{padding:8}}>
                    <select value={u.role} onChange={e=>changeRole(u, e.target.value)}>
                      <option value="ADMIN">ADMIN</option>
                      <option value="FUNCIONARIO">FUNCIONARIO</option>
                      <option value="PATOLOGISTA">PATOLOGISTA</option>
                    </select>
                  </td>
                  <td style={{padding:8}}>{u.enabled ? 'Ativo' : 'Suspenso'}</td>
                  <td style={{padding:8,display:'flex',gap:8}}>
                    <button onClick={()=>toggleEnabled(u)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid #ccc',background:'#fff'}}>
                      {u.enabled ? 'Suspender' : 'Reativar'}
                    </button>
                    <button onClick={()=>resetPassword(u)} style={{padding:'6px 10px',borderRadius:8,border:'1px solid #ccc',background:'#fff'}}>
                      Resetar senha
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan="5" style={{padding:8,color:'#777'}}>Sem usuários.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
