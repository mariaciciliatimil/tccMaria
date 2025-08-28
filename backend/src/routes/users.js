import { Router } from 'express';
import { query } from '../db.js';
const router = Router();
const ROLES = ['FUNCIONARIO', 'PATOLOGISTA'];
router.get('/', async (req, res) => {
  const { rows } = await query('SELECT id, name, email, role, enabled, created_at FROM users ORDER BY id DESC');
  res.json(rows);
});
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password e role são obrigatórios' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'role inválido (use FUNCIONARIO ou PATOLOGISTA)' });
  const exists = await query('SELECT 1 FROM users WHERE email=$1', [email]);
  if (exists.rowCount) return res.status(409).json({ error: 'E-mail já cadastrado' });
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query('INSERT INTO users (name, email, password_hash, role, enabled) VALUES ($1,$2,$3,$4, TRUE) RETURNING id, name, email, role, enabled', [name, email, hash, role]);
  res.status(201).json(rows[0]);
});
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, role, enabled } = req.body || {};
  if (enabled === false || role === 'FUNCIONARIO' || role === 'PATOLOGISTA') {
    const lastAdminCheck = await query("SELECT COUNT(*)::int AS cnt FROM users WHERE role='ADMIN' AND enabled=TRUE AND id <> $1", [id]);
    if (lastAdminCheck.rows[0].cnt === 0) return res.status(400).json({ error: 'Não é permitido remover/desativar o único ADMIN' });
  }
  const fields = []; const params = []; let i = 1;
  if (name !== undefined) { fields.push(`name=$${i++}`); params.push(name); }
  if (role !== undefined) { if (!['ADMIN','FUNCIONARIO','PATOLOGISTA'].includes(role)) return res.status(400).json({ error: 'role inválido' }); fields.push(`role=$${i++}`); params.push(role); }
  if (enabled !== undefined) { fields.push(`enabled=$${i++}`); params.push(!!enabled); }
  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
  params.push(id);
  const sql = `UPDATE users SET ${fields.join(', ')} WHERE id=$${i} RETURNING id, name, email, role, enabled`;
  const { rows } = await query(sql, params);
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(rows[0]);
});
router.post('/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password é obrigatório' });
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query('UPDATE users SET password_hash=$1 WHERE id=$2 RETURNING id', [hash, id]);
  if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ ok: true });
});
export default router;
