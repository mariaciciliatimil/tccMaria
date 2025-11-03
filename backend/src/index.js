// index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import examsRoutes from './routes/exams.js';
import patientsRoutes from './routes/patients.js';
import reportsRoutes from './routes/reports.js';
import patologistaRoutes from './routes/patologista.js'; // ✅ nova rota do patologista

import { authRequired, allowRoles } from './middleware/auth.js';

const app = express();

// === Configurações base ===
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true, // caso use cookie httpOnly
  })
);
app.use(express.json());

// === Health check ===
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: 'DB error' });
  }
});

// === Rotas principais ===
app.use('/auth', authRoutes);
app.use('/users', authRequired, allowRoles('ADMIN'), usersRoutes);
app.use(
  '/exams',
  authRequired,
  allowRoles('ADMIN', 'FUNCIONARIO', 'PATOLOGISTA'),
  examsRoutes
);
app.use(
  '/patients',
  authRequired,
  allowRoles('ADMIN', 'FUNCIONARIO'),
  patientsRoutes
);
app.use(
  '/reports',
  authRequired,
  allowRoles('ADMIN', 'FUNCIONARIO', 'PATOLOGISTA'),
  reportsRoutes
);

// ✅ Nova rota: Área do Patologista (Módulo IV)
app.use(
  '/patologista',
  authRequired,
  allowRoles('ADMIN', 'PATOLOGISTA'),
  patologistaRoutes
);

// === Tratamento 404 JSON ===
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// === Handler de erro genérico ===
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

// === Inicialização ===
const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`✅ API rodando em http://localhost:${port}`)
);
