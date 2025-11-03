// src/routes/auth.js
import { Router } from 'express';
import { query } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRequired } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES || '8h';
const USE_AUTH_COOKIE = process.env.AUTH_COOKIE === '1'; // opcional

function signToken(user) {
  // payload compacto com o que as rotas precisam
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

/**
 * POST /auth/bootstrap-admin
 * Cria um admin padrão se não existir.
 */
router.post('/bootstrap-admin', async (req, res) => {
  try {
    const { email = 'admin@local', password = 'admin123', name = 'Admin' } = req.body || {};
    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rowCount > 0) {
      return res.json({ ok: true, message: 'Admin já existe' });
    }
    const hash = await bcrypt.hash(password, 10);
    await query(
      'INSERT INTO users (name, email, password_hash, role, enabled) VALUES ($1,$2,$3,$4, TRUE)',
      [name, email, hash, 'ADMIN']
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao criar admin' });
  }
});

/**
 * POST /auth/login
 * body: { email, password }
 * retorna: { token, user }
 * se AUTH_COOKIE=1, também seta cookie httpOnly "token"
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const { rows } = await query(
      'SELECT id, name, email, password_hash, role, enabled FROM users WHERE email=$1',
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const u = rows[0];
    if (!u.enabled) {
      return res.status(403).json({ error: 'Usuário desativado' });
    }

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = signToken(u);
    const user = { id: u.id, name: u.name, email: u.email, role: u.role };

    if (USE_AUTH_COOKIE) {
      // Define o cookie httpOnly (precisa CORS com credentials no frontend)
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',          // ajuste para 'none' + secure em produção com HTTPS
        secure: !!process.env.COOKIE_SECURE, // defina COOKIE_SECURE=1 em produção HTTPS
        maxAge: 1000 * 60 * 60 * 8 // 8h (sincronizado com expiresIn)
      });
    }

    return res.json({ token, user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro no login' });
  }
});

/**
 * GET /auth/me
 * Requer authRequired (preenche req.user).
 */
router.get('/me', authRequired, async (req, res) => {
  return res.json({ user: req.user });
});

/**
 * POST /auth/logout
 * Só relevante se estiver usando cookie httpOnly.
 */
router.post('/logout', (req, res) => {
  if (USE_AUTH_COOKIE) {
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: !!process.env.COOKIE_SECURE });
  }
  return res.json({ ok: true });
});

export default router;
