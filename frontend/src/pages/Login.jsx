import React, { useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
export default function Login() {
  const [email, setEmail] = useState('admin@local')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function handleLogin(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no login')
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      const role = data.user.role
      if (role === 'ADMIN') location.href = '/admin'
      else if (role === 'FUNCIONARIO') location.href = '/funcionario'
      else if (role === 'PATOLOGISTA') location.href = '/patologista'
      else location.href = '/'
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }
  async function bootstrap() {
    await fetch(`${API}/auth/bootstrap-admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    alert('Bootstrap executado. Tente login com admin@local / admin123')
  }
  return (
    <div style={{display:'flex',minHeight:'100vh',alignItems:'center',justifyContent:'center',background:'#f4f6f8'}}>
      <form onSubmit={handleLogin} style={{background:'#fff',padding:24,borderRadius:12,width:360,boxShadow:'0 10px 30px rgba(0,0,0,.08)'}}>
        <h1 style={{marginTop:0,marginBottom:8,fontSize:22}}>Rastreamento Patológico</h1>
        <p style={{marginTop:0,marginBottom:20,color:'#666'}}>Acesse sua conta</p>
        <label style={{display:'block',fontSize:14,marginBottom:8}}>E-mail</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" style={{width:'100%',padding:'10px 12px',border:'1px solid #ccc',borderRadius:8,marginBottom:12}}/>
        <label style={{display:'block',fontSize:14,marginBottom:8}}>Senha</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" style={{width:'100%',padding:'10px 12px',border:'1px solid #ccc',borderRadius:8,marginBottom:4}}/>
        {error && <div style={{color:'#b00020',fontSize:14,margin:'8px 0 12px'}}>{error}</div>}
        <button disabled={loading} type="submit" style={{width:'100%',padding:'10px 14px',border:'none',borderRadius:8,background:'#0f766e',color:'#fff',fontWeight:600,marginTop:8}}>{loading?'Entrando...':'Entrar'}</button>
        <button type="button" onClick={bootstrap} style={{width:'100%',padding:'10px 14px',border:'1px solid #ccc',borderRadius:8,background:'#fff',color:'#333',fontWeight:600,marginTop:8}}>Criar admin (dev)</button>
        <p style={{fontSize:12,color:'#777',marginTop:12}}>Você será direcionado conforme seu papel.</p>
      </form>
    </div>
  )
}
