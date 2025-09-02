// src/pages/Admin/CreateUser.jsx
import "../../styles/admin-users.css";
import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
const token = () => localStorage.getItem("token") || "";

export default function CreateUser() {
  const [form,setForm] = useState({name:"",email:"",password:"",role:"FUNCIONARIO"});

  const submit = async e => {
    e.preventDefault();
    await fetch(`${API}/users`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token()}` },
      body: JSON.stringify(form),
    });
    alert("Usuário criado!");
  };

  return (
    <section className="users-card" style={{maxWidth:760, margin:"0 auto"}}>
      <h2 className="users-card__title" style={{marginBottom:12}}>Novo Usuário</h2>
      <form className="users-form" onSubmit={submit}>
        <input className="input" placeholder="Nome" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        <input className="input" placeholder="E-mail" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
        <input className="input" placeholder="Senha provisória" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
        <select className="select" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
          <option value="ADMIN">Admin</option>
          <option value="FUNCIONARIO">Funcionário</option>
          <option value="PATOLOGISTA">Patologista</option>
        </select>
        <button className="btn-primary btn-shadow" type="submit">Salvar</button>
      </form>
    </section>
  );
}
