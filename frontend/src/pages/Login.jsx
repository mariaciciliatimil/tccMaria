import React, { useState } from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Login() {
  const [email, setEmail] = useState('admin@local')
  const [password, setPassword] = useState('admin123')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no login')

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      const role = data.user.role
      if (role === 'ADMIN') location.href = '/admin'
      else if (role === 'FUNCIONARIO') location.href = '/funcionario'
      else if (role === 'PATOLOGISTA') location.href = '/patologista'
      else location.href = '/'
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function bootstrap() {
    await fetch(`${API}/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    alert('Bootstrap executado. Tente login com admin@local / admin123')
  }

  return (
    <>
      {/* CSS local da página */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap');
        :root{
          --brand-1:#8DC3DA; --brand-2:#69AECA; --ink:#0b1f2a; --muted:#6b7280;
          --bg:#f6f9fc; --accent:#0f766e; --accent-2:#0e4a62;
        }
        *{ box-sizing:border-box }
        html, body, #root{ height:100% }
        body{ margin:0; font-family: 'Poppins', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:var(--bg); color:var(--ink); }

        .login-grid{
          display:grid; grid-template-columns: 1fr 1fr; min-height:100vh;
        }

        /* Lado da marca (esquerda) */
        .brand{
          position:relative; overflow:hidden; color:#083241;
          background: linear-gradient(180deg, var(--brand-1) 0%, var(--brand-2) 100%);
          display:flex; align-items:center; justify-content:center; padding:40px;
        }
        .brand .content{ text-align:center; max-width:520px; animation:fadeUp .6s ease-out both }
        .brand h1{ font-size:64px; line-height:1; margin:0 0 6px; font-weight:800; letter-spacing:1.2px }
        .brand .rule{ width:120px; height:4px; background:#0e4a62; border-radius:999px; margin:10px auto 16px }
        .brand .subtitle{ font-size:20px; font-weight:600; opacity:.95; }
        .brand .img{
          margin-top:28px;
          width:min(360px, 80%);
          filter: drop-shadow(0 18px 40px rgba(0,0,0,.15));
          animation: float 6s ease-in-out infinite;
        }
        .bubble{ position:absolute; border-radius:50%; opacity:.15; background:#fff; }
        .b1{ width:240px; height:240px; left:-60px; bottom:-60px; animation: drift 12s ease-in-out infinite }
        .b2{ width:160px; height:160px; right:-40px; top:80px; animation: drift 10s ease-in-out infinite reverse }
        .b3{ width:100px; height:100px; right:60px; bottom:40px; animation: drift 14s ease-in-out infinite }

        /* Lado do formulário (direita) */
        .form-side{ display:flex; align-items:center; justify-content:center; padding:40px }
        .card{
          width: 440px; max-width: 94vw;
          background:#fff; border-radius:24px;
          box-shadow: 0 24px 80px rgba(15, 70, 98, .15);
          padding: 28px; animation: pop .5s ease-out both
        }
        .title{ margin:0 0 6px; font-size:28px; font-weight:800; letter-spacing:.3px }
        .subtitle{ margin:0 0 22px; color:var(--muted); font-size:14px }

        .label{ display:block; font-size:13px; font-weight:700; margin:14px 0 8px }
        .input{
          width:100%; padding:12px 14px; border-radius:12px;
          border:1px solid #d1d5db; background:#f3f6fb; outline:none;
          transition: box-shadow .2s, border-color .2s, transform .1s;
        }
        .input:focus{ border-color:#93c5fd; box-shadow: 0 0 0 4px rgba(59,130,246,.15) }
        .pwd-wrap{ position:relative }
        .toggle{
          position:absolute; right:10px; top:50%; transform:translateY(-50%);
          padding:6px 8px; border-radius:8px; border:0; background:transparent;
          font-weight:600; color:#064e3b; cursor:pointer;
        }

        .btn{
          width:100%; padding:12px 16px; border:0; border-radius:999px;
          font-weight:700; color:#fff; background: linear-gradient(90deg, var(--accent), var(--accent-2));
          box-shadow: 0 14px 30px rgba(15,118,110,.25);
          transition: transform .08s ease, box-shadow .2s ease, filter .2s ease;
        }
        .btn:hover{ transform: translateY(-1px); filter: brightness(1.03) }
        .btn:active{ transform: translateY(0); filter: brightness(.97) }
        .btn[disabled]{ opacity:.7; cursor:not-allowed; transform:none; }

        .btn-ghost{
          width:100%; padding:12px 16px; border-radius:999px;
          border:1px solid #d1d5db; background:#fff; color:#0b1f2a; font-weight:700;
          transition: background .2s, transform .08s; margin-top:10px;
        }
        .btn-ghost:hover{ background:#f8fafc; transform: translateY(-1px) }

        .error{ color:#b00020; font-size:14px; margin:10px 0 0; animation: shake .2s linear 2 }

        @keyframes fadeUp { from{ opacity:0; transform: translateY(10px) } to{ opacity:1; transform:none } }
        @keyframes float { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-10px) } }
        @keyframes drift { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(12px,-10px) } }
        @keyframes pop { from{ transform: scale(.98); opacity:.5 } to{ transform: scale(1); opacity:1 } }
        @keyframes shake { 0%{transform:translateX(0)} 25%{transform:translateX(-3px)} 50%{transform:translateX(3px)} 75%{transform:translateX(-2px)} 100%{transform:translateX(0)} }

        @media (max-width: 980px){
          .login-grid{ grid-template-columns: 1fr }
          .brand{ min-height: 36vh }
        }
      `}</style>

      <div className="login-grid">
        {/* Lado esquerdo (marca) */}
        <div className="brand">
          <div className="bubble b1" />
          <div className="bubble b2" />
          <div className="bubble b3" />

          <div className="content">
            <h1>SIRP</h1>
            <div className="rule" />
            <div className="subtitle">SISTEMA DE RASTREAMENTO PATOLÓGICO</div>
            {/* Coloque sua ilustração em /public/sirp-login-illustration.svg */}
            <img className="img" src="/images/microscopio.png" alt="Ilustração" onError={(e)=>{e.currentTarget.style.display='none'}}/>
          </div>
        </div>

        {/* Lado direito (formulário) */}
        <div className="form-side">
          <form className="card" onSubmit={handleLogin}>
            <div className="title">Login</div>
            <div className="subtitle">Acesse sua conta para continuar</div>

            <label className="label">Usuário</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@empresa.com"
              autoFocus
              required
            />

            <label className="label">Senha</label>
            <div className="pwd-wrap">
              <input
                className="input"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="toggle"
                onClick={() => setShowPwd(s => !s)}
                aria-label="Mostrar/ocultar senha"
              >
                {showPwd ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            <button className="btn" disabled={loading} type="submit" style={{ marginTop: 16 }}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>

            {/* Ambiente de desenvolvimento */}
            <button type="button" onClick={bootstrap} className="btn-ghost">
              Criar admin (dev)
            </button>

            <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 12 }}>
              Você será direcionado conforme seu papel (Admin, Funcionário ou Patologista).
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
