import { Router } from 'express';
import { query } from '../db.js';
const router = Router();
router.get('/board', async (req, res) => {
  const countsSql = `
    WITH last_steps AS (
      SELECT DISTINCT ON (exam_id) exam_id, status
      FROM exam_steps
      ORDER BY exam_id, started_at DESC, id DESC
    )
    SELECT COALESCE(ls.status, 'PENDENTE') AS status, COUNT(*)::int AS count
    FROM exams e
    LEFT JOIN last_steps ls ON ls.exam_id = e.id
    GROUP BY COALESCE(ls.status, 'PENDENTE')
  `;
  const itemsSql = `
    WITH last_steps AS (
      SELECT DISTINCT ON (exam_id) exam_id, status
      FROM exam_steps
      ORDER BY exam_id, started_at DESC, id DESC
    )
    SELECT e.id, e.type, e.priority, COALESCE(ls.status,'PENDENTE') AS status,
           p.name AS patient_name, e.created_at
    FROM exams e
    LEFT JOIN last_steps ls ON ls.exam_id = e.id
    LEFT JOIN patients p ON p.id = e.patient_id
    WHERE COALESCE(ls.status,'PENDENTE') = $1
    ORDER BY e.created_at DESC
    LIMIT 20
  `;
  try {
    const countsRes = await query(countsSql);
    const counts = { PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDO: 0 };
    for (const r of countsRes.rows) counts[r.status] = r.count;
    const [pend, prog, done] = await Promise.all([
      query(itemsSql, ['PENDENTE']),
      query(itemsSql, ['EM_ANDAMENTO']),
      query(itemsSql, ['CONCLUIDO']),
    ]);
    res.json({ counts, columns: { PENDENTE: pend.rows, EM_ANDAMENTO: prog.rows, CONCLUIDO: done.rows } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao montar board' }); }
});
export default router;
