import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import examsRoutes from './routes/exams.js';
import patientsRoutes from './routes/patients.js';
import { authRequired, allowRoles } from './middleware/auth.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*'}));
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'DB error' });
  }
});

app.use('/auth', authRoutes);
app.use('/users', authRequired, allowRoles('ADMIN'), usersRoutes);
app.use('/exams', authRequired, allowRoles('ADMIN','FUNCIONARIO','PATOLOGISTA'), examsRoutes);
app.use('/patients', authRequired, allowRoles('ADMIN','FUNCIONARIO'), patientsRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
