import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// Lista responsáveis (funcionários / patologistas ativos)
router.get('/responsaveis', async (_req, res) => {
  try {
    const r = await query(
      `SELECT id, name, role
         FROM users
        WHERE enabled = TRUE
          AND role IN ('FUNCIONARIO','PATOLOGISTA')
        ORDER BY name`
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar responsáveis' });
  }
});

/**
 * BOARD: PENDENTE | EM_PREPARO_INICIAL | CONCLUIDO
 */
router.get('/board', async (_req, res) => {
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
    SELECT
      e.id,
      e.type,
      e.priority,
      COALESCE(ls.status,'PENDENTE') AS status,
      p.name AS patient_name,
      e.created_at
    FROM exams e
    LEFT JOIN last_steps ls ON ls.exam_id = e.id
    LEFT JOIN patients p ON p.id = e.patient_id
    WHERE COALESCE(ls.status,'PENDENTE') = $1
    ORDER BY e.created_at DESC
    LIMIT 20
  `;

  try {
    const countsRes = await query(countsSql);
    const counts = { PENDENTE: 0, EM_PREPARO_INICIAL: 0, CONCLUIDO: 0 };
    for (const r of countsRes.rows) if (counts[r.status] !== undefined) counts[r.status] = r.count;

    const [pend, prep, done] = await Promise.all([
      query(itemsSql, ['PENDENTE']),
      query(itemsSql, ['EM_PREPARO_INICIAL']),
      query(itemsSql, ['CONCLUIDO']),
    ]);

    res.json({
      counts,
      columns: {
        PENDENTE: pend.rows,
        EM_PREPARO_INICIAL: prep.rows,
        CONCLUIDO: done.rows
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao montar board' });
  }
});

/**
 * (Opcional) Filtro simples: /exams?patient_id=123
 */
router.get('/', async (req, res) => {
  try {
    const { patient_id } = req.query;
    if (patient_id) {
      const r = await query(
        `SELECT id, type, priority, created_at
           FROM exams
          WHERE patient_id = $1
          ORDER BY created_at DESC`,
        [patient_id]
      );
      return res.json(r.rows);
    }
    const r = await query(`SELECT id, type, priority, created_at FROM exams ORDER BY created_at DESC LIMIT 50`);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar exames' });
  }
});

/**
 * INICIAR PREPARO
 * - exige último status = PENDENTE
 * - recebe { laminas, responsavel_id }
 * - atualiza exams (prep_laminas, prep_responsavel, prep_started_at)
 * - insere exam_steps com responsible_id
 */
router.post('/:id/start-prep', async (req, res) => {
  const examId = Number(req.params.id);
  const { laminas, responsavel_id } = req.body || {};

  if (!examId) return res.status(400).json({ error: 'Exame inválido.' });
  if (!laminas || Number(laminas) <= 0)
    return res.status(400).json({ error: 'Informe a quantidade de lâminas (> 0).' });
  if (!responsavel_id || isNaN(Number(responsavel_id)))
    return res.status(400).json({ error: 'Selecione o responsável.' });

  try {
    await query('BEGIN');

    // Exame existe?
    const e = await query('SELECT id FROM exams WHERE id = $1', [examId]);
    if (e.rowCount === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Exame não encontrado.' });
    }

    // Último status (se não houver, considere PENDENTE)
    const last = await query(
      `SELECT status
         FROM exam_steps
        WHERE exam_id = $1
        ORDER BY started_at DESC, id DESC
        LIMIT 1`,
      [examId]
    );
    const lastStatus = last.rowCount ? last.rows[0].status : 'PENDENTE';
    if (lastStatus !== 'PENDENTE') {
      await query('ROLLBACK');
      return res.status(409).json({ error: `Exame não está pendente (status atual: ${lastStatus}).` });
    }

    // valida responsável
    const u = await query(
      `SELECT id, name
         FROM users
        WHERE id = $1
          AND enabled = TRUE
          AND role IN ('FUNCIONARIO','PATOLOGISTA')`,
      [responsavel_id]
    );
    if (!u.rowCount) {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'Responsável inválido.' });
    }
    const respName = u.rows[0].name;

    // Atualiza dados no exame
    await query(
      `UPDATE exams
          SET prep_laminas = $1,
              prep_responsavel = $2,
              prep_started_at = NOW()
        WHERE id = $3`,
      [Number(laminas), respName, examId]
    );

    // Registra passo com responsible_id
    await query(
      `INSERT INTO exam_steps (exam_id, step, status, responsible_id, started_at)
       VALUES ($1, 'PREPARO_INICIAL', 'EM_PREPARO_INICIAL', $2, NOW())`,
      [examId, Number(responsavel_id)]
    );

    await query('COMMIT');

    res.json({
      id: examId,
      status: 'EM_PREPARO_INICIAL',
      prep_laminas: Number(laminas),
      prep_responsavel: respName,
      responsavel_id: Number(responsavel_id)
    });
  } catch (err) {
    console.error('start-prep error:', err);
    try { await query('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Erro ao iniciar preparo do exame' });
  }
});
// ============================
// DETALHES DO EXAME (para o modal)
// GET /exams/:id
// ============================
router.get('/:id', async (req, res) => {
  const examId = Number(req.params.id);
  if (!examId) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const sql = `
      WITH last_step AS (
        SELECT DISTINCT ON (exam_id) exam_id, status, started_at
        FROM exam_steps
        WHERE exam_id = $1
        ORDER BY exam_id, started_at DESC, id DESC
      )
      SELECT
        e.id,
        e.type,
        e.priority,
        COALESCE(ls.status, 'PENDENTE') AS status,
        e.created_at,
        e.prep_laminas,
        e.prep_responsavel,
        e.prep_started_at,
        p.id   AS patient_id,
        p.name AS patient_name
      FROM exams e
      JOIN patients p ON p.id = e.patient_id
      LEFT JOIN last_step ls ON ls.exam_id = e.id
      WHERE e.id = $1
    `;
    const r = await query(sql, [examId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Exame não encontrado.' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('GET /exams/:id error:', e);
    res.status(500).json({ error: 'Erro ao buscar detalhes do exame.' });
  }
});

// ============================
// CONCLUIR EXAME (botão do modal)
// POST /exams/:id/conclude
// - Só ADMIN e FUNCIONARIO podem concluir
// - Insere passo em exam_steps com status CONCLUIDO
// ============================
router.post('/:id/conclude', async (req, res) => {
  const examId = Number(req.params.id);
  if (!examId) return res.status(400).json({ error: 'ID inválido.' });

  try {
    // req.user chega do middleware global do index.js
    const role = req.user?.role;
    if (!['ADMIN', 'FUNCIONARIO'].includes(role)) {
      return res.status(403).json({ error: 'Sem permissão para concluir.' });
    }

    await query('BEGIN');

    // Confirma exame
    const ex = await query('SELECT id FROM exams WHERE id = $1', [examId]);
    if (ex.rowCount === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Exame não encontrado.' });
    }

    // Status atual (default PENDENTE)
    const last = await query(
      `SELECT status
         FROM exam_steps
        WHERE exam_id = $1
        ORDER BY started_at DESC, id DESC
        LIMIT 1`,
      [examId]
    );
    const lastStatus = last.rowCount ? last.rows[0].status : 'PENDENTE';
    if (lastStatus === 'CONCLUIDO') {
      await query('ROLLBACK');
      return res.status(409).json({ error: 'Exame já está CONCLUÍDO.' });
    }

    // Registra passo final
    await query(
      `INSERT INTO exam_steps (exam_id, step, status, responsible_id, started_at)
       VALUES ($1, 'FINALIZACAO', 'CONCLUIDO', $2, NOW())`,
      [examId, req.user?.id || null]
    );

    await query('COMMIT');
    res.json({ id: examId, status: 'CONCLUIDO' });
  } catch (e) {
    console.error('POST /exams/:id/conclude error:', e);
    try { await query('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Erro ao concluir exame.' });
  }
});


export default router;
