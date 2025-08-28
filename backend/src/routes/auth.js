import { Router } from 'express';
import { query } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authRequired } from '../middleware/auth.js';
const router = Router();
router.post('/bootstrap-admin', async (req, res) => {
  try {
    const { email = 'admin@local', password = 'admin123', name = 'Admin' } = req.body || {};
    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rowCount > 0) return res.json({ ok: true, message: 'Admin já existe' });
    const hash = await bcrypt.hash(password, 10);
    await query('INSERT INTO users (name, email, password_hash, role, enabled) VALUES ($1,$2,$3,$4, TRUE)', [name, email, hash, 'ADMIN']);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Erro ao criar admin' }); }
});
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  try {
    const { rows } = await query('SELECT id, name, email, password_hash, role, enabled FROM users WHERE email=$1', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });
    const u = rows[0];
    if (!u.enabled) return res.status(403).json({ error: 'Usuário desativado' });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ id: u.id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro no login' }); }
});
router.get('/me', authRequired, async (req, res) => { res.json({ user: req.user }) });
export default router;
